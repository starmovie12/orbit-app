export const ROOMS = [
  { id: 'live1', emoji: '🔴', color: '#EF4444', name: '🔴 Live: Pitch Night',   preview: '48 listening · host earning 96₵', time: 'LIVE', unread: 0, online: 48,  muted: false, isLive: true,  liveEarning: '96₵/hr' },
  { id: '1',     emoji: '💔', color: '#EC4899', name: 'Late Night Feels',        preview: 'ghost_player: bhai sad lag raha...', time: 'now',  unread: 12, online: 223, muted: false, isLive: false },
  { id: '2',     emoji: '🎮', color: '#F59E0B', name: 'Gaming Clutch Week',      preview: 'neo_gamer: ye kya tha yrr 😂',     time: '2m',   unread: 4,  online: 312, muted: false, isLive: false },
  { id: '3',     emoji: '💼', color: '#7B68EE', name: 'Skill Bazaar',            preview: 'react freelancer chahiye ₹800/day', time: '5m',   unread: 3,  online: 94,  muted: false, isLive: false, typing: 'noor_bhai' },
  { id: '4',     emoji: '🎵', color: '#10B981', name: 'Music Junction',          preview: 'new_artist99: Check out my latest track', time: '13m', unread: 0, online: 187, muted: false, isLive: false },
  { id: '5',     emoji: '📸', color: '#34B461', name: 'Creative Studio',         preview: 'Photo',                           time: 'Yesterday', unread: 3, online: 256, muted: true, isLive: false },
  { id: '6',     emoji: '🌱', color: '#3A9FE8', name: 'Startup Circle',          preview: 'sk_promo99: Series A announcement coming…', time: 'Mon', unread: 0, online: 51, muted: false, isLive: false },
];

export const DM_CHATS = [
  { id: 'd1', emoji: '👤', color: '#2481CC', name: 'Aryan Verma',   preview: 'Bhai kal milte hain?',          time: '14:44', unread: 2,  ticks: 'none',     online: true  },
  { id: 'd2', emoji: '👤', color: '#34B461', name: 'Priya Singh',   preview: 'Thanks for the tip!',           time: '13:20', unread: 0,  ticks: 'read',     online: false },
  { id: 'd3', emoji: '👤', color: '#F4A522', name: 'Rahul Sharma',  preview: 'Voice note (0:12)',             time: '11:55', unread: 0,  ticks: 'delivered', online: true },
  { id: 'd4', emoji: '👤', color: '#7B68EE', name: 'Sneha Kapoor',  preview: 'Kab aaugi tum?',               time: '10:30', unread: 5,  ticks: 'none',     online: false },
  { id: 'd5', emoji: '👤', color: '#E53935', name: 'Dev Nair',      preview: 'OK done',                      time: 'Yesterday', unread: 0, ticks: 'read',  online: false },
];

export const MOOD_ROOMS = [
  { id: 'm1', emoji: '🌙', color: '#7C3AED', name: 'Late Night Feels',  members: 223, tag: 'Venting OK' },
  { id: 'm2', emoji: '☕', color: '#F59E0B', name: 'Morning Motivation', members: 178, tag: 'Energy ⚡' },
  { id: 'm3', emoji: '😂', color: '#10B981', name: 'Meme Drop Zone',     members: 541, tag: 'Trending 🔥' },
  { id: 'm4', emoji: '💪', color: '#3B82F6', name: 'Grind Mode ON',      members: 312, tag: 'Focus' },
  { id: 'm5', emoji: '💔', color: '#EC4899', name: 'Vent & Heal',        members: 96,  tag: 'Safe Space' },
];

export const WEEKLY_CHALLENGES = [
  { id: 'c1', emoji: '🎤', title: 'Best Desi Rap Verse',      entries: 84,  prize: '1000 Credits', ends: '2d 14h', category: 'Music'   },
  { id: 'c2', emoji: '📷', title: 'Street Photography Delhi', entries: 62,  prize: '750 Credits',  ends: '1d 6h',  category: 'Art'     },
  { id: 'c3', emoji: '🎮', title: 'Clutch Play of the Week',  entries: 137, prize: '500 Credits',  ends: '3d 2h',  category: 'Gaming'  },
  { id: 'c4', emoji: '💡', title: 'Startup Pitch (60s)',       entries: 29,  prize: '2000 Credits', ends: '4d 10h', category: 'Business'},
];

