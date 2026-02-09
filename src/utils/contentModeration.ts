// Client-side content moderation utility
// Detects profanity, contact info, and social media references

// Profanity and banned words list (lowercase)
const PROFANITY_LIST = [
  // Common profanity
  'fuck', 'shit', 'bitch', 'ass', 'damn', 'crap', 'piss', 'dick', 'cock', 'pussy',
  'bastard', 'slut', 'whore', 'cunt', 'fag', 'retard', 'nigger', 'nigga',
  // Hate speech
  'kill yourself', 'kys', 'die', 'hate you',
  // Variations
  'fck', 'fuk', 'sh1t', 'b1tch', 'a$$', 'd1ck', 'c0ck', 'pu$$y', 'fvck',
];

// Social media platforms and communication apps
// Split into short abbreviations (need word boundary matching) and full names
const SOCIAL_PLATFORMS_SHORT = ['ig', 'tt', 'sc', 'wa', 'fb', 'yt'];
const SOCIAL_PLATFORMS_FULL = [
  'instagram', 'insta',
  'tiktok', 'tik tok',
  'snapchat', 'snap',
  'whatsapp', 'whats app',
  'facebook', 'messenger',
  'twitter', 'x.com',
  'telegram', 'discord', 'signal',
  'wechat', 'line app', 'viber', 'kik',
  'linkedin', 'youtube',
  'dm me', 'text me', 'call me', 'hit me up', 'hmu',
  'add me', 'follow me', 'message me outside',
];

// Character substitution map for leet speak detection
const CHAR_SUBSTITUTIONS: Record<string, string[]> = {
  'a': ['4', '@', '^', 'α', 'Λ', 'λ'],
  'b': ['8', '|3', 'ß', 'β'],
  'c': ['(', '{', '[', '<', '¢'],
  'd': ['|)', 'cl', 'đ'],
  'e': ['3', '€', 'ε', 'є'],
  'f': ['|=', 'ph'],
  'g': ['6', '9', 'q'],
  'h': ['|-|', '#', '}{'],
  'i': ['1', '!', '|', 'l', '¡', 'í'],
  'j': ['_|', ']'],
  'k': ['|<', '|{'],
  'l': ['1', '|', '!', 'ł'],
  'm': ['|v|', '/\\/\\', 'nn'],
  'n': ['|\\|', '/\\/', 'ñ'],
  'o': ['0', '()', 'ø', 'ö', 'ó'],
  'p': ['|>', '|*'],
  'q': ['9', '0_'],
  'r': ['|2', '®'],
  's': ['5', '$', '§', 'z'],
  't': ['7', '+', '†'],
  'u': ['|_|', 'µ', 'ü', 'ú'],
  'v': ['\\/'],
  'w': ['\\/\\/', 'vv', 'uu'],
  'x': ['><', '}{'],
  'y': ['`/', '¥'],
  'z': ['2', '7_', 's'],
};

// Number words for phone detection
const NUMBER_WORDS: Record<string, string> = {
  'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
  'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
  'oh': '0', 'o': '0',
};

export interface ModerationResult {
  isBlocked: boolean;
  reason: string | null;
  category: 'profanity' | 'contact' | 'social' | 'url' | null;
  field?: string;
}

export interface ModerationOptions {
  allowMentions?: boolean; // If true, @mentions won't be flagged as social media
}

// Normalize text by removing special chars and substitutions
function normalizeText(text: string): string {
  let normalized = text.toLowerCase();
  
  // Replace number words with digits
  for (const [word, digit] of Object.entries(NUMBER_WORDS)) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    normalized = normalized.replace(regex, digit);
  }
  
  // Replace common substitutions
  for (const [char, subs] of Object.entries(CHAR_SUBSTITUTIONS)) {
    for (const sub of subs) {
      normalized = normalized.split(sub.toLowerCase()).join(char);
    }
  }
  
  return normalized;
}

