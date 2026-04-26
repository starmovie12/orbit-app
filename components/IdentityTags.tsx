/**
 * IdentityTags.tsx — components/IdentityTags.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * CROWD WORLD ke 8 identity tag components. Har ek HTML prototype ke exact
 * CSS class se 1:1 match karta hai.
 *
 * Source CSS → crowd_world_redesigned.html lines 145–152:
 *   .tag-colony       line 145  → ColonyTag
 *   .tag-verified     line 146  → VerifiedTag
 *   .tag-credits      line 147  → CreditsTag
 *   .tag-local        line 148  → LocalTag
 *   .tag-visitor      line 149  → VisitorTag
 *   .tag-ai           line 150  → AITag   ← NON-NEGOTIABLE #8: always visible
 *   .tag-moon         line 151  → MoonTag
 *   .tag-mayor-badge  line 152  → MayorTag  ← LinearGradient
 *
 * Tokens:
 *   orbitGold  ← @/constants/colors   (CSS :root variables ka RN mirror)
 *   FONT_BODY  ← @/constants/typography (DM Sans weight variants)
 *   FONT_SIZE  ← @/constants/typography (type scale)
 *
 * Usage:
 *   import { ColonyTag, VerifiedTag, AITag, MayorTag } from '@/components/IdentityTags';
 *
 *   <ColonyTag name="Sector 22" />
 *   <VerifiedTag />
 *   <CreditsTag amount="1.2k" />
 *   <LocalTag />
 *   <VisitorTag />
 *   <AITag />          ← mount karo, hide mat karo — ever
 *   <MoonTag />
 *   <MayorTag />
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from "react";
import {
  StyleSheet,
  Text,
  View,
  ViewStyle,
  TextStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { orbitGold }              from "@/constants/colors";
import { FONT_BODY, FONT_SIZE }   from "@/constants/typography";

// ─── Design Tokens ──────────────────────────────────────────────────────────
// HTML :root variables ko short aliases mein map kiya — ek jagah change karo,
// sab jagah reflect ho jaayega.

const C = {
  // --gold          → brand accent
  gold:         orbitGold.accent,           // "#C9A227"

  // --gold-deep     → text on light gold chips
  goldDeep:     orbitGold.accentHover,      // "#9A7A18"

  // --gold-light    → shimmer end of gradient
  goldLight:    orbitGold.goldLight,        // "#E8CC6A"

  // --gold-pale     → chip background (accentSoftSolid)
  goldPale:     orbitGold.accentSoftSolid,  // "#FFF9EC"

  // Mayor gradient warm end (HTML: #FFF3CD — not in tokens, hardcoded intentionally)
  goldPaleWarm: "#FFF3CD" as const,

  // --gold-border   → chip border
  goldBorder:   orbitGold.goldBorder,       // "#E2C660"

  // --text-mid      → colony name color
  textMid:      orbitGold.textSecond,       // "#6B5330"

  // Pure white
  white:        orbitGold.white,            // "#FFFFFF"
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 1. ColonyTag
// ─────────────────────────────────────────────────────────────────────────────
/**
 * .tag-colony
 * CSS: color:var(--text-mid); font-weight:700; max-width:80px;
 *      overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
 *
 * Colony name truncate ho jaata hai 80px se zyada ho toh.
 * HTML mein brackets ke saath aata hai: "[Dhanas]", "[Sec 22]"
 * Brackets bahar se pass karo ya naam directly — component dono accept karta hai.
 */
export interface ColonyTagProps {
  /** Colony ka naam, brackets optional: "Sector 22" ya "[Sector 22]" */
  name:   string;
  style?: ViewStyle;
}

export const ColonyTag = React.memo<ColonyTagProps>(({ name, style }) => {
  // Agar brackets nahi hain toh add karo — HTML convention ke saath consistent rahe
  const display = name.startsWith("[") ? name : `[${name}]`;

  return (
    <Text
      style={[s.colony, style as TextStyle]}
      numberOfLines={1}
      ellipsizeMode="tail"
      accessibilityLabel={`Colony: ${name}`}
    >
      {display}
    </Text>
  );
});
ColonyTag.displayName = "ColonyTag";