export const DISCOVER_POSTS = [
  { id: '1',  emoji: '🎮', color: '#2481CC', title: 'Best Minecraft Build 2025',       author: 'ghost_player',  tag: '⚡', room: 'Gaming Lounge',  views: '1.2K', duration: '15s', category: 'Gaming'   },
  { id: '2',  emoji: '🎵', color: '#F4A522', title: 'My New Single — Neon Nights',     author: 'new_artist99', tag: '🎖️', room: 'Music Junction', views: '876',  duration: '30s', category: 'Music'    },
  { id: '3',  emoji: '💼', color: '#7B68EE', title: 'How I Got 10k Users in 30 Days',  author: 'sk_promo99',   tag: '🔥', room: 'Startup Circle', views: '3.4K', duration: '15s', category: 'Business' },
  { id: '4',  emoji: '📸', color: '#34B461', title: 'Street Photography — Delhi 2025', author: 'lens_wala',    tag: '⚡', room: 'Creative Studio', views: '654', duration: '15s', category: 'Art'      },
  { id: '5',  emoji: '🎮', color: '#E53935', title: 'CS2 Clutch Play Highlights',      author: 'aimgod_47',    tag: '🎖️', room: 'Gaming Lounge', views: '2.1K', duration: '30s', category: 'Gaming'   },
  { id: '6',  emoji: '🌱', color: '#3A9FE8', title: 'Zero to 1L/month — My Journey',  author: 'freelancer_x', tag: '🔥', room: 'Business Hub',   views: '5.6K', duration: '15s', category: 'Business' },
  { id: '7',  emoji: '🎵', color: '#F4A522', title: 'Chill Lofi Mix for Studying',     author: 'beats_by_rk',  tag: '⚡', room: 'Music Junction', views: '901',  duration: '30s', category: 'Music'    },
  { id: '8',  emoji: '💼', color: '#7B68EE', title: 'Top 5 SaaS Tools You Never Heard Of', author: 'tech_orbit', tag: '⚡', room: 'Startup Circle', views: '1.8K', duration: '15s', category: 'Business' },
];

export const BAZAAR_GIGS = [
  { id: 'g1',  emoji: '🎨', color: '#EC4899', category: 'Design',   title: 'Professional Logo Design',        seller: 'designwala',   price: 500,  rating: 4.9, reviews: 142, delivery: '2 days',  tags: ['Logo', 'Branding'] },
  { id: 'g2',  emoji: '📝', color: '#3B82F6', category: 'Writing',  title: 'Resume + LinkedIn Makeover',      seller: 'career_ninja', price: 299,  rating: 4.8, reviews: 87,  delivery: '1 day',   tags: ['Resume', 'Career'] },
  { id: 'g3',  emoji: '💻', color: '#10B981', category: 'Dev',      title: 'React Website in 3 Days',         seller: 'code_rk',      price: 1999, rating: 4.7, reviews: 53,  delivery: '3 days',  tags: ['React', 'Fullstack'] },
  { id: 'g4',  emoji: '📱', color: '#F59E0B', category: 'Social',   title: 'Instagram Growth Strategy Pack',  seller: 'viral_pj',     price: 399,  rating: 4.6, reviews: 201, delivery: '1 day',   tags: ['Instagram', 'Growth'] },
  { id: 'g5',  emoji: '🎬', color: '#8B5CF6', category: 'Video',    title: 'Reels Editing — Cinematic Style', seller: 'cutmaster_x',  price: 799,  rating: 4.9, reviews: 76,  delivery: '2 days',  tags: ['Reels', 'Editing'] },
  { id: 'g6',  emoji: '🎙️', color: '#EF4444', category: 'Audio',   title: 'Voiceover — Hindi/English',       seller: 'voice_aryan',  price: 349,  rating: 4.7, reviews: 118, delivery: '1 day',   tags: ['Voiceover', 'Hindi'] },
  { id: 'g7',  emoji: '📊', color: '#06B6D4', category: 'Business', title: 'Pitch Deck Design (10 slides)',   seller: 'deck_pro99',   price: 1499, rating: 4.8, reviews: 34,  delivery: '3 days',  tags: ['Pitch', 'Startup'] },
  { id: 'g8',  emoji: '🖼️', color: '#F97316', category: 'Design',  title: 'Thumbnail Design for YouTube',   seller: 'thumb_king',   price: 149,  rating: 4.5, reviews: 312, delivery: 'Same day', tags: ['YouTube', 'Thumbnail'] },
];

