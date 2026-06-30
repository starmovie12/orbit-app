/**
 * ThroneCard.js  â€”  The Dynamic Throne Banner (single React Native component)
 * ---------------------------------------------------------------------------
 * Faithful port of the first HTML "Throne Banner" design.
 *
 * Dependencies (both are standard in Expo / RN projects):
 *   expo install expo-linear-gradient
 *   expo install react-native-svg
 *
 * (Bare RN instead of Expo:  npm i react-native-linear-gradient react-native-svg
 *  then change the LinearGradient import line below.)
 *
 * Optional â€” exact brand fonts (Syne / Space Mono / Inter). Load them with
 * expo-font and set DISPLAY_FONT / NUMBER_FONT / BODY_FONT below. Without them
 * the component falls back to the system display + monospace faces.
 *
 * Usage:
 *   import ThroneCard from './ThroneCard';
 *   <ThroneCard avatarUri="https://.../ayesha.jpg" onReport={() => {}} />
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView,
  Image, useWindowDimensions, Platform, StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';

/* ----------------------------------------------------------------- fonts -- */
const DISPLAY_FONT = undefined; // set to 'Syne_800ExtraBold' once loaded
const NUMBER_FONT  = Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' });
const BODY_FONT    = undefined; // set to 'Inter_500Medium' once loaded

/* ----------------------------------------------------------------- palette */
const GOLD = {
  cream:   '#f7ecd0',
  yellow:  '#e8cc6a',
  classic: '#c9a227',
  deep:    '#9a7a18',
  light:   '#f5d770',
};
const INK = '#1a1a1a';
const INK_SOFT = '#6b5330';
const SURFACE_SUNKEN = '#f5f0e8';
const SURFACE_RAISED = '#fffdf4';
const HAIRLINE = '#ece2c8';

/* ---------------------------------------------------------------- the data */
const DATA = {
  Sector: {
    level: 1, ribbon: 'BARON',
    throne: 'THE THRONE OF SECTOR 17', title: 'BARON of Sector 17',
    holders: [
      { user: 'Naina_R', trust: 64, origin: 'Mohali',    cycles: 6, message: 'Sector 17 runs on trust, not noise.', msgTime: '40m ago', edited: false },
      { user: 'Aman.T',  trust: 60, origin: 'Zirakpur',  cycles: 4, message: 'Keep the streets honest.',            msgTime: '2h ago',  edited: false },
      { user: 'Priya_S', trust: 58, origin: 'Panchkula', cycles: 3, message: 'Small sector, big standards.',         msgTime: '6h ago',  edited: true  },
      { user: 'Vikram',  trust: 55, origin: 'Ambala',    cycles: 2, message: 'Earned, not given.',                   msgTime: '1d ago',  edited: false },
      { user: 'Sahil',   trust: 52, origin: 'Kharar',    cycles: 1, message: 'Day one. Watch me.',                   msgTime: '3d ago',  edited: false },
    ],
  },
  City: {
    level: 2, ribbon: 'VICEROY',
    throne: 'THE THRONE OF CHANDIGARH', title: 'Mayor (VICEROY) of Chandigarh',
    holders: [
      { user: 'AyeshaT',  trust: 87, origin: 'Patna',   cycles: 12, message: 'Loyalty is not given. It is built in silence, tested in storms, and proven in battle.', msgTime: '1h ago',     edited: false },
      { user: 'Rohan_K',  trust: 81, origin: 'Lucknow', cycles: 9,  message: 'Built the night-market alliance. Hold the line.',  msgTime: '3h ago',     edited: true  },
      { user: 'Meera.S',  trust: 78, origin: 'Bhopal',  cycles: 7,  message: 'Every cycle, earn it again.',                       msgTime: 'yesterday',  edited: false },
      { user: 'Dev_A',    trust: 74, origin: 'Indore',  cycles: 5,  message: 'Numbers do not lie. Show up.',                      msgTime: '2d ago',     edited: false },
      { user: 'Kabir99',  trust: 70, origin: 'Surat',   cycles: 4,  message: 'First throne. Will not be the last.',               msgTime: '5d ago',     edited: true  },
    ],
  },
  Country: {
    level: 3, ribbon: 'SOVEREIGN',
    throne: 'THE THRONE OF INDIA', title: 'SOVEREIGN of India',
    holders: [
      { user: 'AyeshaT', trust: 96, origin: 'Patna',  cycles: 28, message: 'A nation is a promise kept daily.', msgTime: '22m ago', edited: false },
      { user: 'Arjun_M', trust: 94, origin: 'Delhi',  cycles: 24, message: 'Hold the union. Serve it.',          msgTime: '5h ago',  edited: true  },
      { user: 'Ira.K',   trust: 91, origin: 'Mumbai', cycles: 19, message: 'Lead with the long view.',           msgTime: '1d ago',  edited: false },
      { user: 'Raghav',  trust: 89, origin: 'Jaipur', cycles: 15, message: 'Power is a loan. Repay it.',          msgTime: '3d ago',  edited: false },
      { user: 'Tara_99', trust: 86, origin: 'Pune',   cycles: 12, message: 'Built the first coalition.',          msgTime: '1w ago',  edited: false },
    ],
  },
  World: {
    level: 4, ribbon: 'IMPERATOR',
    throne: 'THE WORLD THRONE', title: 'IMPERATOR',
    holders: [
      { user: 'AyeshaT', trust: 99, origin: 'Patna',  cycles: 41, message: 'The world watches. Be worth watching.', msgTime: '9m ago', edited: false },
      { user: 'Orion_X', trust: 98, origin: 'Tokyo',  cycles: 37, message: 'One throne. Every horizon.',             msgTime: '4h ago', edited: true  },
      { user: 'Lumen',   trust: 97, origin: 'Berlin', cycles: 33, message: 'Restraint is the final luxury.',         msgTime: '2d ago', edited: false },
      { user: 'Sora_K',  trust: 95, origin: 'Seoul',  cycles: 29, message: 'Quiet power outlasts loud power.',       msgTime: '5d ago', edited: false },
      { user: 'Nova',    trust: 93, origin: 'Cairo',  cycles: 25, message: 'First Imperator. History starts here.',  msgTime: '2w ago', edited: false },
    ],
  },
};
const TABS = ['Sector', 'City', 'Country', 'World'];
const RANKS = ['CURRENT', '#2', '#3', '#4', '#5'];