// Remove all spacing, punctuation, and special chars for pattern matching
function stripAllNonAlphanumeric(text: string): string {
  return text.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

// Detect phone numbers with various formats
function detectPhoneNumber(text: string): boolean {
  // Normalize the text first
  const normalized = normalizeText(text);
  
  // Remove all non-digit characters for phone detection
  const digitsOnly = normalized.replace(/[^0-9]/g, '');
  
  // Check for sequences of 8+ digits (phone numbers)
  if (digitsOnly.length >= 8) {
    // Check if there's a sequence of 8+ digits that could be a phone
    const phonePatterns = [
      /\d{8,}/,  // 8+ consecutive digits
      /\d{3,4}[\s\-._]*\d{3,4}[\s\-._]*\d{3,4}/, // Formatted phone
      /\+?\d{1,3}[\s\-._]*\d{3,4}[\s\-._]*\d{3,4}[\s\-._]*\d{3,4}/, // International
      /04\d{2}[\s\-._]*\d{3}[\s\-._]*\d{3}/, // Australian mobile
      /\(\d{2,4}\)[\s\-._]*\d{3,4}[\s\-._]*\d{3,4}/, // With area code
    ];
    
    for (const pattern of phonePatterns) {
      if (pattern.test(normalized)) {
        return true;
      }
    }
    
    // Check original text too for spaced numbers
    if (/\d[\s._-]*\d[\s._-]*\d[\s._-]*\d[\s._-]*\d[\s._-]*\d[\s._-]*\d[\s._-]*\d/.test(text)) {
      return true;
    }
  }
  
  return false;
}

// Detect email addresses
function detectEmail(text: string): boolean {
  const normalized = normalizeText(text);

  // Robust email + common obfuscations (at/dot)
  // NOTE: Avoid character classes like [at] which cause false positives.
  const emailLikePattern =
    /[a-z0-9._%+-]{1,64}\s*(?:@|\(at\)|\[at\]|\s+at\s+|-at-)\s*[a-z0-9.-]{1,255}\s*(?:\.|\(dot\)|\[dot\]|\s+dot\s+|-dot-)\s*[a-z]{2,24}/i;

  return emailLikePattern.test(normalized);
}

// Detect URLs
function detectUrl(text: string): boolean {
  const patterns = [
    /https?:\/\/[^\s]+/i,
    /www\.[^\s]+/i,
    /[a-z0-9-]+\.(com|net|org|io|co|app|dev|me|info|biz)[^\s]*/i,
    /bit\.ly|tinyurl|goo\.gl|t\.co/i,
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  return false;
}

// Detect social media mentions
function detectSocialMedia(text: string, options?: ModerationOptions): boolean {
  const normalized = normalizeText(text);

  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Build a regex that matches a term even if users add spaces/punctuation between letters,
  // but requires non-alphanumeric boundaries to avoid substring false positives.
  const makeLooseBoundedPattern = (term: string) => {
    const compact = term.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!compact) return null;
    const inner = compact
      .split('')
      .map((ch) => escapeRegExp(ch))
      .join('[^a-z0-9]*');
    return new RegExp(`(?:^|[^a-z0-9])${inner}(?:$|[^a-z0-9])`, 'i');
  };

  // Full platform names + phrases (catch obfuscations like i.n.s.t.a, i n s t a)
  for (const platform of SOCIAL_PLATFORMS_FULL) {
    const pattern = makeLooseBoundedPattern(platform);
    if (pattern && pattern.test(normalized)) return true;
  }

  // Short abbreviations must be standalone tokens only (avoid false positives like "shoeS - Casual" => "sc")
  for (const abbrev of SOCIAL_PLATFORMS_SHORT) {
    const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(abbrev)}(?:$|[^a-z0-9])`, 'i');
    if (pattern.test(normalized)) return true;
  }

  // @handles: only flag if we're NOT allowing mentions (comments allow mentions)
  if (!options?.allowMentions) {
    if (/(?:^|[^a-z0-9])@[a-z0-9_]{3,}\b/i.test(text)) {
      return true;
    }
  }

  return false;
}

// Detect profanity
function detectProfanity(text: string): boolean {
  const normalized = normalizeText(text);

  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Matches obfuscated profanity (spaces/punctuation/leet) but avoids substring false positives
  // by enforcing non-alphanumeric boundaries.
  const makeLooseBoundedPattern = (term: string) => {
    const compact = term.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!compact) return null;
    const inner = compact
      .split('')
      .map((ch) => escapeRegExp(ch))
      .join('[^a-z0-9]*');
    return new RegExp(`(?:^|[^a-z0-9])${inner}(?:$|[^a-z0-9])`, 'i');
  };

  for (const word of PROFANITY_LIST) {
    const pattern = makeLooseBoundedPattern(word);
    if (pattern && pattern.test(normalized)) return true;
  }

  return false;
}

// Main moderation function
export function moderateContent(text: string, options?: ModerationOptions): ModerationResult {
  if (!text || typeof text !== 'string') {
    return { isBlocked: false, reason: null, category: null };
  }
  
  // Check for profanity
  if (detectProfanity(text)) {
    return {
      isBlocked: true,
      reason: "Please keep things respectful. Your content contains language that isn't allowed on Flea.",
      category: 'profanity',
    };
  }
  
  // Check for phone numbers
  if (detectPhoneNumber(text)) {
    return {
      isBlocked: true,
      reason: "Sharing contact details or directing users off Flea isn't allowed. Please keep all communication within the app.",
      category: 'contact',
    };
  }
  
  // Check for emails
  if (detectEmail(text)) {
    return {
      isBlocked: true,
      reason: "Sharing contact details or directing users off Flea isn't allowed. Please keep all communication within the app.",
      category: 'contact',
    };
  }
  
  // Check for social media
  if (detectSocialMedia(text, options)) {
    return {
      isBlocked: true,
      reason: "Sharing contact details or directing users off Flea isn't allowed. Please keep all communication within the app.",
      category: 'social',
    };
  }
  
  // Check for URLs
  if (detectUrl(text)) {
    return {
      isBlocked: true,
      reason: "Sharing contact details or directing users off Flea isn't allowed. Please keep all communication within the app.",
      category: 'url',
    };
  }
  
  return { isBlocked: false, reason: null, category: null };
}

// Check multiple fields at once
export function moderateFields(fields: Record<string, string | undefined>, options?: ModerationOptions): ModerationResult {
  for (const [field, value] of Object.entries(fields)) {
    if (value && typeof value === 'string') {
      const result = moderateContent(value, options);
      if (result.isBlocked) {
        return { ...result, field };
      }
    }
  }
  return { isBlocked: false, reason: null, category: null };
}