export const BAZAAR_CATEGORIES = ['All', 'Design', 'Dev', 'Writing', 'Social', 'Video', 'Audio', 'Business'];

export const RANKS_DATA = [
  { id: '1',  rank: 1,  emoji: '👑', name: 'ghost_player',  karma: 9820, badge: 'LEGEND',   trophies: ['🏆','🥇','⭐','🔥','💎'], weeklyKarma: 1240 },
  { id: '2',  rank: 2,  emoji: '⚡', name: 'sk_promo99',    karma: 8741, badge: 'CHAMPION',  trophies: ['🥇','⭐','🔥','💎'],      weeklyKarma: 980  },
  { id: '3',  rank: 3,  emoji: '🔥', name: 'new_artist99',  karma: 7654, badge: 'MASTER',    trophies: ['⭐','🔥','💎'],           weeklyKarma: 870  },
  { id: '4',  rank: 4,  emoji: '💎', name: 'lens_wala',     karma: 6210, badge: 'MASTER',    trophies: ['🔥','💎'],                weeklyKarma: 650  },
  { id: '5',  rank: 5,  emoji: '🌟', name: 'aimgod_47',     karma: 5890, badge: 'PRO',       trophies: ['💎'],                     weeklyKarma: 540  },
  { id: '6',  rank: 6,  emoji: '🎯', name: 'tech_orbit',    karma: 4320, badge: 'PRO',       trophies: ['⭐'],                     weeklyKarma: 420  },
  { id: '7',  rank: 7,  emoji: '🚀', name: 'beats_by_rk',   karma: 3850, badge: 'RISING',    trophies: [],                         weeklyKarma: 390  },
  { id: '8',  rank: 8,  emoji: '💫', name: 'freelancer_x',  karma: 3210, badge: 'RISING',    trophies: [],                         weeklyKarma: 310  },
  { id: '9',  rank: 9,  emoji: '🎮', name: 'noor_bhai',     karma: 2740, badge: 'ACTIVE',    trophies: [],                         weeklyKarma: 280  },
  { id: '10', rank: 10, emoji: '📸', name: 'orbit_user01',  karma: 2100, badge: 'ACTIVE',    trophies: [],                         weeklyKarma: 210  },
];

export const MY_PROFILE = {
  name: 'ghost_player',
  displayName: 'Ghost Player',
  handle: '@ghost_player',
  emoji: '👑',
  color: '#2481CC',
  karma: 9820,
  rank: 1,
  credits: 142,
  watchCredits: 142,
  badge: 'LEGEND',
  trustScore: 96,
  joined: 'Jan 2025',
  posts: 142,
  watches: 3410,
  bio: 'DM for collabs 🤝 · Chandigarh · CS + Design',
  region: 'Punjab',
  language: 'Hindi',
  trophies: ['🏆','🥇','⭐','🔥','💎'],
  streak: 7,
  achievements: [
    { icon: '🏆', label: 'First Place',   desc: 'Top #1 on the Leaderboard'        },
    { icon: '🔥', label: 'On Fire',       desc: '7-day posting streak'              },
    { icon: '💎', label: 'Diamond',       desc: '5000+ Karma points earned'         },
    { icon: '⭐', label: 'Star Creator',  desc: '100+ Discover posts uploaded'      },
    { icon: '🤝', label: 'Connector',     desc: 'Sent 500+ DMs via Message button'  },
  ],
  skills: ['React', 'UI Design', 'Startup', 'Gaming'],
};
