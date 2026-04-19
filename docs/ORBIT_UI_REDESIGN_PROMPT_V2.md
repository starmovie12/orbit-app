# ORBIT — Premium UI/UX Master Redesign Prompt (v2)

> **Role:** You are a Principal Product Designer + Senior Frontend Engineer hired to ship a flagship-grade UI for **Orbit** — a digital neighborhood app (Rooms, Rep, Rewards). This is not a "tweak" — it is a **complete from-scratch UI rebuild**. The previous iteration was an amateur Telegram clone. Delete it. Start over with the strict system below.

> **Mission:** Make Orbit feel **calmer than WhatsApp, more structured than Discord, and more premium than Telegram** — without copying any of them. The user must open the app and immediately think: *"This is not another chat clone. This is a product."*

---

## 0. PROJECT CONTEXT

- **App name:** Orbit
- **Tagline:** *Your digital neighborhood. Rooms, rep, rewards.*
- **Audience:** Indian Gen-Z + millennials (Hindi/Hinglish primary). Power users of WhatsApp + Discord + Telegram.
- **Platform:** Mobile-first PWA (375×812 baseline). Must scale gracefully to tablet.
- **Tech stack:** Next.js 15 + Tailwind (utility-first), Framer Motion for transitions, Lucide React for icons. No bootstrap, no Material, no Ant.
- **Theme:** Dark-first (default). Light theme is a stretch goal — design tokens MUST support both.

---

## 1. DESIGN PHILOSOPHY (read this 3 times before writing any CSS)

1. **Quiet luxury, not loud party.** Restraint is premium. If you're tempted to add a gradient, glow, or emoji — don't. Linear, Notion, Vercel, Arc browser — that energy.
2. **One accent color. One.** Not three. The accent is a tool used 5–8% of the screen, not 80%.
3. **Hierarchy through space and weight, not color and size.** Use whitespace and font-weight to guide the eye before reaching for color.
4. **Every pixel earns its place.** If a divider, badge, or icon doesn't carry information, delete it.
5. **Beat Telegram by being simpler. Beat Discord by being calmer. Beat WhatsApp by being more capable.**
6. **No childish flourishes.** No emoji-as-icon, no neon gradients on cards, no rainbow leaderboards, no "amp up your profile" purple dotted cards.

---

## 2. DESIGN TOKENS (single source of truth — define these as CSS variables)

### 2.1 Color System

**Dark theme (default):**
```css
--bg-base:        #0A0A0B;   /* App background — near-black, slight warmth */
--bg-surface-1:   #131316;   /* Cards, list items */
--bg-surface-2:   #1C1C20;   /* Hovered/elevated surfaces, input fields */
--bg-surface-3:   #26262C;   /* Modals, sheets */
--border-subtle:  #1F1F24;   /* Hairline dividers (1px) */
--border-strong:  #2E2E35;   /* Input borders, defined edges */

--text-primary:   #F5F5F7;   /* Headings, key labels */
--text-secondary: #A1A1AA;   /* Body, meta info */
--text-tertiary:  #6B6B73;   /* Timestamps, hints, disabled */
--text-inverse:   #0A0A0B;   /* Text on accent buttons */

--accent:         #5B7FFF;   /* The ONE Orbit blue — calm, confident */
--accent-hover:   #4A6FF0;
--accent-soft:    rgba(91, 127, 255, 0.10);  /* Tinted backgrounds */

--success:        #2BB673;
--warning:        #E8A33D;
--danger:         #E5484D;

--shadow-sm:      0 1px 2px rgba(0, 0, 0, 0.4);
--shadow-md:      0 4px 12px rgba(0, 0, 0, 0.35);
--shadow-lg:      0 16px 40px rgba(0, 0, 0, 0.45);
```

**Rules:**
- NEVER use pure `#000000` for background or pure `#FFFFFF` for text.
- NEVER use more than ONE accent color in the entire app. The accent is `--accent`. Period.
- The "Mood Rooms" cards must NOT each have their own neon background. Use `--bg-surface-1` with a small left-edge accent stripe (3px) in a category color if absolutely needed.
- The leaderboard "YOU" row gets `--accent-soft` background + a 2px left border in `--accent`. NOT a saturated solid blue block.

