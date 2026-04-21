/**
 * app/api/upload/complete+api.ts
 *
 * POST /api/upload/complete
 *
 * Called by the client immediately after it finishes a direct PUT to R2
 * via a signed URL.  This handler:
 *   1. Verifies the caller's Firebase ID token (firebase-admin).
 *   2. Confirms the message doc belongs to that uid (Firestore ownership check).
 *   3. For image uploads — downloads the raw bytes from R2, runs Sharp to
 *      generate three WebP variants:
 *        • thumb   → 48 × 48 px  (avatars, list thumbnails)
 *        • preview → 256 × 256 px (inline chat bubble)
 *        • full    → 1 080 px wide (lightbox / full view)
 *      and uploads all three back to R2.
 *   4. Runs OpenAI omni-moderation on the preview URL (free tier, Phase 1).
 *      Falls back gracefully if the API is unavailable — moderation failure
 *      never blocks the upload.
 *   5. Updates the Firestore message doc with processed URLs +
 *      moderation result.
 *   6. Pushes flagged content to /adminQueue for human review
 *      (blueprint §16 Tier 1 auto-hide + Tier 2 queue).
 *   7. Voice note uploads skip Sharp processing — only Firestore is updated.
 *
 * Env vars required:
 *   FIREBASE_ADMIN_CREDENTIALS   – service account JSON (stringified)
 *   R2_ACCOUNT_ID                – Cloudflare account ID
 *   R2_ACCESS_KEY_ID             – R2 access key
 *   R2_SECRET_ACCESS_KEY         – R2 secret key
 *   R2_BUCKET                    – bucket name  (e.g. "orbit-media")
 *   R2_PUBLIC_URL                – CDN base URL  (e.g. "https://cdn.orbitapp.in")
 *   OPENAI_API_KEY               – OpenAI key for moderation (free tier)
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import type { Readable } from "stream";

// ─── Firebase Admin singleton ────────────────────────────────────────────────
function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS!)),
  });
}

// ─── Cloudflare R2 (S3-compatible) client ────────────────────────────────────
const r2 = new S3Client({
  region:   "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// ─── Image variant config (blueprint §11) ────────────────────────────────────
const VARIANTS = [
  { suffix: "thumb",   size: 48,   quality: 70 },
  { suffix: "preview", size: 256,  quality: 85 },
  { suffix: "full",    size: 1080, quality: 88 },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a Node.js Readable stream to a Buffer (AWS SDK v3 body). */
async function streamToBuffer(readable: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    readable.on("data",  (c: Buffer) => chunks.push(c));
    readable.on("end",   ()          => resolve(Buffer.concat(chunks)));
    readable.on("error", reject);
  });
}

/**
 * Derive a variant object key from the original upload key.
 * "uploads/uid/1234567890.jpg" → "uploads/uid/1234567890_thumb.webp"
 */
function variantKey(original: string, suffix: string): string {
  const dotIdx = original.lastIndexOf(".");
  const base   = dotIdx >= 0 ? original.slice(0, dotIdx) : original;
  return `${base}_${suffix}.webp`;
}

/**
 * Map OpenAI moderation category flags to ORBIT severity levels
 * (blueprint §16 Tier 1 / 2 / 3).
 */
function detectSeverity(cats: Record<string, boolean>): "crit" | "high" | "med" {
  const critical = ["sexual/minors", "sexual", "violence/graphic"];
  const high     = ["hate", "harassment", "self-harm", "illicit/violent"];
  for (const c of critical) if (cats[c]) return "crit";
  for (const c of high)     if (cats[c]) return "high";
  return "med";
}

// ─── Request / Response types ─────────────────────────────────────────────────
interface CompleteBody {
  /** R2 object key of the raw upload. */
  key:        string;
  /** Firestore message doc ID. */
  messageId:  string;
  /** Parent room/dm doc ID. */
  parentId:   string;
  /** "room" → /rooms collection · "dm" → /dmThreads collection */
  parentKind: "room" | "dm";
  /** "image" triggers Sharp processing; "voice" skips it. */
  type?:      "image" | "voice";
  /** Firebase ID token of the uploading user. */
  token:      string;
}

