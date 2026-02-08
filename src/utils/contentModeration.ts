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
const SOCIAL_PLATFORMS = [
  'instagram', 'insta', 'ig',
  'tiktok', 'tik tok', 'tt',
  'snapchat', 'snap', 'sc',
  'whatsapp', 'whats app', 'wa',
  'facebook', 'fb', 'messenger',
  'twitter', 'x.com',
  'telegram', 'discord', 'signal',
  'wechat', 'line', 'viber', 'kik',
  'linkedin', 'youtube', 'yt',
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
  
  // Standard email pattern
  const emailPattern = /[a-z0-9._%+-]+\s*[@\(\[at\]]\s*[a-z0-9.-]+\s*[.\(\[dot\]]\s*[a-z]{2,}/i;
  if (emailPattern.test(normalized)) {
    return true;
  }
  
  // Obfuscated email patterns
  const obfuscatedPatterns = [
    /\w+\s*\(?at\)?\s*\w+\s*\(?dot\)?\s*\w+/i,
    /\w+\s*\[at\]\s*\w+\s*\[dot\]\s*\w+/i,
    /\w+\s*-at-\s*\w+\s*-dot-\s*\w+/i,
  ];
  
  for (const pattern of obfuscatedPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  return false;
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
function detectSocialMedia(text: string): boolean {
  const normalized = normalizeText(text);
  const stripped = stripAllNonAlphanumeric(text);
  
  for (const platform of SOCIAL_PLATFORMS) {
    const strippedPlatform = stripAllNonAlphanumeric(platform);
    
    // Check normalized text
    if (normalized.includes(platform)) {
      return true;
    }
    
    // Check stripped text (catches spaced/punctuated versions)
    if (stripped.includes(strippedPlatform)) {
      return true;
    }
  }
  
  // Check for @ handles pattern (social media usernames)
  if (/@[a-z0-9_]{2,}/i.test(text) && !text.includes('@user')) {
    // Exclude @user which might be legitimate
    return true;
  }
  
  return false;
}

// Detect profanity
function detectProfanity(text: string): boolean {
  const normalized = normalizeText(text);
  
  for (const word of PROFANITY_LIST) {
    // Only check as whole word to avoid false positives
    // e.g., "classic" should not match "ass", "ladies" should not match "die"
    const wordPattern = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (wordPattern.test(normalized)) {
      return true;
    }
  }
  
  return false;
}

// Main moderation function
export function moderateContent(text: string): ModerationResult {
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
  if (detectSocialMedia(text)) {
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
export function moderateFields(fields: Record<string, string | undefined>): ModerationResult {
  for (const [field, value] of Object.entries(fields)) {
    if (value && typeof value === 'string') {
      const result = moderateContent(value);
      if (result.isBlocked) {
        return { ...result, field };
      }
    }
  }
  return { isBlocked: false, reason: null, category: null };
}