// ─────────────────────────────────────────────────────────────────────────────
// 2. VerifiedTag
// ─────────────────────────────────────────────────────────────────────────────
/**
 * .tag-verified
 * CSS: background:var(--gold); color:#FFF; width:14px; height:14px;
 *      display:inline-flex; align-items:center; justify-content:center;
 *      border-radius:50%; font-size:9px;
 *
 * Gold filled circle mein white checkmark. Verified user ki pehchaan.
 * Koi props nahi — sirf mount karo.
 */
export interface VerifiedTagProps {
  style?: ViewStyle;
}

export const VerifiedTag = React.memo<VerifiedTagProps>(({ style }) => (
  <View
    style={[s.verifiedCircle, style]}
    accessibilityLabel="Verified user"
    accessibilityRole="image"
  >
    {/* ✓ — HTML mein ✔ tha, React Native mein ✓ zyada consistent render hota hai */}
    <Text style={s.verifiedCheck} aria-hidden>✓</Text>
  </View>
));
VerifiedTag.displayName = "VerifiedTag";

// ─────────────────────────────────────────────────────────────────────────────
// 3. CreditsTag
// ─────────────────────────────────────────────────────────────────────────────
/**
 * .tag-credits
 * CSS: font-size:10px; background:var(--gold-pale); border:1px solid var(--gold-border);
 *      color:var(--gold-deep); padding:1px 5px; border-radius:6px; font-weight:700;
 *
 * HTML DOM mein: <span class="tag-credits">⚡ 1.2k</span>
 * ⚡ prefix baked in — tumhe sirf amount pass karna hai.
 */
export interface CreditsTagProps {
  /** Sirf amount: "1.2k", "420", "3.4k" — ⚡ symbol apne aap lagega */
  amount: string | number;
  style?: ViewStyle;
}

export const CreditsTag = React.memo<CreditsTagProps>(({ amount, style }) => (
  <View
    style={[s.creditsPill, style]}
    accessibilityLabel={`Credits: ${amount}`}
    accessibilityRole="text"
  >
    <Text style={s.creditsText}>⚡ {amount}</Text>
  </View>
));
CreditsTag.displayName = "CreditsTag";

// ─────────────────────────────────────────────────────────────────────────────
// 4. LocalTag
// ─────────────────────────────────────────────────────────────────────────────
/**
 * .tag-local
 * CSS: background:var(--gold-pale); border:1px solid var(--gold-border);
 *      color:var(--gold-deep); font-size:9px; font-weight:800; padding:2px 6px;
 *      border-radius:5px; text-transform:uppercase; letter-spacing:.4px;
 *
 * Is room ke shahar ka banda — "LOCAL" uppercase pill.
 * LocalTag aur VisitorTag exact same styling, alag text.
 */
export interface LocalTagProps {
  style?: ViewStyle;
}

export const LocalTag = React.memo<LocalTagProps>(({ style }) => (
  <View
    style={[s.pill, style]}
    accessibilityLabel="Local user"
    accessibilityRole="text"
  >
    <Text style={s.pillText}>LOCAL</Text>
  </View>
));
LocalTag.displayName = "LocalTag";

// ─────────────────────────────────────────────────────────────────────────────
// 5. VisitorTag
// ─────────────────────────────────────────────────────────────────────────────
/**
 * .tag-visitor
 * CSS: [LocalTag ke identical styles — exact same class properties]
 *      Text sirf "VISITOR" hai.
 *
 * Doosre shahar se aaya user — "VISITOR" uppercase pill.
 */
export interface VisitorTagProps {
  style?: ViewStyle;
}

export const VisitorTag = React.memo<VisitorTagProps>(({ style }) => (
  <View
    style={[s.pill, style]}
    accessibilityLabel="Visitor from another city"
    accessibilityRole="text"
  >
    <Text style={s.pillText}>VISITOR</Text>
  </View>
));
VisitorTag.displayName = "VisitorTag";

