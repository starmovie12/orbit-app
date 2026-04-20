/**
 * ORBIT — Firestore rooms seed script.
 *
 * Populates /rooms/{id} with the 6 public rooms shown in the Rooms tab mock.
 * Run ONCE from a machine that has a Firebase service-account key:
 *
 *   # Prereqs — install once:
 *   npm install --no-save firebase-admin
 *
 *   # Set the key path (download from Firebase Console → Project Settings →
 *   # Service Accounts → "Generate new private key"):
 *   export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
 *
 *   # Run:
 *   npx ts-node scripts/seed-rooms.ts
 *
 *   # Or without ts-node:
 *   npx tsx scripts/seed-rooms.ts
 *
 * Safe to re-run: uses doc.set({ merge: true }) so existing rooms retain their
 * live counters and lastMessage* fields.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

type SeedRoom = {
  id: string;
  name: string;
  icon: string;
  accent: string;
  description: string;
  kind: "public" | "mood" | "skill" | "live";
  memberCount: number;
  isLive: boolean;
};

/**
 * Rooms here mirror constants/data.ts ROOMS so the UI transitions smoothly
 * from mock → live without visual changes. icons are Feather names.
 */
const SEED_ROOMS: SeedRoom[] = [
  {
    id: "late-night-feels",
    name: "Late Night Feels",
    icon: "moon",
    accent: "#8B5CF6",
    description: "3am thoughts, venting welcome, no judgment.",
    kind: "mood",
    memberCount: 223,
    isLive: false,
  },
  {
    id: "gaming-clutch-week",
    name: "Gaming Clutch Week",
    icon: "target",
    accent: "#E8A33D",
    description: "Post your best clip. Weekly winner gets 1000 credits.",
    kind: "public",
    memberCount: 312,
    isLive: false,
  },
  {
    id: "skill-bazaar",
    name: "Skill Bazaar",
    icon: "briefcase",
    accent: "#5B7FFF",
    description: "Hire talent. Offer skills. Build together.",
    kind: "skill",
    memberCount: 94,
    isLive: false,
  },
  {
    id: "music-junction",
    name: "Music Junction",
    icon: "music",
    accent: "#2BB673",
    description: "Share your tracks. Discover new artists.",
    kind: "public",
    memberCount: 187,
    isLive: false,
  },
  {
    id: "creative-studio",
    name: "Creative Studio",
    icon: "camera",
    accent: "#5B7FFF",
    description: "Photos, art, design — show your work.",
    kind: "public",
    memberCount: 256,
    isLive: false,
  },
  {
    id: "startup-circle",
    name: "Startup Circle",
    icon: "send",
    accent: "#2BB673",
    description: "Indie founders, solo hackers, bootstrappers.",
    kind: "public",
    memberCount: 51,
    isLive: false,
  },
];

async function seed() {
  const batch = db.batch();

  for (const r of SEED_ROOMS) {
    const ref = db.collection("rooms").doc(r.id);
    const existing = await ref.get();

    // Preserve live counters if already seeded once.
    const base = {
      name: r.name,
      icon: r.icon,
      accent: r.accent,
      description: r.description,
      kind: r.kind,
      isLive: r.isLive,
      liveHostUid: null,
      createdBy: "system",
    };

    if (existing.exists) {
      // Only refresh static fields; don't touch memberCount / lastMessage*.
      batch.set(ref, base, { merge: true });
      console.log(`↻ updated  ${r.id}`);
    } else {
      batch.set(ref, {
        ...base,
        memberCount: r.memberCount,
        lastMessagePreview: "",
        lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
        lastMessageUid: null,
        lastMessageUsername: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`+ created  ${r.id}`);
    }
  }

  await batch.commit();
  console.log(`\n✓ Seeded ${SEED_ROOMS.length} rooms.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
