/**
 * CROWD WORLD — Mock Data Seed  (constants/data.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 * Central mock-data source for ALL screens.
 *
 * Rules:
 * • icon fields → Feather icon names ONLY (never emoji as icon key)
 * • accent      → hex tint for icons/stripes ONLY (no background fills)
 * • Emojis ONLY inside user-generated `preview` / `text` / `body` strings
 * • All Chandigarh sector references are real geography
 * • Strictly adheres to types/cw.ts
 */

import type {
  CWTransaction,
  CWNotification,
  CWDiscoverPost,
  CWSavedMessage,
} from '@/types/cw';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — ROOMS, DMs, MOOD, CHALLENGES
// ─────────────────────────────────────────────────────────────────────────────

export const ROOMS = [
  { id: 'live1', icon: 'radio',          accent: '#E5484D', name: 'Live: Pitch Night',     preview: '48 listening · host earning 96 credits',     time: 'LIVE',      unread: 0,  online: 48,  muted: false, isLive: true,  liveEarning: '96/hr' },
  { id: '1',     icon: 'moon',           accent: '#8B5CF6', name: 'Late Night Feels',      preview: 'ghost_player: bhai sad lag raha...',          time: 'now',       unread: 12, online: 223, muted: false, isLive: false },
  { id: '2',     icon: 'target',         accent: '#E8A33D', name: 'Gaming Clutch Week',    preview: 'neo_gamer: ye kya tha yrr',                   time: '2m',        unread: 4,  online: 312, muted: false, isLive: false },
  { id: '3',     icon: 'briefcase',      accent: '#5B7FFF', name: 'Skill Bazaar',          preview: 'react freelancer chahiye ₹800/day',           time: '5m',        unread: 3,  online: 94,  muted: false, isLive: false, typing: 'noor_bhai' },
  { id: '4',     icon: 'music',          accent: '#2BB673', name: 'Music Junction',        preview: 'new_artist99: Check out my latest track',     time: '13m',       unread: 0,  online: 187, muted: false, isLive: false },
  { id: '5',     icon: 'camera',         accent: '#5B7FFF', name: 'Creative Studio',       preview: 'Photo',                                       time: 'Yesterday', unread: 3,  online: 256, muted: true,  isLive: false },
  { id: '6',     icon: 'send',           accent: '#2BB673', name: 'Startup Circle',        preview: 'sk_promo99: Series A announcement coming…',   time: 'Mon',       unread: 0,  online: 51,  muted: false, isLive: false },
];

export const DM_CHATS = [
  { id: 'd1', name: 'Aryan Verma',  preview: 'Bhai kal milte hain?',           time: '14:44',     unread: 2, status: 'received',  online: true  },
  { id: 'd2', name: 'Priya Singh',  preview: 'Thanks for the tip!',            time: '13:20',     unread: 0, status: 'read',      online: false },
  { id: 'd3', name: 'Rahul Sharma', preview: 'Voice note (0:12)',              time: '11:55',     unread: 0, status: 'delivered', online: true  },
  { id: 'd4', name: 'Sneha Kapoor', preview: 'Kab aaugi tum?',                 time: '10:30',     unread: 5, status: 'received',  online: false },
  { id: 'd5', name: 'Dev Nair',     preview: 'OK done',                        time: 'Yesterday', unread: 0, status: 'read',      online: false },
];

export const INBOX_CHATS = DM_CHATS.map(d => ({ ...d, color: '#5B7FFF' }));

export const MOOD_ROOMS = [
  { id: 'm1', icon: 'moon',          accent: '#8B5CF6', name: 'Late Night Feels',  members: 223, tag: 'Venting OK' },
  { id: 'm2', icon: 'coffee',        accent: '#E8A33D', name: 'Morning Motivation',members: 178, tag: 'Energy'     },
  { id: 'm3', icon: 'smile',         accent: '#2BB673', name: 'Meme Drop Zone',    members: 541, tag: 'Trending'   },
  { id: 'm4', icon: 'zap',           accent: '#5B7FFF', name: 'Grind Mode ON',     members: 312, tag: 'Focus'      },
  { id: 'm5', icon: 'heart',         accent: '#E5484D', name: 'Vent & Heal',       members: 96,  tag: 'Safe Space' },
];