// ─────────────────────────────────────────────────────────────────────────────
// 6. AITag — ⚠️ NON-NEGOTIABLE #8
// ─────────────────────────────────────────────────────────────────────────────
/**
 * .tag-ai
 * CSS: background:var(--gold-pale); border:1px solid var(--gold-border);
 *      color:var(--gold-deep); font-size:9px; font-weight:800; padding:2px 6px;
 *      border-radius:5px; text-transform:uppercase; letter-spacing:.4px;
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ⚠️  NON-NEGOTIABLE #8 — W-002 FIX
 *     "Har AI message pe AI badge MANDATORY aur ALWAYS VISIBLE hona chahiye."
 *     Isko kabhi bhi conditionally render mat karo.
 *     `display: none` ya `opacity: 0` FORBIDDEN hai.
 *     Parent component is tag ko mount kare toh hamesha visible rahega.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * HTML mein CSS-enforced tha via ::before pseudo-element.
 * React Native mein pseudo-elements nahi hote, isliye yahan
 * explicitly render karte hain — lekin guarantee sirf parent pe hai.
 *
 * ✦ prefix = AI ka visual signal, instantly scannable.
 */
export interface AITagProps {
  style?: ViewStyle;
}

export const AITag = React.memo<AITagProps>(({ style }) => (
  <View
    style={[s.aiPill, style]}
    // Accessibility: screen readers ko clearly batao ye AI hai
    accessibilityLabel="AI — This message is from an AI"
    accessibilityRole="text"
    // testID for automated tests mein catch karne ke liye
    testID="ai-identity-tag"
  >
    <Text style={s.aiPillText}>✦ AI</Text>
  </View>
));
AITag.displayName = "AITag";

// ─────────────────────────────────────────────────────────────────────────────
// 7. MoonTag
// ─────────────────────────────────────────────────────────────────────────────
/**
 * .tag-moon
 * CSS: font-size:10px;
 *
 * Sirf 🌙 emoji — raat ke active users ya special night-owl status ke liye.
 * Ek Text node — koi wrapper View nahi, inline flow mein fit ho jaaye.
 */
export interface MoonTagProps {
  style?: ViewStyle;
}

export const MoonTag = React.memo<MoonTagProps>(({ style }) => (
  <Text
    style={[s.moon, style as TextStyle]}
    accessibilityLabel="Night owl — active at night"
    aria-hidden={false}
  >
    🌙
  </Text>
));
MoonTag.displayName = "MoonTag";

// ─────────────────────────────────────────────────────────────────────────────
// 8. MayorTag
// ─────────────────────────────────────────────────────────────────────────────
/**
 * .tag-mayor-badge
 * CSS: background:linear-gradient(135deg, var(--gold-pale), #FFF3CD);
 *      border:1px solid var(--gold-border); color:var(--gold-deep);
 *      font-size:8px; font-weight:800; padding:2px 6px;
 *      border-radius:5px; text-transform:uppercase; letter-spacing:.5px;
 *
 * LinearGradient use kiya kyunki expo-linear-gradient available hai
 * (ORBITCard.tsx aur Header.tsx mein already use ho raha hai).
 *
 * HTML DOM mein: <span class="tag-mayor-badge">👑 Mayor</span>
 * 👑 emoji prefix standard hai — override karne ka option diya hai.
 */
export interface MayorTagProps {
  /** Optional custom label — default: "👑 MAYOR" */
  label?: string;
  style?: ViewStyle;
}

export const MayorTag = React.memo<MayorTagProps>(({
  label = "👑 MAYOR",
  style,
}) => (
  // Outer View — border aur border-radius ke liye
  // LinearGradient directly borderRadius support karta hai
  <View style={[s.mayorWrapper, style]}>
    <LinearGradient
      // HTML: linear-gradient(135deg, var(--gold-pale), #FFF3CD)
      // gold-pale → #FFF9EC, warm end → #FFF3CD
      colors={[C.goldPale, C.goldPaleWarm]}
      start={{ x: 0, y: 0 }}   // 135deg ≈ top-left se bottom-right
      end={{ x: 1, y: 1 }}
      style={s.mayorGradient}
    >
      <Text style={s.mayorText}>{label}</Text>
    </LinearGradient>
  </View>
));
MayorTag.displayName = "MayorTag";