/* per-tier glow strength (Sector â†’ World gets more luxurious) */
const GLOW = { Sector: 0.18, City: 0.30, Country: 0.42, World: 0.6 };

/* --------------------------------------------------------------- svg icons */
function Icon({ d, size = 22, stroke, fill = 'none', strokeWidth = 1.4, extra }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path d={d} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
      {extra}
    </Svg>
  );
}
const CROWN   = 'M3 8l4 4 5-7 5 7 4-4-2 11H5z';
const STAR    = 'M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z';
const PINLOC  = 'M12 21s-7-6.5-7-11a7 7 0 0114 0c0 4.5-7 11-7 11z';
const REFRESH = 'M20 11a8 8 0 10-2.3 6.3M20 5v6h-6';
const PUSHPIN = 'M9 4h6l-1 6 4 3H6l4-3-1-6z';
const FLAG    = 'M5 21V4h11l-2 4 2 4H5';
const SHIELD  = 'M12 3l7 3v5c0 5-3 7-7 9-4-2-7-4-7-9V6z';
const HEART   = 'M12 20s-7-4.5-7-9a4 4 0 017-2 4 4 0 017 2c0 4.5-7 9-7 9z';
const DIAMOND = 'M12 3l9 7-9 11-9-11z';

/* --------------------------------------------------------- design canvas -- */
const DW = 1120;   // design width  (the card's native pixel grid)
const DH = 600;    // design height