export const WEEKLY_CHALLENGES = [
  { id: 'c1', icon: 'mic',           title: 'Best Desi Rap Verse',      entries: 84,  prize: 1000, ends: '2d 14h', category: 'Music'   },
  { id: 'c2', icon: 'camera',        title: 'Street Photography Delhi', entries: 62,  prize: 750,  ends: '1d 6h',  category: 'Art'     },
  { id: 'c3', icon: 'target',        title: 'Clutch Play of the Week',  entries: 137, prize: 500,  ends: '3d 2h',  category: 'Gaming'  },
  { id: 'c4', icon: 'zap',           title: 'Startup Pitch (60s)',      entries: 29,  prize: 2000, ends: '4d 10h', category: 'Business'},
];

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — BAZAAR, CATEGORIES, RANKS
// ─────────────────────────────────────────────────────────────────────────────

export const BAZAAR_GIGS = [
  { id: 'g1', icon: 'pen-tool',     accent: '#5B7FFF', category: 'Design',   title: 'Professional Logo Design',          seller: 'designwala',   price: 500,  rating: 4.9, reviews: 142, delivery: '2 days',   tags: ['Logo', 'Branding']    },
  { id: 'g2', icon: 'edit-3',       accent: '#5B7FFF', category: 'Writing',  title: 'Resume + LinkedIn Makeover',        seller: 'career_ninja', price: 299,  rating: 4.8, reviews: 87,  delivery: '1 day',    tags: ['Resume', 'Career']    },
  { id: 'g3', icon: 'code',         accent: '#5B7FFF', category: 'Dev',      title: 'React Website in 3 Days',           seller: 'code_rk',      price: 1999, rating: 4.7, reviews: 53,  delivery: '3 days',   tags: ['React', 'Fullstack']  },
  { id: 'g4', icon: 'trending-up',  accent: '#5B7FFF', category: 'Social',   title: 'Instagram Growth Strategy Pack',    seller: 'viral_pj',     price: 399,  rating: 4.6, reviews: 201, delivery: '1 day',    tags: ['Instagram', 'Growth'] },
  { id: 'g5', icon: 'film',         accent: '#5B7FFF', category: 'Video',    title: 'Reels Editing — Cinematic Style',   seller: 'cutmaster_x',  price: 799,  rating: 4.9, reviews: 76,  delivery: '2 days',   tags: ['Reels', 'Editing']    },
  { id: 'g6', icon: 'mic',          accent: '#5B7FFF', category: 'Audio',    title: 'Voiceover — Hindi/English',         seller: 'voice_aryan',  price: 349,  rating: 4.7, reviews: 118, delivery: '1 day',    tags: ['Voiceover', 'Hindi']  },
  { id: 'g7', icon: 'bar-chart-2',  accent: '#5B7FFF', category: 'Business', title: 'Pitch Deck Design (10 slides)',     seller: 'deck_pro99',   price: 1499, rating: 4.8, reviews: 34,  delivery: '3 days',   tags: ['Pitch', 'Startup']    },
  { id: 'g8', icon: 'image',        accent: '#5B7FFF', category: 'Design',   title: 'Thumbnail Design for YouTube',      seller: 'thumb_king',   price: 149,  rating: 4.5, reviews: 312, delivery: 'Same day', tags: ['YouTube', 'Thumbnail']},
];

export const BAZAAR_CATEGORIES = ['All', 'Design', 'Dev', 'Writing', 'Social', 'Video', 'Audio', 'Business'];

