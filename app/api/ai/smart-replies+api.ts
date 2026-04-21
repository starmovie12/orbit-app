/**
 * app/api/ai/smart-replies+api.ts
 *
 * POST /api/ai/smart-replies
 *
 * AI Smart Reply suggestions — Gemini 1.5 Flash (blueprint §08 Engine 1,
 * §09 Retention Idea 8 — "Conversational AI").
 *
 * Generates 3 short Hinglish reply suggestions based on the last 5 messages
 * of a room or DM conversation. Triggered client-side when the user taps the
 * smart-reply bar above the keyboard.
 *
 * Flow:
 *   1. Verify Firebase ID token (x-firebase-token header).
 *   2. Parse + validate body: { messages, context? }
 *      messages — last ≤5 messages (oldest first), each: { uid, username, text }
 *      context  — optional room/dm name for topic grounding
 *   3. Build a structured Gemini prompt with the conversation history.
 *   4. Call Gemini 1.5 Flash generateContent() — single non-streaming call.
 *   5. Parse the JSON array of 3 suggestions from the model response.
 *   6. Return { ok: true, suggestions: string[] }.
 *
 * Rate limiting:
 *   Free tier is 15 RPM — enforced server-side via a simple per-user
 *   in-memory debounce guard (1 request / 4s per UID). For production
 *   scale use Upstash (same pattern as flag+api.ts).
 *
 * Env vars required:
 *   FIREBASE_ADMIN_CREDENTIALS   – Service-account JSON (stringified)
 *   GEMINI_API_KEY               – Google AI Studio API key
 *                                  (console.cloud.google.com → API & Services)
 */

import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {
  GoogleGenerativeAI,
  type GenerationConfig,
  type Content,
} from "@google/generative-ai";

// ─── Firebase Admin singleton ─────────────────────────────────────────────────
// Exact pattern from cashout+api.ts, pusher/auth+api.ts, moderation/flag+api.ts

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS!)),
  });
}

// ─── Gemini model singleton ────────────────────────────────────────────────────

let _geminiModel: ReturnType<InstanceType<typeof GoogleGenerativeAI>["getGenerativeModel"]> | null = null;

function getGeminiModel(): ReturnType<InstanceType<typeof GoogleGenerativeAI>["getGenerativeModel"]> {
  if (_geminiModel) return _geminiModel;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY env var is not set.");
  const genAI = new GoogleGenerativeAI(apiKey);
  const generationConfig: GenerationConfig = {
    temperature:     0.85,   // slightly creative, not hallucination-prone
    topP:            0.9,
    topK:            40,
    maxOutputTokens: 256,    // 3 short suggestions — never needs more
  };
  _geminiModel = genAI.getGenerativeModel({
    model:            "gemini-1.5-flash",
    generationConfig,
  });
  return _geminiModel;
}

// ─── Per-user debounce (in-memory, 4s window) ────────────────────────────────
// Prevents hammering the free-tier 15 RPM limit from a single user.
// For production scale, replace with Upstash sliding-window (see flag+api.ts).

const lastCallByUid = new Map<string, number>();
const DEBOUNCE_MS   = 4_000;

function isRateLimited(uid: string): boolean {
  const last = lastCallByUid.get(uid) ?? 0;
  const now  = Date.now();
  if (now - last < DEBOUNCE_MS) return true;
  lastCallByUid.set(uid, now);
  return false;
}

// ─── Types ─────────────────────────────────────────────────────────────────────
// Matches MessageDoc from lib/firestore-messages.ts — only text messages
// are useful for smart replies; voice/image are filtered out client-side.

interface IncomingMessage {
  uid:      string;  // author Firebase UID
  username: string;  // display name for context
  text:     string;  // message text (non-null — client must filter)
}

// ─── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(
  messages:     IncomingMessage[],
  callerUid:    string,
  contextLabel: string
): string {
  // Format the last ≤5 messages as a readable transcript
  const transcript = messages
    .slice(-5)
    .map((m) => {
      const speaker = m.uid === callerUid ? "Me" : m.username;
      return `${speaker}: ${m.text}`;
    })
    .join("\n");

  return `
You are an AI assistant inside ORBIT — an Indian social chat app used by Gen-Z and young adults.
Your job is to suggest 3 short, natural reply options the user can tap to quickly respond.

Rules:
- Each reply must be in Hinglish (mix of Hindi and English, written in Roman script).
- Each reply must be 2–8 words maximum. Short and punchy.
- Replies should match the emotional tone of the conversation (funny, supportive, excited, etc.).
- Do NOT start any reply with "Haha", "Lol", or generic filler.
- Do NOT repeat the same sentiment across all 3 suggestions — provide variety.
- Return ONLY a valid JSON array of exactly 3 strings. No explanation, no markdown, no prefix.
- Example output format: ["Sahi kaha yaar!", "Mujhe bhi batao", "Pakka ho jayega"]

${contextLabel ? `Chat context: ${contextLabel}\n` : ""}
Recent conversation (oldest to newest):
${transcript}

My reply suggestions (JSON array only):`.trim();
}