export default function ThroneCard({ avatarUri, onReport }) {
  const { width: screenW } = useWindowDimensions();
  const scale = Math.min((screenW - 24) / DW, 1);

  const [tab, setTab] = useState('City');
  const [idxMap, setIdxMap] = useState({ Sector: 0, City: 0, Country: 0, World: 0 });
  const [secs, setSecs] = useState(906);
  const [overlay, setOverlay] = useState(false);
  const [toast, setToast] = useState(false);
  const toastTimer = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setSecs(s => (s <= 0 ? 906 : s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const d = DATA[tab];
  const idx = idxMap[tab] || 0;
  const h = d.holders[idx];
  const accent = GOLD.classic;
  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, '0');

  const cycleHolder = () => setIdxMap(m => ({ ...m, [tab]: ((m[tab] || 0) + 1) % 5 }));
  const fireReport = () => {
    setToast(true);
    onReport && onReport(h);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(false), 2600);
  };

  return (
    <View style={styles.page}>
      {/* ---- Tabs (Row 2) ---- */}
      <View style={styles.tabsBar}>
        {TABS.map(name => {
          const active = name === tab;
          return (
            <TouchableOpacity
              key={name}
              activeOpacity={0.85}
              onPress={() => { setTab(name); setOverlay(false); }}
              style={[styles.tab, active && styles.tabActive]}
            >
              {active
                ? <LinearGradient colors={['#c9a227', '#9a7a18']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                : null}
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ---- scaled card ---- */}
      <View style={{ width: DW * scale, height: DH * scale, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: DW, height: DH, transform: [{ scale }] }}>
          <TouchableOpacity activeOpacity={0.96} onPress={cycleHolder} style={[styles.card, { shadowColor: accent, shadowOpacity: GLOW[tab] }]}>
            <LinearGradient colors={['#fffdf7', '#f4ecdb']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />

            {/* left gold band + crown */}
            <LinearGradient colors={[GOLD.light, GOLD.classic, GOLD.deep]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.band}>
              <View style={{ position: 'absolute', left: 21, top: 30 }}>
                <Icon d={CROWN} size={34} stroke="#fffdf7" strokeWidth={1.4} />
              </View>
            </LinearGradient>

            {/* diagonal streaks */}
            <LinearGradient colors={[GOLD.light, GOLD.classic]} start={{x:0,y:0}} end={{x:0,y:1}} style={[styles.streak, { left: 86,  top: 120, width: 9, height: 380, opacity: 0.95 }]} />
            <LinearGradient colors={[GOLD.yellow, GOLD.deep]}   start={{x:0,y:0}} end={{x:0,y:1}} style={[styles.streak, { left: 104, top: 150, width: 7, height: 350, opacity: 0.7 }]} />
            <LinearGradient colors={['#f7ecd0', GOLD.classic]}  start={{x:0,y:0}} end={{x:0,y:1}} style={[styles.streak, { left: 120, top: 185, width: 5, height: 315, opacity: 0.5 }]} />

            {/* avatar ring */}
            <LinearGradient colors={[GOLD.deep, GOLD.light, GOLD.classic, GOLD.deep]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.avatarRing}>
              <View style={styles.avatarInner}>
                {avatarUri
                  ? <Image source={{ uri: avatarUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  : <Icon d={CROWN} size={86} fill={GOLD.classic} stroke={GOLD.deep} strokeWidth={0.7} />}
              </View>
            </LinearGradient>

            {/* crown orb badge */}
            <LinearGradient colors={[GOLD.deep, GOLD.light, GOLD.classic, GOLD.deep]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.orb}>
              <View style={styles.orbInner}>
                <Icon d={CROWN} size={34} fill={GOLD.classic} stroke={GOLD.deep} strokeWidth={0.8} />
              </View>
            </LinearGradient>

            {/* tier ribbon */}
            <View style={[styles.ribbon, { backgroundColor: accent }]}>
              <Text style={styles.ribbonText}>{d.ribbon}</Text>
            </View>

            {/* ---------------- right content ---------------- */}
            <View style={styles.content}>
              {/* eyebrow */}
              <View style={styles.eyebrow}>
                <Text style={{ color: accent, fontSize: 14 }}>âœ¦</Text>
                <Text style={styles.eyebrowText}>{d.throne}</Text>
                <Text style={{ color: accent, fontSize: 14 }}>âœ¦</Text>
              </View>
              {/* username */}
              <Text style={styles.username}>@{h.user}</Text>
              {/* title */}
              <Text style={styles.title}>{d.title}</Text>
              <LinearGradient colors={[accent, 'rgba(201,162,39,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.underline} />

              {/* stat rows */}
              <View style={{ marginTop: 4, gap: 14 }}>
                <StatRow icon={<Icon d={STAR} stroke={accent} />}>
                  <Text style={styles.statText}>Trust <Text style={styles.statNum}>{h.trust}</Text></Text>
                </StatRow>
                <StatRow icon={<Icon d={PINLOC} stroke={accent} extra={<Circle cx="12" cy="10" r="2.5" fill="none" stroke={accent} strokeWidth="1.4" />} />}>
                  <Text style={styles.statText}>originally from <Text style={{ color: accent, fontWeight: '600' }}>{h.origin}</Text></Text>
                </StatRow>
                <StatRow icon={<Icon d={REFRESH} stroke={accent} />}>
                  <Text style={styles.statText}>held <Text style={styles.statNum}>{h.cycles}</Text> cycles</Text>
                </StatRow>
              </View>

              {/* pinned message */}
              <View style={styles.pinned}>
                <View style={styles.pinnedHead}>
                  <Icon d={PUSHPIN} size={16} stroke={accent} strokeWidth={1.5} extra={<Path d="M12 13v7" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />} />
                  <Text style={styles.pinnedLabel}>Pinned Message</Text>
                </View>
                <Text style={styles.pinnedMsg}>{h.message}</Text>
                <View style={styles.pinnedMeta}>
                  <Text style={styles.pinnedTime}>Â· {h.msgTime}</Text>
                  {h.edited ? <Text style={styles.editedTag}>(edited)</Text> : null}
                </View>
              </View>
            </View>

            {/* ---------------- next battle (bottom-left) ---------------- */}
            <View style={styles.battle}>
              <Text style={styles.battleLabel}>NEXT BATTLE</Text>
              <Text style={styles.battleTime}>{mm}m {ss}s</Text>
              <Text style={styles.battleLabel}>LEFT</Text>
              <View style={styles.barTrack}>
                <LinearGradient colors={[accent, GOLD.light]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.barFill} />
              </View>
            </View>

            {/* ---------------- right rail: 5 lines + icons ---------------- */}
            <View style={styles.rail}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16, height: 300 }}>
                {[ [300, 1], [284, 0.82], [266, 0.62], [240, 0.42], [208, 0.24] ].map(([hgt, op], i) => (
                  <LinearGradient key={i} colors={[accent, 'rgba(201,162,39,0)']} start={{x:0,y:0}} end={{x:0,y:1}} style={{ width: 2, height: hgt, opacity: op }} />
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 14, marginTop: 14, opacity: 0.7 }}>
                {[CROWN, SHIELD, HEART, STAR, DIAMOND].map((p, i) => (
                  <Icon key={i} d={p} size={16} stroke={accent} strokeWidth={1.3} />
                ))}
              </View>
            </View>

            {/* pin-list button (opens all-pinned screen) */}
            <TouchableOpacity activeOpacity={0.85} onPress={() => setOverlay(true)} style={styles.pinBtn}>
              <Icon d={PUSHPIN} size={18} stroke={accent} strokeWidth={1.6} extra={<Path d="M12 12v6" stroke={accent} strokeWidth="1.6" strokeLinecap="round" />} />
              <View style={{ gap: 3 }}>
                <View style={styles.pinLine} /><View style={styles.pinLine} /><View style={styles.pinLine} />
              </View>
            </TouchableOpacity>

            {/* report pill */}
            <TouchableOpacity activeOpacity={0.85} onPress={fireReport} style={[styles.report, { borderColor: accent }]}>
              <Icon d={FLAG} size={15} stroke={toast ? GOLD.deep : INK_SOFT} strokeWidth={1.6} />
              <Text style={[styles.reportText, { color: toast ? GOLD.deep : INK_SOFT }]}>{toast ? 'REPORTED' : 'REPORT'}</Text>
            </TouchableOpacity>

            {/* holder tag */}
            <Text style={styles.holderTag}>
              {idx === 0 ? 'REIGNING HOLDER' : 'FORMER HOLDER ' + RANKS[idx]} Â· tap card for past holders
            </Text>

            {/* report toast */}
            {toast ? (
              <View style={styles.toast}>
                <Text style={styles.toastText}>Report submitted to the Council âœ“</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.caption}>
        Switch tabs to change tier Â· tap the card to cycle past holders Â· tap the pin icon for all pinned messages
      </Text>

      {/* ===================== ALL PINNED MESSAGES MODAL ===================== */}
      <Modal visible={overlay} transparent animationType="fade" onRequestClose={() => setOverlay(false)}>
        <View style={styles.modalScrim}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHead}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Icon d={PUSHPIN} size={20} stroke={accent} strokeWidth={1.6} extra={<Path d="M12 12v6" stroke={accent} strokeWidth="1.6" strokeLinecap="round" />} />
                <Text style={styles.modalTitle}>Pinned Â· {d.throne}</Text>
              </View>
              <TouchableOpacity onPress={() => setOverlay(false)} style={styles.modalClose}>
                <Text style={{ color: INK_SOFT, fontSize: 18 }}>âœ•</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ gap: 10, paddingVertical: 6 }}>
              {d.holders.map((x, i) => (
                <View key={i} style={[styles.holderRow, { borderLeftColor: accent }]}>
                  <View style={styles.holderRank}>
                    <Text style={{ color: accent, fontWeight: '800', fontSize: 11 }}>{RANKS[i]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
                      <Text style={{ color: INK, fontWeight: '700', fontSize: 15 }}>@{x.user}</Text>
                      <Text style={{ color: INK_SOFT, fontSize: 12 }}>{d.title}</Text>
                    </View>
                    <Text style={{ color: INK_SOFT, fontSize: 14, marginTop: 3 }}>{x.message}</Text>
                    <Text style={{ color: accent, fontFamily: NUMBER_FONT, fontSize: 11, marginTop: 5 }}>Â· {x.msgTime}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* small helper: icon-chip + text row */
function StatRow({ icon, children }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <View style={styles.statChip}>{icon}</View>
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ styles */
const styles = StyleSheet.create({
  page: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 12, backgroundColor: '#f3ead6', gap: 22 },

  /* tabs */
  tabsBar: { flexDirection: 'row', gap: 6, backgroundColor: SURFACE_SUNKEN, borderWidth: 1, borderColor: HAIRLINE, borderRadius: 999, padding: 5 },
  tab: { paddingVertical: 9, paddingHorizontal: 22, borderRadius: 999, overflow: 'hidden' },
  tabActive: {},
  tabText: { color: INK_SOFT, fontWeight: '800', fontSize: 14, fontFamily: BODY_FONT },
  tabTextActive: { color: '#fffdf4' },

  /* card shell */
  card: {
    width: DW, height: DH, borderRadius: 30, borderWidth: 2, borderColor: GOLD.classic,
    backgroundColor: '#f4ecdb', overflow: 'hidden',
    shadowOffset: { width: 0, height: 0 }, shadowRadius: 44, elevation: 14,
  },
  band: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 76 },
  streak: { position: 'absolute', borderRadius: 4, transform: [{ skewX: '-13deg' }] },

  avatarRing: {
    position: 'absolute', left: 138, top: 158, width: 250, height: 250, borderRadius: 125,
    padding: 13, alignItems: 'center', justifyContent: 'center',
  },
  avatarInner: {
    width: '100%', height: '100%', borderRadius: 125, overflow: 'hidden',
    backgroundColor: '#efe6cf', borderWidth: 3, borderColor: SURFACE_RAISED,
    alignItems: 'center', justifyContent: 'center',
  },
  orb: {
    position: 'absolute', left: 218, top: 118, width: 84, height: 84, borderRadius: 42,
    padding: 7, alignItems: 'center', justifyContent: 'center',
    shadowColor: GOLD.deep, shadowOpacity: 0.5, shadowOffset: { width: 0, height: 6 }, shadowRadius: 12, elevation: 8,
  },
  orbInner: { width: '100%', height: '100%', borderRadius: 42, backgroundColor: '#fef9ec', alignItems: 'center', justifyContent: 'center' },

  ribbon: { position: 'absolute', right: 0, top: 34, paddingVertical: 6, paddingLeft: 16, paddingRight: 22, borderTopLeftRadius: 999, borderBottomLeftRadius: 999 },
  ribbonText: { color: '#fffdf4', fontWeight: '800', fontSize: 11, letterSpacing: 2, fontFamily: BODY_FONT },

  /* right content */
  content: { position: 'absolute', left: 392, top: 40, width: 592 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12 },
  eyebrowText: { color: GOLD.classic, fontWeight: '800', fontSize: 11, letterSpacing: 3, fontFamily: BODY_FONT },
  username: { fontSize: 62, fontWeight: '800', color: INK, letterSpacing: -1, fontFamily: DISPLAY_FONT },
  title: { fontSize: 24, fontWeight: '800', color: INK_SOFT, marginTop: 8, fontFamily: DISPLAY_FONT },
  underline: { width: 130, height: 3, borderRadius: 2, marginTop: 10, marginBottom: 20 },

  statChip: { width: 46, height: 46, borderRadius: 23, backgroundColor: SURFACE_SUNKEN, alignItems: 'center', justifyContent: 'center' },
  statText: { fontSize: 21, color: INK, fontFamily: BODY_FONT },
  statNum: { fontFamily: NUMBER_FONT, fontWeight: '700', color: GOLD.classic },

  pinned: { marginTop: 22, width: 520, backgroundColor: SURFACE_SUNKEN, borderWidth: 1, borderColor: HAIRLINE, borderRadius: 16, padding: 16 },
  pinnedHead: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 6 },
  pinnedLabel: { fontWeight: '700', fontSize: 12, color: INK, letterSpacing: 0.3, fontFamily: BODY_FONT },
  pinnedMsg: { fontSize: 16, lineHeight: 23, color: INK_SOFT, maxWidth: 440, fontFamily: BODY_FONT },
  pinnedMeta: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 6, marginTop: 8 },
  pinnedTime: { fontFamily: NUMBER_FONT, fontWeight: '700', fontSize: 12, color: GOLD.classic },
  editedTag: { fontWeight: '600', fontSize: 10, color: INK_SOFT, fontFamily: BODY_FONT },

  /* next battle */
  battle: { position: 'absolute', left: 150, top: 438, width: 300 },
  battleLabel: { fontWeight: '800', fontSize: 11, letterSpacing: 2, color: GOLD.classic, fontFamily: BODY_FONT },
  battleTime: { fontFamily: NUMBER_FONT, fontWeight: '700', fontSize: 46, letterSpacing: -1, color: INK, marginVertical: 2 },
  barTrack: { marginTop: 14, width: 280, height: 3, borderRadius: 2, backgroundColor: HAIRLINE, overflow: 'hidden' },
  barFill: { width: '42%', height: '100%' },

  /* right rail */
  rail: { position: 'absolute', right: 34, top: 62, alignItems: 'center' },

  pinBtn: {
    position: 'absolute', right: 118, bottom: 96, width: 64, height: 56, borderRadius: 14,
    backgroundColor: SURFACE_RAISED, borderWidth: 1, borderColor: GOLD.classic,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  pinLine: { width: 14, height: 2, borderRadius: 2, backgroundColor: GOLD.classic },

  report: {
    position: 'absolute', right: 34, bottom: 36, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 11, paddingHorizontal: 26, borderRadius: 999, backgroundColor: SURFACE_RAISED, borderWidth: 1,
  },
  reportText: { fontWeight: '800', fontSize: 14, letterSpacing: 1, fontFamily: BODY_FONT },

  holderTag: { position: 'absolute', left: 392, bottom: 18, fontWeight: '600', fontSize: 10, letterSpacing: 1, color: '#c4b090', fontFamily: BODY_FONT },

  toast: { position: 'absolute', alignSelf: 'center', bottom: 26, backgroundColor: INK, paddingVertical: 10, paddingHorizontal: 22, borderRadius: 999 },
  toastText: { color: '#fffdf4', fontSize: 14, fontFamily: BODY_FONT },

  caption: { fontSize: 13, color: INK_SOFT, textAlign: 'center', maxWidth: 520, fontFamily: BODY_FONT },

  /* modal */
  modalScrim: { flex: 1, backgroundColor: 'rgba(26,26,26,0.45)', justifyContent: 'center', padding: 18 },
  modalSheet: { backgroundColor: '#fdf7e9', borderRadius: 22, borderWidth: 1, borderColor: GOLD.classic, maxHeight: '80%', padding: 20 },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: HAIRLINE, paddingBottom: 14, marginBottom: 10 },
  modalTitle: { fontWeight: '800', fontSize: 18, color: INK, fontFamily: DISPLAY_FONT },
  modalClose: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: HAIRLINE, backgroundColor: SURFACE_RAISED, alignItems: 'center', justifyContent: 'center' },
  holderRow: { flexDirection: 'row', gap: 14, padding: 14, backgroundColor: SURFACE_RAISED, borderWidth: 1, borderColor: '#efe6cf', borderLeftWidth: 4, borderRadius: 14 },
  holderRank: { width: 42, height: 42, borderRadius: 21, backgroundColor: SURFACE_SUNKEN, alignItems: 'center', justifyContent: 'center' },
});