export const RANKS_DATA = [
  { id: '1',  rank: 1,  icon: 'award',      name: 'ghost_player', karma: 9820, badge: 'CROWN',   trophies: ['top1', 'streak', 'star', 'diamond'], weeklyKarma: 1240 },
  { id: '2',  rank: 2,  icon: 'zap',        name: 'sk_promo99',   karma: 8741, badge: 'FOUNDER', trophies: ['top1', 'streak', 'diamond'],         weeklyKarma: 980  },
  { id: '3',  rank: 3,  icon: 'activity',   name: 'new_artist99', karma: 7654, badge: 'MAYOR',   trophies: ['streak', 'diamond'],                 weeklyKarma: 870  },
  { id: '4',  rank: 4,  icon: 'hexagon',    name: 'lens_wala',    karma: 6210, badge: undefined, trophies: ['diamond'],                           weeklyKarma: 650  },
  { id: '5',  rank: 5,  icon: 'star',       name: 'aimgod_47',    karma: 5890, badge: undefined, trophies: ['star'],                              weeklyKarma: 540  },
  { id: '6',  rank: 6,  icon: 'target',     name: 'tech_orbit',   karma: 4320, badge: undefined, trophies: ['star'],                              weeklyKarma: 420  },
  { id: '7',  rank: 7,  icon: 'send',       name: 'beats_by_rk',  karma: 3850, badge: undefined, trophies: [],                                    weeklyKarma: 390  },
  { id: '8',  rank: 8,  icon: 'compass',    name: 'freelancer_x', karma: 3210, badge: undefined, trophies: [],                                    weeklyKarma: 310  },
  { id: '9',  rank: 9,  icon: 'target',     name: 'noor_bhai',    karma: 2740, badge: undefined, trophies: [],                                    weeklyKarma: 280  },
  { id: '10', rank: 10, icon: 'camera',     name: 'orbit_user01', karma: 2100, badge: undefined, trophies: [],                                    weeklyKarma: 210  },
];

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — MY_PROFILE
// ─────────────────────────────────────────────────────────────────────────────

export const MY_PROFILE = {
  name: 'ghost_player',
  displayName: 'Ghost Player',
  handle: '@ghost_player',
  avatarSeed: 'ghost_player',
  karma: 9820,
  rank: 1,
  credits: 142,
  watchCredits: 142,
  badge: 'FOUNDER', // Fixed
  trustScore: 96,
  joined: 'Jan 2025',
  posts: 142,
  watches: 3410,
  bio: 'DM for collabs · Chandigarh · CS + Design',
  region: 'Punjab',
  language: 'Hindi',
  trophies: ['top1', 'streak', 'star', 'diamond'],
  streak: 7,
  achievements: [
    { icon: 'award',    label: 'First Place',  desc: 'Top #1 on the Leaderboard'     },
    { icon: 'activity', label: 'On Fire',       desc: '7-day posting streak'          },
    { icon: 'hexagon',  label: 'Diamond',       desc: '5000+ Karma points earned'     },
    { icon: 'star',     label: 'Star Creator',  desc: '100+ Discover posts uploaded'  },
    { icon: 'users',    label: 'Connector',     desc: 'Sent 500+ DMs via Message'     },
  ],
  skills: ['React', 'UI Design', 'Startup', 'Gaming'],
};

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — MOCK_TRANSACTIONS
// ─────────────────────────────────────────────────────────────────────────────

const _TX_SEED = new Date('2026-04-29T14:32:00+05:30').getTime();
const _H       = 3_600_000;
const _DAY     = 86_400_000;

