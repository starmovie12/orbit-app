/**
 * ORBIT — Onboarding Data
 *
 * `icon` = Feather glyph name. Used to render premium SVG icons, NOT emoji.
 * `accent` is a quiet category cue (used for icon tint or 3px stripe only).
 */

export const LANGUAGES = [
  { code: "hi", label: "हिन्दी",   sub: "Hindi"   },
  { code: "en", label: "English",  sub: "English" },
  { code: "pa", label: "ਪੰਜਾਬੀ",  sub: "Punjabi" },
  { code: "bn", label: "বাংলা",    sub: "Bengali" },
  { code: "mr", label: "मराठी",    sub: "Marathi" },
  { code: "ta", label: "தமிழ்",    sub: "Tamil"   },
  { code: "te", label: "తెలుగు",   sub: "Telugu"  },
  { code: "gu", label: "ગુજરાતી", sub: "Gujarati"},
];

export const INTERESTS: { id: string; icon: any; label: string }[] = [
  { id: "gaming",    icon: "target",       label: "Gaming"      },
  { id: "music",     icon: "music",        label: "Music"       },
  { id: "startup",   icon: "briefcase",    label: "Startup"     },
  { id: "tech",      icon: "code",         label: "Tech"        },
  { id: "art",       icon: "pen-tool",     label: "Art"         },
  { id: "photo",     icon: "camera",       label: "Photography" },
  { id: "movies",    icon: "film",         label: "Movies"      },
  { id: "memes",     icon: "smile",        label: "Memes"       },
  { id: "fitness",   icon: "activity",     label: "Fitness"     },
  { id: "food",      icon: "coffee",       label: "Food"        },
  { id: "vent",      icon: "heart",        label: "Vent & Heal" },
  { id: "study",     icon: "book-open",    label: "Study"       },
  { id: "freelance", icon: "tool",         label: "Freelance"   },
  { id: "news",      icon: "globe",        label: "News"        },
];

/**
 * Avatar palette for generated initials avatars.
 * Replaces emoji avatars (👻🦊🐼…) which look like clipart.
 */
export const AVATAR_COLORS = [
  "#5B7FFF", "#8B5CF6", "#2BB673", "#E8A33D",
  "#E5484D", "#3B82F6", "#EC4899", "#06B6D4",
];

/**
 * Legacy slot — keeps old code that imports AVATAR_EMOJIS from compiling.
 * Replaced with single-letter "initials" placeholders.
 * The Avatar component in components/shared.tsx generates real initials avatars.
 */
export const AVATAR_EMOJIS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"];

export const MIN_INTERESTS = 3;