// ─── POST handler ─────────────────────────────────────────────────────────────
export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as CompleteBody;
    const { key, messageId, parentId, parentKind, type = "image", token } = body;

    // ── 1. Basic input validation ──────────────────────────────────────────
    if (!key || !messageId || !parentId || !parentKind || !token) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (parentKind !== "room" && parentKind !== "dm") {
      return Response.json({ error: "parentKind must be 'room' or 'dm'" }, { status: 400 });
    }

    // ── 2. Verify Firebase ID token ────────────────────────────────────────
    const app = getAdminApp();
    let uid: string;
    try {
      const decoded = await getAuth(app).verifyIdToken(token, /* checkRevoked */ true);
      uid = decoded.uid;
    } catch {
      return Response.json({ error: "Unauthorized — invalid or revoked Firebase token" }, { status: 401 });
    }

    // ── 3. Ownership check — confirm message belongs to this uid ──────────
    const db         = getFirestore(app);
    const collection = parentKind === "room" ? "rooms" : "dmThreads";
    const msgRef     = db
      .collection(collection)
      .doc(parentId)
      .collection("messages")
      .doc(messageId);

    const msgSnap = await msgRef.get();
    if (!msgSnap.exists) {
      return Response.json({ error: "Message not found" }, { status: 404 });
    }
    if ((msgSnap.data() as { uid?: string }).uid !== uid) {
      return Response.json({ error: "Forbidden — message belongs to a different user" }, { status: 403 });
    }

    // ── 4. Voice notes — no image processing; just finalise the URL ────────
    if (type === "voice") {
      const voiceUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
      await msgRef.update({
        imageUrl:  voiceUrl,
        processed: true,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return Response.json({ ok: true, url: voiceUrl });
    }

    // ── 5. Download raw image bytes from R2 ────────────────────────────────
    const { Body } = await r2.send(
      new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key })
    );
    const rawBuffer = await streamToBuffer(Body as Readable);

    // ── 6. Sharp — generate and upload three WebP variants ─────────────────
    const variantUrls: Record<string, string> = {};

    await Promise.all(
      VARIANTS.map(async ({ suffix, size, quality }) => {
        const webpBuffer = await sharp(rawBuffer)
          .resize(size, size, { fit: "cover", withoutEnlargement: true })
          .webp({ quality })
          .toBuffer();

        const vKey = variantKey(key, suffix);
        await r2.send(
          new PutObjectCommand({
            Bucket:       process.env.R2_BUCKET!,
            Key:          vKey,
            Body:         webpBuffer,
            ContentType:  "image/webp",
            CacheControl: "public, max-age=31536000, immutable",
          })
        );
        variantUrls[suffix] = `${process.env.R2_PUBLIC_URL}/${vKey}`;
      })
    );

    // ── 7. OpenAI Moderation on the preview URL ────────────────────────────
    let flagged              = false;
    let moderationCategories: Record<string, boolean> = {};

    if (process.env.OPENAI_API_KEY) {
      try {
        const modRes = await fetch("https://api.openai.com/v1/moderations", {
          method:  "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:  `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "omni-moderation-latest",
            input: [
              {
                type:      "image_url",
                image_url: { url: variantUrls.preview },
              },
            ],
          }),
        });
        if (modRes.ok) {
          const modData = (await modRes.json()) as {
            results: Array<{
              flagged:    boolean;
              categories: Record<string, boolean>;
            }>;
          };
          flagged               = modData.results?.[0]?.flagged    ?? false;
          moderationCategories  = modData.results?.[0]?.categories ?? {};
        }
      } catch (modErr) {
        // Non-fatal: moderation failure must not block the upload
        console.warn("[upload/complete] OpenAI moderation check failed:", modErr);
      }
    }

    // ── 8. Update Firestore message doc ────────────────────────────────────
    const msgUpdate: Record<string, unknown> = {
      imageUrl:         variantUrls.full,
      thumbUrl:         variantUrls.thumb,
      previewUrl:       variantUrls.preview,
      processed:        true,
      flagged,
      moderationStatus: flagged ? "flagged" : "approved",
      updatedAt:        FieldValue.serverTimestamp(),
    };

    if (flagged) {
      // Tier 1 auto-hide — content invisible to normal users pending review
      msgUpdate.hidden = true;

      // Tier 2 adminQueue entry for human review (blueprint §16)
      await db.collection("adminQueue").add({
        source:    "openai_mod",
        severity:  detectSeverity(moderationCategories),
        content: {
          type:        "image",
          key,
          variantUrls,
          messageId,
          parentId,
          parentKind,
          authorUid:   uid,
          categories:  moderationCategories,
        },
        status:    "pending",
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    await msgRef.update(msgUpdate);

    return Response.json({ ok: true, flagged, urls: variantUrls });
  } catch (err: any) {
    console.error("[upload/complete] unhandled error:", err);
    return Response.json(
      { error: err?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