export const MOCK_TRANSACTIONS: CWTransaction[] = [
  { id: 'txn-001', type: 'credit', amount: 750, description: 'Challenge prize — Street Photography Delhi', icon: 'award', status: 'completed', createdAtMs: _TX_SEED - 2 * _H },
  { id: 'txn-002', type: 'cashout', amount: 1000, description: 'Cashout ₹100 → ghost@paytm', icon: 'arrow-up-circle', status: 'completed', createdAtMs: _TX_SEED - 8 * _H },
  { id: 'txn-003', type: 'credit', amount: 15, description: 'Watched 3 sponsored posts · Sector 17', icon: 'play-circle', status: 'completed', createdAtMs: _TX_SEED - 14 * _H },
  { id: 'txn-004', type: 'debit', amount: 20, description: 'Spotlight bid · Discover top slot', icon: 'zap', status: 'completed', createdAtMs: _TX_SEED - 18 * _H },
  { id: 'txn-005', type: 'pass', amount: 500, description: 'CROWN Pass purchased · Lifetime access', icon: 'award', status: 'completed', createdAtMs: _TX_SEED - _DAY - 4 * _H },
  { id: 'txn-006', type: 'credit', amount: 2000, description: 'Challenge won — Startup Pitch (60s)', icon: 'target', status: 'completed', createdAtMs: _TX_SEED - _DAY - 10 * _H },
  { id: 'txn-007', type: 'debit', amount: 1, description: 'Spark Gift sent to new_artist99', icon: 'heart', status: 'completed', createdAtMs: _TX_SEED - 2 * _DAY + _H },
  { id: 'txn-008', type: 'cashout', amount: 500, description: 'Cashout ₹50 → ghost@phonepe', icon: 'arrow-up-circle', status: 'pending', createdAtMs: _TX_SEED - 2 * _DAY - 2 * _H }, // Fixed from 'hold_7d'
  { id: 'txn-009', type: 'credit', amount: 20, description: 'Referral bonus — noor_bhai joined via your link', icon: 'user-plus', status: 'completed', createdAtMs: _TX_SEED - 3 * _DAY },
  { id: 'txn-010', type: 'credit', amount: 50, description: 'Daily login streak bonus · Day 7', icon: 'sun', status: 'completed', createdAtMs: _TX_SEED - 4 * _DAY },
];

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — MOCK_NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

const _NOTIF_SEED = new Date('2026-04-29T17:00:00+05:30').getTime();