### 2.2 Typography

**Font stack:**
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
/* For numbers/karma counts: 'Inter' with `font-variant-numeric: tabular-nums` */
```

**Type scale (mobile):**
| Token        | Size | Line | Weight | Use                         |
|--------------|------|------|--------|-----------------------------|
| display      | 32px | 38   | 700    | Onboarding hero only        |
| h1           | 24px | 30   | 700    | Screen titles               |
| h2           | 20px | 26   | 600    | Section headers             |
| h3           | 17px | 22   | 600    | List item titles, names     |
| body-l       | 15px | 22   | 400    | Standard body text          |
| body-m       | 14px | 20   | 400    | Secondary text              |
| caption      | 12px | 16   | 500    | Meta, timestamps, badges    |
| overline     | 11px | 14   | 600    | UPPERCASE LABELS (tracking +0.5px) |

**Rules:**
- Only weights 400, 500, 600, 700 — never 300 or 800.
- Letter-spacing: -0.01em on h1/h2 (tighten headings), 0 on body, +0.04em on overline.
- Line-height stays generous (1.4–1.5 for body) — don't crush text.

### 2.3 Spacing (4px base grid — no exceptions)

`4, 8, 12, 16, 20, 24, 32, 40, 48, 64`

**Standard padding:**
- Screen horizontal padding: **20px**
- Card padding: **16px**
- List item vertical padding: **14px**
- Section gap: **32px** between unrelated blocks, **20px** within a block
- Button padding: **14px vertical / 20px horizontal** for primary, **10px / 16px** for secondary

**Touch targets:** minimum **44×44px**. Bottom nav icons get **48×48px** tap area even if visual is smaller.

### 2.4 Radius

- Buttons: **12px**
- Inputs: **12px**
- Cards / list items: **16px**
- Avatars: **full (circle)**
- Pills / badges: **full**
- Bottom sheets: **24px top corners**
- Modals: **20px**

### 2.5 Elevation

- **Surfaces are lifted with background color, not shadows.** (`--bg-surface-1` over `--bg-base`)
- Use shadows ONLY for floating elements (FAB, modals, dropdowns, toasts).
- Borders > shadows for cards in dark mode.

### 2.6 Motion

- Standard easing: `cubic-bezier(0.16, 1, 0.3, 1)` (smooth out)
- Standard duration: **180ms** for micro-interactions, **240ms** for sheets, **320ms** for page transitions
- Button press: scale to **0.97** in 80ms
- NEVER use bounce/spring animations on UI chrome — that's toy energy

---

## 3. ICONOGRAPHY — STRICT RULES

- **Library:** Lucide React (or Phosphor if a glyph is missing). NOTHING ELSE.
- **Stroke width:** 1.75 (uniform across the app)
- **Sizes:** 16px (inline), 20px (default UI), 24px (nav, headers)
- **Color:** `--text-secondary` default, `--text-primary` on active/selected, `--accent` only for the active bottom-nav tab
- **NEVER USE EMOJI AS A UI ICON.** The following are BANNED from any button, tab, badge, card, or label:
  - 👑 🔥 ☕ 🌙 🎤 🎮 😂 ⚡ 💎 ⭐ 🚀 🏆 🎯 💰 🏠 🛒 🔔 📊 ✅ ❌
- **User-generated content** (chat messages, room descriptions, statuses) CAN contain emoji — that's the user's expression. UI chrome cannot.
- **Avatars:** Use a deterministic generated SVG avatar (e.g., DiceBear `shapes` or `glass` style) for users without a photo. NEVER use the crown emoji 👑 as an avatar — that's clipart.

---

## 4. COMPONENT LIBRARY (build these first, use everywhere)

### 4.1 Button

```
Variants:    primary | secondary | ghost | destructive
Sizes:       sm (36px) | md (44px) | lg (52px)
States:      default | hover | pressed | disabled | loading
```
- **Primary:** `--accent` background, `--text-inverse` label, no shadow, no gradient.
- **Secondary:** `--bg-surface-2` background, `--text-primary` label, 1px `--border-strong`.
- **Ghost:** transparent, `--text-primary`, hover gets `--bg-surface-2`.
- Loading state: replace label with a 16px spinner — keep button width fixed (no jumping).

### 4.2 Input — Text

- Height **48px**, radius **12px**
- Background `--bg-surface-2`, border 1px `--border-strong`
- Focus: border becomes `--accent`, plus `--accent-soft` ring (2px outside)
- Label sits ABOVE the input in `caption` style — no floating labels (Material trash)
- Helper text below in `--text-tertiary`, error text in `--danger`

### 4.3 Input — OTP (the boxes)

- 6 boxes, each **48×56px**, **8px gap** between them
- Background `--bg-surface-2`, border 1px `--border-subtle`
- **Filled state:** border becomes `--border-strong`, text in `--text-primary`, font-weight 600, size 22px
- **Focused state:** border `--accent` (2px), `--accent-soft` ring outside (4px), subtle scale to 1.02
- **Error state:** border `--danger`, gentle shake animation (3 oscillations, 4px amplitude, 320ms)
- Auto-advance on input, auto-back on backspace, paste-fill 6 digits at once

### 4.4 List Item (the workhorse)

```
[Avatar 44px]  [Title h3] ───────── [Meta caption]
               [Subtitle body-m]   [Badge / chevron]
