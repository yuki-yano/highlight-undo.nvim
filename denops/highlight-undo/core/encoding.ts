// Utilities for handling multi-byte characters and encoding

const encoder = new TextEncoder();

/**
 * Convert JavaScript string index to Vim column number (1-based, byte offset)
 */
export function jsIndexToVimColumn(text: string, jsIndex: number): number {
  if (jsIndex <= 0) return 1;
  if (jsIndex >= text.length) {
    return getByteLength(text) + 1;
  }

  // Get substring up to the index and calculate its byte length
  const substring = text.substring(0, jsIndex);
  return getByteLength(substring) + 1;
}

/**
 * Convert Vim column number (1-based, byte offset) to JavaScript string index
 */
export function vimColumnToJsIndex(text: string, vimColumn: number): number {
  if (vimColumn <= 1) return 0;

  const bytes = encoder.encode(text);
  const targetByteIndex = vimColumn - 1;

  if (targetByteIndex >= bytes.length) {
    return text.length;
  }

  // Find the character index that corresponds to the byte position
  let byteCount = 0;
  let charIndex = 0;

  for (const char of text) {
    const charBytes = encoder.encode(char);
    if (byteCount + charBytes.length > targetByteIndex) {
      break;
    }
    byteCount += charBytes.length;
    charIndex++;
  }

  return charIndex;
}

/**
 * Get byte length of a string (UTF-8)
 */
export function getByteLength(text: string): number {
  return encoder.encode(text).length;
}

/**
 * Calculate display width of a string (considering East Asian Width)
 */
export function getDisplayWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    width += getCharDisplayWidth(char);
  }
  return width;
}

/**
 * Get display width of a single character
 */
function getCharDisplayWidth(char: string): number {
  const code = char.charCodeAt(0);

  // Control characters
  if (code < 0x20 || (code >= 0x7f && code < 0xa0)) {
    return 0;
  }

  // Combining characters
  if (isCombiningCharacter(code)) {
    return 0;
  }

  // Check for wide characters (CJK, etc.)
  if (isWideCharacter(code)) {
    return 2;
  }

  // Check for emoji and other special cases
  if (isEmoji(char)) {
    return 2;
  }

  return 1;
}

/**
 * Check if a character code is a combining character
 */
function isCombiningCharacter(code: number): boolean {
  return (
    (code >= 0x0300 && code <= 0x036f) || // Combining Diacritical Marks
    (code >= 0x1ab0 && code <= 0x1aff) || // Combining Diacritical Marks Extended
    (code >= 0x1dc0 && code <= 0x1dff) || // Combining Diacritical Marks Supplement
    (code >= 0x20d0 && code <= 0x20ff) || // Combining Diacritical Marks for Symbols
    (code >= 0xfe20 && code <= 0xfe2f) // Combining Half Marks
  );
}

/**
 * Check if a character code represents a wide character
 */
function isWideCharacter(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) || // Hangul Jamo
    (code >= 0x2329 && code <= 0x232a) || // Left/Right-Pointing Angle Bracket
    (code >= 0x2e80 && code <= 0x2e99) || // CJK Radicals Supplement
    (code >= 0x2e9b && code <= 0x2ef3) || // CJK Radicals Supplement
    (code >= 0x2f00 && code <= 0x2fd5) || // Kangxi Radicals
    (code >= 0x2ff0 && code <= 0x2ffb) || // Ideographic Description Characters
    (code >= 0x3000 && code <= 0x303e) || // CJK Symbols and Punctuation
    (code >= 0x3041 && code <= 0x3096) || // Hiragana
    (code >= 0x3099 && code <= 0x30ff) || // Combining Kana + Katakana
    (code >= 0x3105 && code <= 0x312d) || // Bopomofo
    (code >= 0x3131 && code <= 0x318e) || // Hangul Compatibility Jamo
    (code >= 0x3190 && code <= 0x31ba) || // Kanbun
    (code >= 0x31c0 && code <= 0x31e3) || // CJK Strokes
    (code >= 0x31f0 && code <= 0x321e) || // Katakana Phonetic Extensions
    (code >= 0x3220 && code <= 0x3247) || // Enclosed CJK Letters and Months
    (code >= 0x3250 && code <= 0x32fe) || // Enclosed CJK Letters and Months
    (code >= 0x3300 && code <= 0x4dbf) || // CJK Compatibility + CJK Unified Ideographs Extension A
    (code >= 0x4e00 && code <= 0xa48c) || // CJK Unified Ideographs
    (code >= 0xa490 && code <= 0xa4c6) || // Yi Radicals
    (code >= 0xa960 && code <= 0xa97c) || // Hangul Jamo Extended-A
    (code >= 0xac00 && code <= 0xd7a3) || // Hangul Syllables
    (code >= 0xd7b0 && code <= 0xd7c6) || // Hangul Jamo Extended-B
    (code >= 0xd7cb && code <= 0xd7fb) || // Hangul Jamo Extended-B
    (code >= 0xf900 && code <= 0xfaff) || // CJK Compatibility Ideographs
    (code >= 0xfe10 && code <= 0xfe19) || // Vertical Forms
    (code >= 0xfe30 && code <= 0xfe52) || // CJK Compatibility Forms
    (code >= 0xfe54 && code <= 0xfe66) || // Small Form Variants
    (code >= 0xfe68 && code <= 0xfe6b) || // Small Form Variants
    (code >= 0xff01 && code <= 0xff60) || // Fullwidth ASCII
    (code >= 0xffe0 && code <= 0xffe6) // Fullwidth Symbol
  );
}

/**
 * Check if a character is an emoji
 */
function isEmoji(char: string): boolean {
  // Basic emoji detection (can be extended)
  const code = char.codePointAt(0) || 0;
  return (
    (code >= 0x1f300 && code <= 0x1f5ff) || // Misc Symbols and Pictographs
    (code >= 0x1f600 && code <= 0x1f64f) || // Emoticons
    (code >= 0x1f680 && code <= 0x1f6ff) || // Transport and Map
    (code >= 0x1f900 && code <= 0x1f9ff) || // Supplemental Symbols and Pictographs
    (code >= 0x2600 && code <= 0x26ff) || // Misc symbols
    (code >= 0x2700 && code <= 0x27bf) // Dingbats
  );
}

/**
 * Split text into grapheme clusters (user-perceived characters)
 */
export function splitIntoGraphemes(text: string): string[] {
  // Simple implementation - can be enhanced with Intl.Segmenter when available
  const graphemes: string[] = [];
  let current = "";

  for (const char of text) {
    if (current && isCombiningCharacter(char.charCodeAt(0))) {
      current += char;
    } else {
      if (current) {
        graphemes.push(current);
      }
      current = char;
    }
  }

  if (current) {
    graphemes.push(current);
  }

  return graphemes;
}

/**
 * Safely slice a string considering multi-byte characters
 */
export function safeSlice(text: string, start: number, end?: number): string {
  const graphemes = splitIntoGraphemes(text);
  return graphemes.slice(start, end).join("");
}

// Backward compatibility - static class wrapper
export class EncodingUtil {
  static jsIndexToVimColumn = jsIndexToVimColumn;
  static vimColumnToJsIndex = vimColumnToJsIndex;
  static getByteLength = getByteLength;
  static getDisplayWidth = getDisplayWidth;
  static splitIntoGraphemes = splitIntoGraphemes;
  static safeSlice = safeSlice;
}