export const MOCK_NOTIFICATIONS: CWNotification[] = [
  // MENTION × 3
  { id: 'notif-m1', category: 'mention', title: 'sk_promo99 ne @you ko mention kiya', body: '@you bhai yeh pitch dekho · Sector 22 mein kal pitch night hai', read: false, createdAtMs: _NOTIF_SEED - 8 * 60_000, meta: { route: '/room/6', fromName: 'sk_promo99', sectorName: 'Sector 22' } },
  { id: 'notif-m2', category: 'mention', title: 'beats_by_rk ne @you ko mention kiya', body: '@you listen to this mix · Sector 17 mein sunte hain aaj raat', read: false, createdAtMs: _NOTIF_SEED - 55 * 60_000, meta: { route: '/room/4', fromName: 'beats_by_rk', sectorName: 'Sector 17' } },
  { id: 'notif-m3', category: 'mention', title: 'noor_bhai ne @you ko tag kiya', body: '@you freelancer chahiye React mein · 800/day · bata', read: true, createdAtMs: _NOTIF_SEED - _DAY + 3 * _H, meta: { route: '/room/3', fromName: 'noor_bhai', sectorName: 'Skill Bazaar' } },
  
  // SPARK × 2 (Mapped from legacy 'reaction')
  { id: 'notif-r1', category: 'spark', title: 'lens_wala ne tumhara message heart kiya', body: 'lens_wala + 4 aur logon ne tumhare post par spark bheja', read: false, createdAtMs: _NOTIF_SEED - 22 * 60_000, meta: { route: '/room/5', fromName: 'lens_wala', sectorName: 'Creative Studio' } },
  { id: 'notif-r2', category: 'spark', title: 'Spark Gift mila! new_artist99 se', body: 'new_artist99 ne tumhe 1 Spark Gift bheja · Sector 17 Music Junction mein', read: true, createdAtMs: _NOTIF_SEED - _DAY + _H, meta: { route: '/room/4', fromName: 'new_artist99', credits: 1, sectorName: 'Music Junction' } },

  // SYSTEM × 3
  { id: 'notif-s1', category: 'system', title: 'Trust Score updated', body: 'Tumhara Trust Score 96 se 98 ho gaya · great contributions!', read: false, createdAtMs: _NOTIF_SEED - 3 * _H, meta: { karmaDelta: 2 } },
  { id: 'notif-s2', category: 'system', title: 'Karma deducted — moderation action', body: 'Ek post guidelines ke against tha · -20 karma adjust kiya gaya', read: true, createdAtMs: _NOTIF_SEED - _DAY - 2 * _H, meta: { karmaDelta: -20 } },
  { id: 'notif-s3', category: 'system', title: 'Account verified ✓', body: 'Phone verification successful · Chandigarh sector access unlocked', read: true, createdAtMs: _NOTIF_SEED - 4 * _DAY, meta: {} },

  // ACHIEVEMENT × 2 (Mapped from legacy 'promo')
  { id: 'notif-p1', category: 'achievement', title: 'Challenge result — Best Desi Rap Verse', body: 'Tumne #3 place kiya is week ke challenge mein · amazing!', read: true, createdAtMs: _NOTIF_SEED - 7 * _H, meta: { route: '/challenges/c1' } },
  { id: 'notif-p2', category: 'system', title: 'New challenge live — Street Photography', body: 'Prize pool ₹750 · entries abhi 62 hain · submit before Sunday 11:59 PM', read: true, createdAtMs: _NOTIF_SEED - _DAY - _H, meta: { route: '/challenges/c2', credits: 750 } },

  // MAYOR × 3
  { id: 'notif-may1', category: 'mayor', title: '📌 Mayor Bittu ne announce kiya — Sector 17', body: 'Sector 17 cleanup drive Sunday 10AM · sab log aana · community center', read: false, createdAtMs: _NOTIF_SEED - 35 * 60_000, meta: { route: '/', fromName: 'Bittu (Mayor)', sectorId: 'sector-17', sectorName: 'Sector 17' } },
  { id: 'notif-may2', category: 'mayor', title: '📌 Mayor Neha ka notice — Sector 22', body: 'Market bund rahega Wednesday 2–5PM · election vote casting ke liye', read: true, createdAtMs: _NOTIF_SEED - _DAY - 4 * _H, meta: { route: '/', fromName: 'Neha (Mayor)', sectorId: 'sector-22', sectorName: 'Sector 22' } },
  { id: 'notif-may3', category: 'mayor', title: 'Mayor election shuru! Sector 34', body: 'Voting khaul gaya hai · apna Mayor chuno · kal raat 11:59 PM tak', read: true, createdAtMs: _NOTIF_SEED - 2 * _DAY - 3 * _H, meta: { route: '/', sectorId: 'sector-34', sectorName: 'Sector 34 · Elante' } },

  // HEAT × 2 (Mapped from legacy 'room')
  { id: 'notif-ro1', category: 'heat', title: 'Gaming Clutch Week is Trending 🔥', body: 'aimgod_47 + 3 aur log active hain · join karo abhi', read: false, createdAtMs: _NOTIF_SEED - 14 * 60_000, meta: { route: '/room/2', roomId: '2', sectorName: 'Gaming Clutch Week', heatScore: 85 } },
  { id: 'notif-ro2', category: 'heat', title: 'Startup Circle is heating up!', body: 'sk_promo99 ne pitch live shuru kiya · 51 log sun rahe hain', read: true, createdAtMs: _NOTIF_SEED - 5 * _H, meta: { route: '/room/6', roomId: '6', sectorName: 'Startup Circle', heatScore: 92 } },
];

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — MOCK_DISCOVER_POSTS
// ─────────────────────────────────────────────────────────────────────────────