```
- Vertical padding **14px**, horizontal **20px**
- Divider: 1px `--border-subtle` inset 76px from left (after avatar)
- Pressed state: `--bg-surface-1`
- **No double blue ticks.** No green online dots inline. (Telegram clone signal.) Use a small 8px dot in `--success` only on the avatar bottom-right when needed — never two indicators.

### 4.5 Bottom Navigation

- Height **64px** + safe-area inset
- Background `--bg-surface-1` with 1px top border `--border-subtle`
- 4–5 tabs max. Each tab: icon (24px) + label (caption, 11px)
- **Inactive:** icon `--text-tertiary`, label `--text-tertiary`
- **Active:** icon `--accent`, label `--text-primary` weight 600, plus a 3px wide × 3px tall pill indicator in `--accent` ABOVE the icon (not below)
- **Critical:** This must pass WCAG AA contrast in BOTH active and inactive states. Test it. The current app has invisible nav — that bug must die.

### 4.6 Top App Bar

- Height **56px**
- Title left-aligned in **h1** (or h2 if back button present)
- Action icons right, 24px, `--text-secondary`
- No background fill — sits on `--bg-base`. Adds 1px bottom border `--border-subtle` only when content scrolls under it.

### 4.7 Card

- Background `--bg-surface-1`, radius **16px**, padding **16px**
- 1px `--border-subtle` border (replaces shadow in dark mode)
- Hover/press: background `--bg-surface-2`

### 4.8 Badge / Pill

- Height **22px**, padding **0 10px**, radius **full**, caption text (12px/600)
- **Tier pills (LEGEND, MASTER, PRO, RISING):** subtle — `--bg-surface-2` background, `--text-secondary` text, **no neon colors, no gradient**. Differentiation is by a tiny 6px colored dot before the label.
- **Notification count:** circular, 18px min, `--accent` bg, `--text-inverse` text. Cap at "99+".

### 4.9 Avatar System

- Sizes: 32, 40, 44, 56, 80, 120
- Real photo OR generated SVG (DiceBear `glass` or `shapes` style, deterministic from user ID)
- Optional 2px ring in `--accent` for the current user
- Status dot (8px, `--success`/`--warning`/`--danger`) bottom-right with 2px `--bg-base` border for separation

### 4.10 Empty State

- 64px icon (Lucide, `--text-tertiary`), h2 title, body-m description, optional CTA button
- Centered, 320px max width

---

## 5. SCREEN-BY-SCREEN SPECIFICATIONS

### 5.1 Welcome / Onboarding (`/welcome`)

**Layout:**
- Top 40% of viewport: empty space + centered Orbit wordmark logo (NOT the basic blue-circle-in-blue-ring placeholder — design a real geometric mark, e.g., a circle with a small offset orbit dot)
- Tagline below: *"Your digital neighborhood."* in body-l, `--text-secondary`
- Three feature cards in a vertical stack (16px gap), each is a list-item-style row:
  - Icon (Lucide) in a 40×40 rounded square `--bg-surface-2`
  - Title (h3) + 1-line description (body-m, `--text-secondary`)
  - Examples: `MessageSquare → "Mood Rooms — vent, celebrate, connect"`, `Trophy → "Karma & Ranks — help, earn, rise"`, `Briefcase → "Skill Bazaar — sell talent, earn credits"`
  - **Zero emojis.** Lucide only.
- Bottom: primary button "Continue with Phone" (full-width, lg size)
- **reCAPTCHA fix:** Use **reCAPTCHA v3** (invisible). If you must use v2, add `body { padding-bottom: 80px; }` only on auth screens AND hide the badge with `.grecaptcha-badge { visibility: hidden; }`, then add the legally-required disclosure as a small inline line below the button: *"Protected by reCAPTCHA. [Privacy](#) · [Terms](#)"* in caption / `--text-tertiary`. The badge must NEVER overlap any CTA. This is non-negotiable.

### 5.2 Phone Number (`/phone`)

- Top app bar with back button only (no title)
- h1 "Enter your number"
- body-m description in `--text-secondary`
- Country selector (tappable pill: flag SVG + dial code) + phone input — joined into one rounded container, 56px tall
- Helper text below input
- Primary CTA at bottom (sticky), disabled until valid 10-digit number
- reCAPTCHA handled per 5.1 — no overlap, ever

### 5.3 OTP Entry (`/otp`)

- Same top bar pattern
- h1 "Enter the code"
- body-m: *"6-digit code sent to +91 8847593589"* with an inline "Edit" link in `--accent`
- 6 OTP boxes per spec 4.3 (with focus glow + auto-advance)
- Resend timer below in `--text-tertiary`, becomes a tappable "Resend code" in `--accent` when expired
- Primary CTA "Verify" sticky at bottom

### 5.4 Home / Rooms (`/rooms`)

**Anti-pattern alert:** This screen previously copied Telegram exactly (double ticks, green dots, identical row layout). REBUILD differently:

- Top app bar: title "Rooms" (h1) + search icon + new-chat icon (right)
- **Optional sticky banner** for live spotlight events — full-width pill card, `--bg-surface-1`, 1px `--accent` border, dismissible
- **Section: "Group Rooms"** (overline label, 16px top padding)
  - List items as per 4.4
  - Avatar shows room icon (Lucide in colored 44px rounded-square — color is the room's category color, used ONCE here)
  - Title = room name, subtitle = last message preview (single line, ellipsis)
  - Right side: timestamp (caption) on top, unread count badge (4.8) below
  - **No "256 online" green text** — that's Telegram chrome. If you want to show online count, put it as a tiny `caption` next to the room name in `--text-tertiary`.
- **Section: "Direct Messages"** (overline label)
  - Same list-item pattern
  - **Read state:** No double blue tick. Use a single 12px Lucide `Check` icon in `--text-tertiary` (sent), `Check` + `Check` overlapping in `--text-tertiary` (delivered), same in `--accent` (read). Or simpler: a small text label "Read" in caption. Pick ONE convention and stick to it.
- Pull-to-refresh: subtle, no bouncy animation
- FAB: bottom-right, 56px, `--accent`, Lucide `Plus` icon, opens "New room / New DM" sheet

### 5.5 Discover (`/discover`)

- Top app bar: title "Discover" + Credits chip on the right (pill: Lucide `Coins` + count, `--bg-surface-2`)
- Search bar (component 4.2) — pinned below header
- **Mood Rooms section:**
  - Overline "MOOD ROOMS" + "See all" link right
  - Horizontal scroll of cards, each **160×180px**
  - Card design: `--bg-surface-1`, 1px `--border-subtle`, 16px radius, 16px padding
  - Top: a Lucide icon (24px) in a 40×40 rounded `--bg-surface-2` — the icon represents the mood (e.g., `Moon` for Late Night, `Coffee` for Morning, `Smile` for Memes)
  - Title (h3, 2 lines max), online count (caption, `--text-tertiary`)
  - Bottom: tier pill (per 4.8) — subtle, no neon
  - Join button is a small ghost button at the bottom OR remove it and make the entire card tappable with a chevron — pick ONE
  - **DELETE the current cardboard-color-bombs.** All cards share the same surface treatment.
- **Weekly Challenges section:**
  - Overline + "Resets Sun" indicator (small caption, `--text-tertiary`, NOT a red pill)
  - Vertical list of challenge rows (component 4.4)
  - Right side: credit reward (caption, 12px/600, `--accent`) + small "Enter" ghost button OR a chevron — not both

### 5.6 Bazaar (`/bazaar`)

- Top app bar: "Bazaar" + filter icon
- Filter chips row (horizontal scroll, sticky): "All · Design · Code · Music · Writing · Gaming"
  - Chip = secondary button, sm size; active chip uses `--accent-soft` bg + `--accent` text + `--accent` border
- Grid of skill cards (2 columns on mobile, 12px gap)
- Card:
  - Cover image / illustration top (16:10 aspect, radius 12px)
  - h3 title, body-m description (2 lines max)
  - Bottom row: seller avatar (32px) + name (caption) — left side; price pill `--accent-soft` bg, `--accent` text — right side

### 5.7 Leaderboard / Ranks (`/ranks`)

- Top app bar: "Leaderboard"
- **Tabs:** Global · Weekly · Challenges (segment-style: 1px border container, active segment fills `--bg-surface-2`, inactive transparent)
- **Top 3 podium:** A clean 3-column row, NO medal-emoji (🥇🥈🥉). Use a small numbered badge (#1 in `--accent`, #2/#3 in `--text-secondary`) on top of each avatar (56px). Below: name (h3) + karma count (caption tabular-nums)
- **Ranked list below:**
  - List item: rank number left (`--text-tertiary`, w-8), avatar (40px), name (h3) + tier pill (subtle), karma right (h3, tabular-nums)
  - **YOU row:** background `--accent-soft`, 2px `--accent` left border (inset), tier pill becomes solid `--accent` with `--text-inverse` text. **NEVER** a fully-saturated solid blue block. The blue should whisper "this is you", not scream.
  - Sticky-pin the user's row to the top if scrolled out of view (subtle elevation `--shadow-sm`)

### 5.8 Profile / You (`/profile`)

- Top app bar: gear icon (settings) right
- Centered avatar **96px** — REAL avatar or DiceBear SVG, NOT 👑 emoji
- Name (h1), @handle (body-l, `--text-secondary`)
- Bio (body-m, `--text-primary`, max 2 lines)
- **Tier + flex row:** tier pill (subtle, per 4.8), rank "#1 Global" as inline link-styled text (`--accent`), streak as a small `Flame` Lucide icon + count (caption)
- **NO "LEGEND" tag in giant orange-bordered span. NO "🔥 7d streak" in red pill.** These are basic spans pretending to be UI. Refine into the structure above.
- **Stats row:** 4 columns — Karma · Posts · Watches · Credits. Each is: number (h2, tabular-nums) + label (overline, `--text-tertiary`). Separators are 1px `--border-subtle` vertical lines, NOT pipes.
- **Trust Score block** (`--bg-surface-1` card):
  - Header row: small `Shield` Lucide icon + "Trust Score" (overline) + score right (h2, color-coded: green/amber/red based on threshold, NOT just green always)
  - Progress bar: 6px tall, `--bg-surface-2` track, `--success`/`--warning`/`--danger` fill
  - body-m description below in `--text-secondary`
- **Orbit Card section** (the user's "ID card"):
  - A larger card preview, `--bg-surface-1` with a subtle gradient border (1px, very subtle, from `--accent` to `--accent-soft`)
  - Contains: avatar, name, handle, bio, tags as small ghost pills (NOT blue boxed pills — use `--bg-surface-2` bg, `--text-secondary` text)
  - 3-stat strip at bottom (Karma / Rank / Posts)
- Below: list of action rows (component 4.4) — Edit Profile, Settings, Notifications, Privacy, Help, Sign Out (last one in `--danger`)

### 5.9 Settings (`/settings`)

- Top app bar: back + "Settings" + search icon
- Grouped sections (overline labels)
- List item rows per 4.4, each with a small Lucide icon in a 32×32 rounded `--bg-surface-2` square (NOT colored neon icon tiles like Telegram does — keep it monochrome and quiet)

---

## 6. EXPLICIT FIXES FROM PREVIOUS ITERATION

| # | Issue                                                                 | Fix                                                                                                              |
|---|------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------|
| 1 | reCAPTCHA badge overlapping Verify/Continue buttons                   | Use reCAPTCHA v3 (invisible) OR hide v2 badge via CSS + show inline disclosure text. Test on 360px width.        |
| 2 | Bottom nav icons invisible (dark grey on dark blue)                   | Use the contrast tokens from §4.5 — verify with WCAG checker. Active tab gets `--accent`, label gets weight 600. |
| 3 | Emojis used as core UI icons (👑 🔥 ☕ 🌙 🎤 🎮 etc.)                  | Replace ALL with Lucide. Audit every file. Banned list is enforced — see §3.                                     |
| 4 | "Mood Rooms" cards — clashing neon backgrounds                        | All cards share `--bg-surface-1`. Differentiation by a 24px Lucide icon, not by background color.                |
| 5 | Leaderboard "YOU" row — saturated solid blue block breaking harmony   | Use `--accent-soft` bg + 2px `--accent` left border. The blue WHISPERS, not screams.                             |
| 6 | OTP boxes — basic squares with thin borders                           | Per §4.3 — focused state has accent ring + soft glow + scale 1.02. Filled state has weight 600, size 22px.       |
| 7 | "Ghost Player" profile — random tags ("LEGEND", "#1 Global") as spans | Per §5.8 — tier pill (subtle) + inline link-styled rank + flame streak. Designed system, not raw spans.          |
| 8 | Inconsistent spacing — claustrophobic layout                          | 4px grid enforced. Screen padding 20px. Section gaps 32px. NEVER 13px or 17px paddings.                          |
| 9 | Rooms screen identical to Telegram (double ticks, green dots)         | Per §5.4 — different read-state convention, no inline online dots, distinct visual hierarchy.                    |
|10 | Profile avatar = crown emoji 👑                                        | DiceBear SVG OR uploaded photo. The crown is BANNED as an avatar.                                                |

---

## 7. MICRO-INTERACTIONS (small, polished, restrained)

- **Button press:** scale 0.97, 80ms ease-out
- **Tab switch:** content fades out (120ms) → fades in (180ms), no horizontal slide
- **Page transition:** subtle vertical 8px slide-up + fade, 240ms
- **Pull-to-refresh:** custom indicator — 24px Lucide `RefreshCw` icon rotating with pull progress, no rubber-band overshoot
- **Skeleton loading:** rounded `--bg-surface-2` blocks with a subtle shimmer (1.4s loop, very low contrast — almost invisible). NEVER a Facebook-style aggressive shimmer.
- **Toast:** slides up from bottom with `--shadow-lg`, auto-dismiss 4s, swipe-down to dismiss
- **Bottom sheet:** slides up with backdrop blur (`backdrop-filter: blur(8px)`) over `rgba(0,0,0,0.5)`, drag handle 36×4px at top in `--border-strong`

---

## 8. ACCESSIBILITY (non-negotiable)

- All text-on-background pairs must pass **WCAG AA** (4.5:1 for body, 3:1 for large text). The previous nav was 1.8:1 — that's a failure.
- All interactive elements: minimum **44×44px** touch target.
- Focus states visible (2px `--accent` outline with 2px offset) for keyboard nav.
- Every icon-only button has an `aria-label`.
- Dynamic content updates announced via `aria-live` where appropriate (e.g., OTP error, toast).

---

## 9. ANTI-PATTERNS — DO NOT DO THESE (ever)

1. ❌ **Don't use multiple bright colors competing for attention.** One accent. That's the discipline.
2. ❌ **Don't add gradients on cards/buttons** unless explicitly specified. Flat surfaces win in 2026.
3. ❌ **Don't use emojis as UI icons.** See banned list §3. User content is fine; chrome is not.
4. ❌ **Don't use Material Design floating labels.** Labels go ABOVE inputs.
5. ❌ **Don't use bouncy/spring animations** on UI chrome. Smooth, not playful.
6. ❌ **Don't use the crown 👑 as an avatar.** Or any emoji as an avatar.
7. ❌ **Don't copy WhatsApp's signature green, Telegram's signature blue, or Discord's signature purple.** Orbit's accent is `#5B7FFF` — its own.
8. ❌ **Don't use double blue ticks.** Pick a different read-receipt convention.
9. ❌ **Don't show "256 online" / "51 online" as bright green text.** Quiet caption, `--text-tertiary`.
10. ❌ **Don't use 13px, 15px (except body), 17px (except h3), or other off-grid font sizes.** Stick to the scale.
11. ❌ **Don't put a giant purple "Amp up your profile" promo card** with neon dotted border on the profile screen. If a promo is needed, it's a single subtle list item with a `--accent` chevron.
12. ❌ **Don't use shadows in dark mode** for cards. Borders + surface lift only.

