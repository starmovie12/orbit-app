/**
 * ORBIT — Mock Data
 *
 * `icon` field = Feather icon name (from @expo/vector-icons).
 * `accent`     = subtle category color (used as a 3px stripe or icon tint only,
 *                NEVER as a neon background fill).
 * Emojis appear ONLY inside user-generated `preview` text — never as UI chrome.
 */

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

export const DISCOVER_POSTS = [
  { id: '1', icon: 'target',    accent: '#5B7FFF', title: 'Best Minecraft Build 2025',           author: 'ghost_player',   tier: 'PRO',     room: 'Gaming Lounge',   views: '1.2K', duration: '15s', category: 'Gaming'   },
  { id: '2', icon: 'music',     accent: '#2BB673', title: 'My New Single — Neon Nights',         author: 'new_artist99',   tier: 'MASTER',  room: 'Music Junction',  views: '876',  duration: '30s', category: 'Music'    },
  { id: '3', icon: 'briefcase', accent: '#5B7FFF', title: 'How I Got 10k Users in 30 Days',      author: 'sk_promo99',     tier: 'CHAMPION',room: 'Startup Circle',  views: '3.4K', duration: '15s', category: 'Business' },
  { id: '4', icon: 'camera',    accent: '#5B7FFF', title: 'Street Photography — Delhi 2025',     author: 'lens_wala',      tier: 'PRO',     room: 'Creative Studio', views: '654',  duration: '15s', category: 'Art'      },
  { id: '5', icon: 'target',    accent: '#E5484D', title: 'CS2 Clutch Play Highlights',          author: 'aimgod_47',      tier: 'MASTER',  room: 'Gaming Lounge',   views: '2.1K', duration: '30s', category: 'Gaming'   },
  { id: '6', icon: 'send',      accent: '#2BB673', title: 'Zero to 1L/month — My Journey',       author: 'freelancer_x',   tier: 'CHAMPION',room: 'Business Hub',    views: '5.6K', duration: '15s', category: 'Business' },
  { id: '7', icon: 'music',     accent: '#E8A33D', title: 'Chill Lofi Mix for Studying',         author: 'beats_by_rk',    tier: 'PRO',     room: 'Music Junction',  views: '901',  duration: '30s', category: 'Music'    },
  { id: '8', icon: 'briefcase', accent: '#5B7FFF', title: 'Top 5 SaaS Tools You Never Heard Of', author: 'tech_orbit',     tier: 'PRO',     room: 'Startup Circle',  views: '1.8K', duration: '15s', category: 'Business' },
];

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

/**
 * RANKS — `icon` is a Feather glyph, NOT an emoji.
 * `trophies` is a small typed list — each item gets rendered as a sleek SVG pill.
 */
export const RANKS_DATA = [
  { id: '1',  rank: 1,  icon: 'award',      name: 'ghost_player', karma: 9820, badge: 'LEGEND',   trophies: ['top1', 'streak', 'star', 'diamond'], weeklyKarma: 1240 },
  { id: '2',  rank: 2,  icon: 'zap',        name: 'sk_promo99',   karma: 8741, badge: 'CHAMPION', trophies: ['top1', 'streak', 'diamond'],         weeklyKarma: 980  },
  { id: '3',  rank: 3,  icon: 'activity',   name: 'new_artist99', karma: 7654, badge: 'MASTER',   trophies: ['streak', 'diamond'],                 weeklyKarma: 870  },
  { id: '4',  rank: 4,  icon: 'hexagon',    name: 'lens_wala',    karma: 6210, badge: 'MASTER',   trophies: ['diamond'],                           weeklyKarma: 650  },
  { id: '5',  rank: 5,  icon: 'star',       name: 'aimgod_47',    karma: 5890, badge: 'PRO',      trophies: ['star'],                              weeklyKarma: 540  },
  { id: '6',  rank: 6,  icon: 'target',     name: 'tech_orbit',   karma: 4320, badge: 'PRO',      trophies: ['star'],                              weeklyKarma: 420  },
  { id: '7',  rank: 7,  icon: 'send',       name: 'beats_by_rk',  karma: 3850, badge: 'RISING',   trophies: [],                                    weeklyKarma: 390  },
  { id: '8',  rank: 8,  icon: 'compass',    name: 'freelancer_x', karma: 3210, badge: 'RISING',   trophies: [],                                    weeklyKarma: 310  },
  { id: '9',  rank: 9,  icon: 'target',     name: 'noor_bhai',    karma: 2740, badge: 'ACTIVE',   trophies: [],                                    weeklyKarma: 280  },
  { id: '10', rank: 10, icon: 'camera',     name: 'orbit_user01', karma: 2100, badge: 'ACTIVE',   trophies: [],                                    weeklyKarma: 210  },
];

export const MY_PROFILE = {
  name: 'ghost_player',
  displayName: 'Ghost Player',
  handle: '@ghost_player',
  /** Avatar = generated from initials, not an emoji. Crown banned. */
  avatarSeed: 'ghost_player',
  karma: 9820,
  rank: 1,
  credits: 142,
  watchCredits: 142,
  badge: 'LEGEND',
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
    { icon: 'award',  label: 'First Place',  desc: 'Top #1 on the Leaderboard'      },
    { icon: 'activity', label: 'On Fire',      desc: '7-day posting streak'           },
    { icon: 'hexagon',label: 'Diamond',      desc: '5000+ Karma points earned'      },
    { icon: 'star',   label: 'Star Creator', desc: '100+ Discover posts uploaded'   },
    { icon: 'users',  label: 'Connector',    desc: 'Sent 500+ DMs via Message'      },
  ],
  skills: ['React', 'UI Design', 'Startup', 'Gaming'],
};