// ─── Response parser ───────────────────────────────────────────────────────────

function parseSuggestions(raw: string): string[] {
  // Strip any accidental markdown fencing
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/,          "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Fallback: try to extract the first JSON array in the string
    const match = cleaned.match(/\[[\s\S]*?\]/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        return [];
      }
    } else {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  // Validate: keep only non-empty strings, cap at 3
  return (parsed as unknown[])
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim())
    .slice(0, 3);
}

// ─── POST handler ──────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  try {
    // ── 1. Verify Firebase ID token ───────────────────────────────────────
    const token = request.headers.get("x-firebase-token") ?? "";
    if (!token) {
      return Response.json(
        { error: "Missing x-firebase-token header" },
        { status: 401 }
      );
    }

    const app = getAdminApp();
    let callerUid: string;

    try {
      const decoded = await getAuth(app).verifyIdToken(token, /* checkRevoked */ true);
      callerUid = decoded.uid;
    } catch {
      return Response.json(
        { error: "Unauthorized — invalid or revoked Firebase token" },
        { status: 401 }
      );
    }

    // ── 2. Per-user debounce ──────────────────────────────────────────────
    if (isRateLimited(callerUid)) {
      return Response.json(
        { error: "Too many requests. Wait a moment before requesting more suggestions." },
        { status: 429 }
      );
    }

    // ── 3. Parse and validate request body ───────────────────────────────
    let body: {
      messages?: unknown;
      context?:  unknown;
    };

    try {
      body = (await request.json()) as typeof body;
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Validate messages array
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return Response.json(
        { error: "messages must be a non-empty array" },
        { status: 400 }
      );
    }

    // Validate and normalise each message entry
    const rawMessages = body.messages as unknown[];
    const messages: IncomingMessage[] = [];

    for (const m of rawMessages) {
      if (
        typeof m !== "object" ||
        m === null ||
        typeof (m as Record<string, unknown>).uid      !== "string" ||
        typeof (m as Record<string, unknown>).username !== "string" ||
        typeof (m as Record<string, unknown>).text     !== "string"
      ) {
        return Response.json(
          { error: "Each message must have string fields: uid, username, text" },
          { status: 400 }
        );
      }
      const msg = m as Record<string, string>;
      const text = msg.text.trim();
      if (!text) continue;  // skip empty / whitespace-only messages

      messages.push({
        uid:      msg.uid,
        username: msg.username,
        text,
      });
    }

    if (messages.length === 0) {
      return Response.json(
        { error: "No valid text messages provided" },
        { status: 400 }
      );
    }

    // Optional context label (room name / DM partner name)
    const contextLabel =
      typeof body.context === "string" ? body.context.trim().slice(0, 100) : "";

    // ── 4. Build prompt and call Gemini ───────────────────────────────────
    const prompt = buildPrompt(messages, callerUid, contextLabel);

    let rawResponse: string;
    try {
      const model  = getGeminiModel();
      const result = await model.generateContent(prompt);
      rawResponse  = result.response.text();
    } catch (geminiErr: any) {
      console.error("[ai/smart-replies] Gemini API error:", geminiErr?.message ?? geminiErr);
      return Response.json(
        { error: "AI service temporarily unavailable. Please try again." },
        { status: 503 }
      );
    }

    // ── 5. Parse suggestions ──────────────────────────────────────────────
    const suggestions = parseSuggestions(rawResponse);

    if (suggestions.length === 0) {
      // Gemini returned unparseable output — return empty rather than crashing
      console.warn(
        "[ai/smart-replies] Could not parse suggestions from Gemini output:",
        rawResponse.slice(0, 200)
      );
      return Response.json({ ok: true, suggestions: [] });
    }

    // ── 6. Return ─────────────────────────────────────────────────────────
    return Response.json({ ok: true, suggestions });

  } catch (err: any) {
    console.error("[ai/smart-replies] Unhandled error:", err?.message ?? err);
    return Response.json(
      { error: err?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