---

## 10. DELIVERABLES (produce in this order)

1. **`tokens.css`** — All CSS variables from §2 (colors, type, spacing, radius, shadow). This file is the foundation.
2. **`globals.css`** — Tailwind base + token mapping (`bg-surface-1` utility maps to `var(--bg-surface-1)`, etc.)
3. **`components/`** — All components from §4, each as its own file with TypeScript types and Storybook-style usage examples in comments
4. **`app/(auth)/welcome/page.tsx`**, **`/phone/page.tsx`**, **`/otp/page.tsx`** — auth flow
5. **`app/(main)/rooms/page.tsx`**, **`/discover/page.tsx`**, **`/bazaar/page.tsx`**, **`/ranks/page.tsx`**, **`/profile/page.tsx`** — main app
6. **`app/(main)/settings/page.tsx`** — settings
7. A **single HTML preview** (`preview.html`) that renders all components on one page so it can be reviewed at a glance before integration.

**Code rules:**
- Single-responsibility components, no God-files.
- All hard-coded colors / sizes BANNED — use tokens.
- TypeScript strict mode, no `any`.
- Mobile-first responsive (no desktop hover-only states).
- No console warnings. No accessibility warnings (axe-core clean).

---

## 11. SUCCESS CRITERIA (the smell test)

