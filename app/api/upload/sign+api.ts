/**
 * app/api/upload/sign+api.ts
 *
 * Expo Router API Route — Cloudflare R2 signed PUT URL generator.
 *
 * POST /api/upload/sign
 * Body  : { filename: string; size: number; type: string }
 * Headers: Authorization: Bearer <Firebase ID token>
 *
 * Flow:
 *   1. Verify Firebase ID token → get uid
 *   2. Check daily upload quota (100/user/day) via Firestore counter
 *   3. Validate file size against media-type limits
 *   4. Generate a pre-signed S3-compatible PUT URL (5 min TTL) for R2
 *   5. Return { url, key, expiresAt }
 *
 * Env vars required:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY          (newlines as literal \n)
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME                (default: "orbit-media")
 *   R2_PUBLIC_BASE_URL            (e.g. https://media.orbit.app)
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {
  getFirestore,
  FieldValue,
  type Firestore,
} from "firebase-admin/firestore";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SignRequestBody {
  filename: string;
  size: number;
  type: string; // MIME type, e.g. "image/jpeg", "audio/webm", "video/mp4"
}

interface SignResponseOk {
  url: string;       // Pre-signed PUT URL — client uploads directly to this
  key: string;       // R2 object key — store in Firestore after upload completes
  publicUrl: string; // CDN URL for the object (usable after upload completes)
  expiresAt: number; // Unix ms when the signed URL expires
}

interface ErrorResponse {
  error: string;
  code: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const QUOTA_LIMIT_PER_DAY = 100;
const SIGNED_URL_TTL_SECONDS = 5 * 60; // 5 minutes

/** Maximum allowed file size per media category (bytes) */
const SIZE_LIMITS: Record<string, number> = {
  image: 25 * 1024 * 1024,  // 25 MB
  audio: 10 * 1024 * 1024,  // 10 MB
  video: 100 * 1024 * 1024, // 100 MB
};

/** Allowed top-level MIME categories */
const ALLOWED_CATEGORIES = new Set(["image", "audio", "video"]);

/** Firestore collection that stores per-user daily upload counters */
const QUOTA_COLLECTION = "uploadQuota";

// ─── Lazy singletons ─────────────────────────────────────────────────────────
// Expo Router API routes may be re-imported on every request in some runtimes,
// so we guard all initializations behind existence checks.

let _adminApp: App | null = null;
let _db: Firestore | null = null;
let _s3: S3Client | null = null;

function getAdminApp(): App {
  if (_adminApp) return _adminApp;

  if (getApps().length > 0) {
    _adminApp = getApps()[0];
    return _adminApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY"
    );
  }

  _adminApp = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return _adminApp;
}

function getDb(): Firestore {
  if (_db) return _db;
  _db = getFirestore(getAdminApp());
  return _db;
}

function getS3(): S3Client {
  if (_s3) return _s3;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing R2 env vars: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY"
    );
  }

  _s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return _s3;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns today's date string in UTC: "YYYY-MM-DD" */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Reads and atomically increments the daily upload counter for a user.
 * Returns the NEW count after increment.
 * Throws if the quota has already been reached before this upload.
 */
async function checkAndIncrementQuota(uid: string): Promise<number> {
  const db = getDb();
  const dateKey = todayUtc();
  const docRef = db.collection(QUOTA_COLLECTION).doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const data = snap.exists ? (snap.data() as Record<string, number>) : {};
    const current = data[dateKey] ?? 0;

    if (current >= QUOTA_LIMIT_PER_DAY) {
      throw Object.assign(
        new Error(`Daily upload quota of ${QUOTA_LIMIT_PER_DAY} reached.`),
        { code: "QUOTA_EXCEEDED" }
      );
    }

    tx.set(docRef, { [dateKey]: FieldValue.increment(1) }, { merge: true });
    return current + 1;
  });
}

/** Derive media category ("image" | "audio" | "video") from a MIME type. */
function mediaCategory(mimeType: string): string {
  return mimeType.split("/")[0].toLowerCase();
}

/**
 * Sanitises a filename — strips path traversal, lowercases, replaces spaces.
 * Returns just the base filename with extension, no directories.
 */
function sanitiseFilename(raw: string): string {
  return raw
    .split(/[\\/]/)
    .pop()!
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .toLowerCase()
    .slice(0, 128);
}

/** Extracts the file extension (without dot). Falls back to "bin". */
function fileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "bin";
}

/**
 * Builds the R2 object key:
 *   {category}/{uid}/{YYYY-MM-DD}/{uuid}.{ext}
 *
 * Keeping uid in the path makes it trivial to list or purge a user's files.
 */