// ─────────────────────────────────────────────────────────────────────────────
// StyleSheet — Pixel-perfect match to HTML CSS
// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({

  // ── 1. ColonyTag ──────────────────────────────────────────────────────────
  // .tag-colony: color:var(--text-mid); font-weight:700; max-width:80px;
  //              overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  colony: {
    color:          C.textMid,                // --text-mid → #6B5330
    fontFamily:     FONT_BODY.bold,           // DM Sans 700
    fontWeight:     "700",
    fontSize:       FONT_SIZE.sm,             // 11px — .meta context mein readable
    maxWidth:       80,                       // max-width:80px — truncate ho jaata hai
    // numberOfLines={1} + ellipsizeMode="tail" handle karte hain overflow
  },

  // ── 2. VerifiedTag ────────────────────────────────────────────────────────
  // .tag-verified: background:var(--gold); color:#FFF; width:14px; height:14px;
  //                display:inline-flex; align-items:center; justify-content:center;
  //                border-radius:50%; font-size:9px;
  verifiedCircle: {
    backgroundColor: C.gold,                 // --gold → #C9A227
    width:           14,                     // exact 14px
    height:          14,                     // exact 14px
    borderRadius:    7,                      // 50% = half of 14px
    alignItems:      "center",
    justifyContent:  "center",
    // Subtle depth — circle flat nahi lagni chahiye
    shadowColor:     C.gold,
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.35,
    shadowRadius:    2,
    elevation:       2,                      // Android
  },
  verifiedCheck: {
    color:      C.white,                     // #FFF
    fontSize:   9,                           // font-size:9px
    fontFamily: FONT_BODY.extraBold,         // DM Sans 800 — checkmark bold dikhe
    fontWeight: "800",
    lineHeight: 13,                          // Vertical centering
    marginTop:  -0.5,                        // Fine-tune optical alignment
  },

  // ── 3. CreditsTag ─────────────────────────────────────────────────────────
  // .tag-credits: font-size:10px; background:var(--gold-pale);
  //               border:1px solid var(--gold-border); color:var(--gold-deep);
  //               padding:1px 5px; border-radius:6px; font-weight:700;
  creditsPill: {
    backgroundColor: C.goldPale,             // --gold-pale → #FFF9EC
    borderWidth:     1,
    borderColor:     C.goldBorder,           // --gold-border → #E2C660
    borderRadius:    6,                      // border-radius:6px
    paddingHorizontal: 5,                    // padding: 1px 5px (horizontal)
    paddingVertical:   1,                    // padding: 1px 5px (vertical)
    alignSelf:       "flex-start",           // Shrink wrap karo — flex-start
  },
  creditsText: {
    color:      C.goldDeep,                  // --gold-deep → #9A7A18
    fontSize:   10,                          // font-size:10px
    fontFamily: FONT_BODY.bold,              // DM Sans 700
    fontWeight: "700",
    lineHeight: 14,                          // Comfortable line height
  },

  // ── 4 & 5. Shared pill — LocalTag + VisitorTag same CSS ───────────────────
  // .tag-local / .tag-visitor:
  //   background:var(--gold-pale); border:1px solid var(--gold-border);
  //   color:var(--gold-deep); font-size:9px; font-weight:800; padding:2px 6px;
  //   border-radius:5px; text-transform:uppercase; letter-spacing:.4px;
  pill: {
    backgroundColor: C.goldPale,             // --gold-pale
    borderWidth:     1,
    borderColor:     C.goldBorder,           // --gold-border
    borderRadius:    5,                      // border-radius:5px
    paddingHorizontal: 6,                    // padding: 2px 6px
    paddingVertical:   2,
    alignSelf:       "flex-start",
  },
  pillText: {
    color:          C.goldDeep,              // --gold-deep
    fontSize:       FONT_SIZE.xs,            // 9px — font-size:9px exact
    fontFamily:     FONT_BODY.extraBold,     // DM Sans 800 — font-weight:800
    fontWeight:     "800",
    textTransform:  "uppercase",             // text-transform:uppercase
    letterSpacing:  0.4,                     // letter-spacing:.4px
    lineHeight:     13,
  },

  // ── 6. AITag — Non-Negotiable #8 ─────────────────────────────────────────
  // .tag-ai: [.tag-local ke identical CSS properties]
  // Alag style block rakha hai taaki future mein independent override ho sake.
  // Jaise: AI tag ko thoda darker/distinct banana ho toh alag style mein karo.
  aiPill: {
    backgroundColor: C.goldPale,             // --gold-pale (same as local)
    borderWidth:     1,
    borderColor:     C.goldBorder,
    borderRadius:    5,
    paddingHorizontal: 6,
    paddingVertical:   2,
    alignSelf:       "flex-start",
    // W-002 FIX: Extra visual prominence — AI ko stand out karna chahiye
    // Subtle inner shadow effect nahi hota RN mein, shadow bahar dete hain
    shadowColor:     C.gold,
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.15,
    shadowRadius:    2,
    elevation:       1,
  },
  aiPillText: {
    color:          C.goldDeep,
    fontSize:       FONT_SIZE.xs,            // 9px
    fontFamily:     FONT_BODY.extraBold,     // DM Sans 800
    fontWeight:     "800",
    textTransform:  "uppercase",
    letterSpacing:  0.4,
    lineHeight:     13,
  },

  // ── 7. MoonTag ───────────────────────────────────────────────────────────
  // .tag-moon: font-size:10px;
  // Sirf ek emoji — no wrapper, no border, no bg
  moon: {
    fontSize: 10,                            // font-size:10px exact
    lineHeight: 14,                          // Vertical alignment ke liye
  },

  // ── 8. MayorTag — LinearGradient wrapper ─────────────────────────────────
  // .tag-mayor-badge:
  //   background:linear-gradient(135deg, var(--gold-pale), #FFF3CD);
  //   border:1px solid var(--gold-border); color:var(--gold-deep);
  //   font-size:8px; font-weight:800; padding:2px 6px;
  //   border-radius:5px; text-transform:uppercase; letter-spacing:.5px;
  //
  // LinearGradient ke border ke liye wrapper View chahiye hota hai RN mein.
  mayorWrapper: {
    borderWidth:  1,
    borderColor:  C.goldBorder,              // --gold-border → #E2C660
    borderRadius: 5,                         // border-radius:5px
    alignSelf:    "flex-start",
    overflow:     "hidden",                  // Gradient edges clip ho jaayein
    // Premium mayor feel ke liye subtle elevation
    shadowColor:     C.gold,
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.18,
    shadowRadius:    3,
    elevation:       2,
  },
  mayorGradient: {
    paddingHorizontal: 6,                    // padding: 2px 6px
    paddingVertical:   2,
    borderRadius:      4,                    // Inner radius (wrapper mein 5 hai)
  },
  mayorText: {
    color:          C.goldDeep,              // --gold-deep → #9A7A18
    fontSize:       8,                       // font-size:8px — sabase chhota tag
    fontFamily:     FONT_BODY.extraBold,     // DM Sans 800
    fontWeight:     "800",
    textTransform:  "uppercase",
    letterSpacing:  0.5,                     // letter-spacing:.5px
    lineHeight:     12,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Convenience re-export — sab ek jagah se import ho sake
// import { ColonyTag, VerifiedTag, ... } from '@/components/IdentityTags'
// ─────────────────────────────────────────────────────────────────────────────

export {
  ColonyTag,
  VerifiedTag,
  CreditsTag,
  LocalTag,
  VisitorTag,
  AITag,
  MoonTag,
  MayorTag,
};