You will know the redesign succeeded when:

1. A WhatsApp/Discord/Telegram power user opens Orbit and **cannot identify which app it was inspired by**.
2. The bottom nav passes the "blink test" — every tab is clearly readable in 200ms.
3. There is **not a single emoji** in the app's chrome (toolbars, tabs, buttons, badges, avatars).
4. The leaderboard "YOU" row feels **personal but not loud**.
5. The profile screen feels like a **business card**, not a Pokémon trainer card.
6. A senior designer at Linear, Vercel, or Arc would say **"this is fine"** (which is the highest praise that crowd gives).
7. The reCAPTCHA never overlaps a CTA on any device width from 320px to 480px.

---

## 12. INSPIRATION (study, don't copy)

- **Linear** — type hierarchy, spacing rhythm, dark surface treatment
- **Arc Browser** — restraint, micro-interactions, color usage
- **Notion** — list density, neutral palette, icon usage
- **Things 3 (iOS)** — gesture polish, empty state design
- **Vercel Dashboard** — dark mode done right, component restraint
- **Apple Music** — typography in dark mode, card treatment

Do **NOT** browse Telegram, WhatsApp, or Discord while building. Their patterns are too close — you'll absorb them. Build from the design tokens up.

---

## 13. PROCESS

1. First, output the complete `tokens.css` file. STOP. Wait for review.
2. Then output the component library (one component per response if needed).
3. Then output screens, in the order listed in §10.
4. After all screens, output `preview.html` with everything assembled.
5. At each step, confirm: *"Have I used any banned emoji? Any off-grid spacing? Any hardcoded color? Any gradient I shouldn't have?"* — fix before moving on.

---

**Ship calm. Ship confident. Ship Orbit.**
