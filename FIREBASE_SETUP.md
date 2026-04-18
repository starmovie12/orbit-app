# Firebase + EAS Dev Build Setup Guide

> ORBIT ko Phone OTP ke saath run karne ke liye poora checklist. Top-to-bottom follow karo.
> Expected time: **~60-90 min** (first time).

---

## 📋 Prerequisites

- Node 20+ aur npm installed
- Expo CLI: `npm i -g eas-cli`
- Firebase CLI: `npm i -g firebase-tools`
- Android Studio (SHA fingerprints ke liye) — sirf Android testing ke liye
- Apple Developer account (iOS testing ke liye — ₹99/year)

---

## 1️⃣ Firebase Console — Android App Add Karo

1. [Firebase Console](https://console.firebase.google.com) → `orbit-app` project kholo
2. **Project Overview** → gear icon ⚙ → **Project settings**
3. **Your apps** section mein scroll karo → **Add app** → Android icon (🤖)
4. Bharo:
   - **Android package name:** `com.nooralam.orbit` (must match `app.json`)
   - **App nickname:** `ORBIT Android`
   - **Debug signing certificate SHA-1:** (abhi skip kar sakte ho, baad mein add karna hai)
5. **Register app** → **Download `google-services.json`**
6. File ko project root mein copy karo: `/home/claude/orbit-updated/google-services.json`

### SHA-1 add karna (Phone Auth ke liye CRITICAL)

Phone OTP Android pe SHA-1/SHA-256 match chahiye. EAS build use kar rahe ho, toh:

```bash
# EAS se SHA get karo (ek baar build ke baad available)
eas credentials

# Ya manual debug keystore se:
keytool -list -v -alias androiddebugkey \
  -keystore ~/.android/debug.keystore \
  -storepass android -keypass android
```

SHA-1 aur SHA-256 copy karo → Firebase Console → Project Settings → **Your apps** → Android app → **Add fingerprint** → paste karo → Save.

> ⚠️ **Important:** EAS dev build ka SHA `eas build` ke baad alag hota hai debug keystore se. Build ke baad `eas credentials` se dekho aur woh add karo.

Phir **naya `google-services.json` download karo** (kyunki SHA add hone ke baad file update hoti hai) aur replace karo.

---

## 2️⃣ Firebase Console — iOS App Add Karo (skip kar sakte ho agar sirf Android testing hai)

1. **Your apps** → **Add app** → iOS icon (🍎)
2. Bharo:
   - **Apple bundle ID:** `com.nooralam.orbit`
   - **App nickname:** `ORBIT iOS`
3. Download **`GoogleService-Info.plist`**
4. Project root mein copy karo: `/home/claude/orbit-updated/GoogleService-Info.plist`

### iOS ke liye APNs setup

iOS Phone Auth APNs silent push verification use karta hai. Full guide: https://rnfirebase.io/auth/phone-auth

Short version:
- Apple Developer Portal → Keys → new **APNs Authentication Key** banao → `.p8` download
- Firebase Console → Project settings → **Cloud Messaging** → iOS app → **APNs Authentication Key** upload
- Key ID, Team ID bharo

---

## 3️⃣ Firebase Console — Phone Auth Enable Karo

1. **Build** → **Authentication** → **Sign-in method**
2. **Phone** row → **Enable** → Save
3. **Settings** tab → **Authorized domains** mein apna app scheme add hoga automatically

### Test phone numbers (optional but useful)

Development ke time real SMS bhejne ke bajaye test numbers use kar sakte ho:

1. **Authentication** → **Sign-in method** → Phone row → **Phone numbers for testing**
2. Add: `+919999999999` → OTP `123456`
3. Ab app mein yeh number daalo → `123456` daalo → instant login (no SMS sent, no quota used)

> 💡 **Zaroor karo** — Firebase free tier pe sirf ~10 free SMS/day milte hain. Test numbers unlimited hain.

---

## 4️⃣ Firebase Console — Firestore Enable Karo

1. **Build** → **Firestore Database** → **Create database**
2. **Location:** `asia-south2` (Delhi) ya `asia-south1` (Mumbai) — kabhi change nahi hota, sahi choose karo
3. **Start in production mode** select karo (humare rules deploy honge)
4. Create button daba do

### Rules deploy karo

```bash
cd orbit-updated
firebase login
firebase use orbit-app-5b4b3
firebase deploy --only firestore:rules
```

Firestore UI mein **Rules** tab kholke verify karo ki hamari rules apply ho gayi hain.

### Index create karo (baad mein)

Abhi auth + onboarding ke liye koi composite index nahi chahiye. Jab rooms/DMs build karenge, Cloud Console khud suggest karega.

---

## 5️⃣ Project Setup — Local Dev

```bash
cd orbit-updated
npm install
```

### `google-services.json` aur `GoogleService-Info.plist` verify karo

```bash
ls -la google-services.json GoogleService-Info.plist
```

Dono files root mein honi chahiye. Agar nahi hai, Step 1-2 repeat karo.

### `.gitignore` update karo (PEHLE)

`.gitignore` mein yeh add karo taaki Firebase files GitHub pe na jayein:

```
# Firebase config (each dev downloads from console)
google-services.json
GoogleService-Info.plist

# Firebase admin keys
*-firebase-adminsdk-*.json
```

> 🔐 **Reminder:** Aap ne jo `orbit-app-5b4b3-firebase-adminsdk-fbsvc-a5498ab90f.json` share kiya tha woh EXPOSED hai. Firebase Console → Project Settings → Service accounts → old key **delete** karo, nayi generate karo. **Client `google-services.json` safe hai public ho bhi jaaye** — yeh Admin SDK wali key alag hai.

---

## 6️⃣ EAS — Account Setup

```bash
eas login            # Expo account login
eas init --id 427cbfe2-93f1-491f-954d-b23a87f32a93
```

Agar `eas init` kehta hai "project already linked" — fine, skip.

---

## 7️⃣ Dev Build — Android (Phone pe test karne ke liye)

```bash
# Build kicks off on EAS servers (~15-20 min first time)
npm run build:dev-android

# Build done hone par EAS URL dega — QR code scan karo ya APK download karo
```

APK install karne ke baad:

```bash
npm run start        # dev client mode (Expo Go nahi)
```

Phone pe install ki hui ORBIT app kholo → terminal se connect ho jayegi → Phone OTP flow test kar sakte ho.

> ⚠️ **Expo Go use mat karo** — ab se hamara app Phone Auth use karta hai jo Expo Go mein nahi chalta. `npm run start` se dev client launch hoga.

---

## 8️⃣ Dev Build — iOS (simulator)

```bash
npm run build:dev-ios
```

Download hone ke baad `.app` file ko simulator pe drag karo. Phone OTP iOS simulator pe test nahi ho sakta (APNs chahiye) — real device ya test phone numbers use karo.

---

## 9️⃣ First Run Verification

1. App kholo → **Welcome** screen dikhni chahiye
2. **Continue with Phone** → **+91 9999 999 999** (test number) → **Send OTP**
3. **OTP** screen → `123456` → auto-verify
4. **Onboarding:**
   - Language pick karo → Continue
   - 3+ interests pick karo → Continue
   - Username + avatar pick karo → Claim
   - Welcome bonus screen → Let's go
5. **Rooms tab** aa jayegi — existing UI jaisi thi, waisi hi.

Firestore Console → **Data** tab → `users/{uid}` doc dikhni chahiye, `usernames/{handle}` reservation doc bhi.

---

## 🔟 Troubleshooting

### "Phone auth not enabled"
→ Step 3 repeat karo.

### "reCAPTCHA verification failed" / "auth/app-not-authorized"
→ Android: SHA-1/SHA-256 fingerprints add nahi hue ya wrong hain. Step 1 ka SHA section repeat karo. Naya `google-services.json` bhi download karo aur replace karo.

### "auth/quota-exceeded"
→ Free tier SMS quota khatam. Test phone numbers use karo (Step 3).

### OTP auto-fill nahi ho raha Android pe
→ `react-native-firebase` auto SMS Retriever handle karta hai. Agar fir bhi nahi ho raha, manually type karo — flow same hai.

### White screen after OTP verify
→ Firestore rules deploy nahi hui. Step 4 rules deploy section repeat karo.

### iOS build fail: "Static frameworks conflict"
→ `app.json` mein hum already `useFrameworks: "static"` daal chuke hain. Agar fail ho to `ios/Podfile` mein `use_frameworks! :linkage => :static` hona chahiye.

---

## 🗺️ Next Steps (Post-Auth)

Phase 1 ka remaining backlog blueprint §17 ke hisab se:

- [ ] Rooms list ko Firestore se drive karo (abhi `constants/data.ts` use hota hai)
- [ ] Room detail screen + real-time messages (Pusher integrate karna hai)
- [ ] DM screen
- [ ] Push notifications (FCM)
- [ ] Voice notes + image upload (R2)
- [ ] Credits earn flow (watch promo)
- [ ] Karma award flow (Cloud Function)
- [ ] Account delete (DPDP) Cloud Function

Har ek ko ek-ek karke karenge. Abhi sirf auth + onboarding working hona chahiye.

---

**Questions atki hai?** Chat mein error screenshot bhejo, main debug kar dunga.