function buildObjectKey(
  uid: string,
  category: string,
  filename: string
): string {
  const ext = fileExtension(sanitiseFilename(filename));
  const date = todayUtc();
  const uuid = crypto.randomUUID();
  return `${category}/${uid}/${date}/${uuid}.${ext}`;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  // ── 1. Parse body ──────────────────────────────────────────────────────────
  let body: SignRequestBody;
  try {
    body = (await request.json()) as SignRequestBody;
  } catch {
    return json<ErrorResponse>(
      { error: "Invalid JSON body.", code: "BAD_REQUEST" },
      400
    );
  }

  const { filename, size, type: mimeType } = body;

  if (
    typeof filename !== "string" || filename.trim() === "" ||
    typeof size !== "number" ||
    typeof mimeType !== "string" || mimeType.trim() === ""
  ) {
    return json<ErrorResponse>(
      { error: "Body must include filename (string), size (number), type (string).", code: "BAD_REQUEST" },
      400
    );
  }

  // ── 2. Authenticate — verify Firebase ID token ────────────────────────────
  const authHeader = request.headers.get("Authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!idToken) {
    return json<ErrorResponse>(
      { error: "Missing Authorization header. Expected: Bearer <idToken>.", code: "UNAUTHENTICATED" },
      401
    );
  }

  let uid: string;
  try {
    const decoded = await getAuth(getAdminApp()).verifyIdToken(idToken, true);
    uid = decoded.uid;
  } catch {
    return json<ErrorResponse>(
      { error: "Invalid or expired Firebase ID token.", code: "UNAUTHENTICATED" },
      401
    );
  }

  // ── 3. Validate MIME type category ────────────────────────────────────────
  const category = mediaCategory(mimeType);

  if (!ALLOWED_CATEGORIES.has(category)) {
    return json<ErrorResponse>(
      {
        error: `Unsupported media type category "${category}". Allowed: image, audio, video.`,
        code: "UNSUPPORTED_MEDIA_TYPE",
      },
      415
    );
  }

  // ── 4. Validate file size ─────────────────────────────────────────────────
  if (size <= 0) {
    return json<ErrorResponse>(
      { error: "File size must be greater than 0.", code: "INVALID_SIZE" },
      400
    );
  }

  const maxBytes = SIZE_LIMITS[category];
  if (size > maxBytes) {
    const maxMb = maxBytes / (1024 * 1024);
    return json<ErrorResponse>(
      {
        error: `File too large. Max ${maxMb}MB for ${category} uploads. Got ${(size / (1024 * 1024)).toFixed(2)}MB.`,
        code: "FILE_TOO_LARGE",
      },
      413
    );
  }

  // ── 5. Check & increment daily quota (100/day per user) ───────────────────
  try {
    await checkAndIncrementQuota(uid);
  } catch (err: any) {
    if (err?.code === "QUOTA_EXCEEDED") {
      return json<ErrorResponse>(
        {
          error: `Daily upload limit of ${QUOTA_LIMIT_PER_DAY} reached. Try again tomorrow.`,
          code: "QUOTA_EXCEEDED",
        },
        429
      );
    }
    console.error("[upload/sign] Quota check failed:", err);
    return json<ErrorResponse>(
      { error: "Internal server error during quota check.", code: "INTERNAL_ERROR" },
      500
    );
  }

  // ── 6. Generate R2 signed PUT URL ─────────────────────────────────────────
  const bucketName = process.env.R2_BUCKET_NAME ?? "orbit-media";
  const publicBaseUrl = (process.env.R2_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
  const key = buildObjectKey(uid, category, filename);
  const expiresAt = Date.now() + SIGNED_URL_TTL_SECONDS * 1000;

  let signedUrl: string;
  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: mimeType,
      ContentLength: size,
      // Tag with uploader uid for server-side lifecycle policies / CSAM scanning
      Tagging: `uid=${uid}&category=${category}`,
    });

    signedUrl = await getSignedUrl(getS3(), command, {
      expiresIn: SIGNED_URL_TTL_SECONDS,
    });
  } catch (err) {
    console.error("[upload/sign] Failed to generate signed URL:", err);
    return json<ErrorResponse>(
      { error: "Failed to generate upload URL. Please try again.", code: "SIGNING_ERROR" },
      500
    );
  }

  // ── 7. Respond ─────────────────────────────────────────────────────────────
  return json<SignResponseOk>({
    url: signedUrl,
    key,
    publicUrl: publicBaseUrl ? `${publicBaseUrl}/${key}` : `https://${bucketName}.r2.dev/${key}`,
    expiresAt,
  });
}

// ─── Only POST is supported ───────────────────────────────────────────────────

export function GET(): Response {
  return json<ErrorResponse>(
    { error: "Method not allowed. Use POST.", code: "METHOD_NOT_ALLOWED" },
    405
  );
}

// ─── Tiny JSON helper ─────────────────────────────────────────────────────────

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