export const DISCOVER_POSTS = [
  { id: '1', icon: 'target',    accent: '#5B7FFF', title: 'Best Minecraft Build 2025',           author: 'ghost_player',   tier: 'CROWN',     room: 'Gaming Lounge',   views: '1.2K', category: 'Gaming'   },
  { id: '2', icon: 'music',     accent: '#2BB673', title: 'My New Single — Neon Nights',         author: 'new_artist99',   tier: 'MAYOR',     room: 'Music Junction',  views: '876',  category: 'Music'    },
  { id: '3', icon: 'briefcase', accent: '#5B7FFF', title: 'How I Got 10k Users in 30 Days',      author: 'sk_promo99',     tier: 'FOUNDER',   room: 'Startup Circle',  views: '3.4K', category: 'Business' },
  { id: '4', icon: 'camera',    accent: '#5B7FFF', title: 'Street Photography — Delhi 2025',     author: 'lens_wala',      room: 'Creative Studio', views: '654',  category: 'Art'      },
  { id: '5', icon: 'target',    accent: '#E5484D', title: 'CS2 Clutch Play Highlights',          author: 'aimgod_47',      room: 'Gaming Lounge',   views: '2.1K', category: 'Gaming'   },
];

export const MOCK_DISCOVER_POSTS: CWDiscoverPost[] = [
  // SPOTLIGHT WINNERS
  { id: 'dp-s1', icon: 'target', accent: '#E8A33D', title: 'CS2 Sector 17 LAN Finals — Live Recap', author: 'aimgod_47', tier: 'MAYOR', room: 'Gaming Clutch Week', views: '3.8K', category: 'Gaming', isSpotlight: true, spotlightBidCredits: 85, heatScore: 94 },
  { id: 'dp-s2', icon: 'briefcase', accent: '#C9A227', title: 'How I Raised ₹12L from Chandigarh Investors', author: 'sk_promo99', tier: 'FOUNDER', room: 'Startup Circle', views: '6.1K', category: 'Business', isSpotlight: true, spotlightBidCredits: 120, heatScore: 97 },
  { id: 'dp-s3', icon: 'music', accent: '#2BB673', title: 'Sukhna Lake Sessions — Acoustic Live', author: 'new_artist99', room: 'Music Junction', views: '2.4K', category: 'Music', isSpotlight: true, spotlightBidCredits: 60, heatScore: 88 },

  // TRENDING / REGULAR FEED POSTS
  { id: 'dp-4', icon: 'camera', accent: '#5B7FFF', title: 'Sector 17 Plaza at Golden Hour — Photo Walk', author: 'lens_wala', room: 'Creative Studio', views: '1.1K', category: 'Art', heatScore: 76 },
  { id: 'dp-5', icon: 'code', accent: '#5B7FFF', title: 'Built a Full-Stack App in 48 hrs — Solo', author: 'code_rk', room: 'Skill Bazaar', views: '2.7K', category: 'Dev', heatScore: 82 },
  { id: 'dp-6', icon: 'music', accent: '#8B5CF6', title: 'Punjabi Hip-Hop Beat — Free Download', author: 'beats_by_rk', room: 'Music Junction', views: '1.6K', category: 'Music', heatScore: 71 },
];

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — MOCK_SAVED_MESSAGES
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_SAVED_MESSAGES: CWSavedMessage[] = [
  { id: 'save-001', messageId: 'msg-abc123', senderName: 'Sk Promo', senderHandle: 'sk_promo99', sectorId: 'room-6', sectorName: 'Startup Circle', text: 'Bhai agar tum ₹500 mein React Native dev dhoond rahe ho...', savedAtMs: new Date('2026-04-28T11:14:00+05:30').getTime(), messageType: 'text' },
  { id: 'save-002', messageId: 'msg-def456', senderName: 'Ghost Player', senderHandle: 'ghost_player', sectorId: 'room-1', sectorName: 'Late Night Feels', text: 'voice note dikhi thi teri...', savedAtMs: new Date('2026-04-27T23:52:00+05:30').getTime(), messageType: 'text' },
  { id: 'save-003', messageId: 'msg-ghi789', senderName: 'New Artist', senderHandle: 'new_artist99', sectorId: 'room-4', sectorName: 'Music Junction', text: '', savedAtMs: new Date('2026-04-26T19:30:00+05:30').getTime(), messageType: 'voice', voiceDurationSec: 47 },
];
