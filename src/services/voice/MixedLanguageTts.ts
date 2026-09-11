/**
 * Mixed Language Text-to-Speech (TTS) Pipeline for ANI Assistant.
 *
 * Provides:
 * 1. Number & Unit Normalization (Vietnamese & English).
 * 2. Aviation Technical Term Dictionary & Acronym Pronunciation.
 * 3. Language Segmentation (splitting mixed sentences into vi-VN and en-US segments).
 * 4. Merging and punctuation cleaning for natural sequential playback.
 */

export interface SpeechSegment {
  text: string;
  lang: 'vi-VN' | 'en-US';
}

// -----------------------------------------------------------------------------
// 1. Technical Term Dictionary & Acronym Mappings
// -----------------------------------------------------------------------------

/**
 * Acronyms that must be pronounced letter-by-letter in English (e.g. GPS -> G P S).
 */
export const ACRONYM_MAP: Record<string, string> = {
  GPS: 'G P S',
  GNSS: 'G N S S',
  HDOP: 'H D O P',
  VDOP: 'V D O P',
  EKF: 'E K F',
  RTL: 'R T L',
  PID: 'P I D',
  RTK: 'R T K',
  LTE: 'L T E',
  GCS: 'G C S',
  UAV: 'U A V',
  FPV: 'F P V',
  VTOL: 'V T O L',
  IMU: 'I M U',
};

/**
 * Technical drone and software terms that must always be pronounced with an English voice.
 * Mapped to title-cased or phonetic form so speech engines pronounce them naturally.
 */
export const TECHNICAL_TERM_MAP: Record<string, string> = {
  // Flight Modes
  LOITER: 'Loiter',
  STABILIZE: 'Stabilize',
  ALTHOLD: 'Alt Hold',
  ALT_HOLD: 'Alt Hold',
  POSHOLD: 'Pos Hold',
  POS_HOLD: 'Pos Hold',
  RTL: 'R T L',
  LAND: 'Land',
  AUTO: 'Auto',
  GUIDED: 'Guided',
  ARM: 'Arm',
  DISARM: 'Disarm',
  ARMED: 'Armed',
  DISARMED: 'Disarmed',

  // Protocols & Hardware
  MAVLINK: 'Mavlink',
  PIXHAWK: 'Pixhawk',
  ARDUPILOT: 'ArduPilot',
  WAYPOINT: 'Waypoint',
  RANGEFINDER: 'Rangefinder',
  TELEMETRY: 'Telemetry',
  WEBSOCKET: 'WebSocket',
  WEBRTC: 'WebRTC',
  RTSP: 'RTSP',
  BLUETOOTH: 'Bluetooth',
  TAILSCALE: 'Tailscale',
  'WI-FI': 'Wi-Fi',
  WIFI: 'Wi-Fi',

  // Compound Terms
  'OPTICAL FLOW': 'Optical Flow',
};

// -----------------------------------------------------------------------------
// 2. Number Normalization (Vietnamese & English)
// -----------------------------------------------------------------------------

const VI_DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const VI_TENS = ['', 'mười', 'hai mươi', 'ba mươi', 'bốn mươi', 'năm mươi', 'sáu mươi', 'bảy mươi', 'tám mươi', 'chín mươi'];

/**
 * Converts integer 0-999 to Vietnamese words.
 */
export function intToVietnameseWords(num: number): string {
  if (num < 0) return 'âm ' + intToVietnameseWords(-num);
  if (num < 10) return VI_DIGITS[num];
  if (num < 20) {
    if (num === 10) return 'mười';
    if (num === 15) return 'mười lăm';
    return 'mười ' + (num === 11 ? 'một' : VI_DIGITS[num % 10]);
  }
  if (num < 100) {
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    if (ones === 0) return VI_TENS[tens];
    if (ones === 1) return VI_TENS[tens] + ' mốt';
    if (ones === 4) return VI_TENS[tens] + ' bốn';
    if (ones === 5) return VI_TENS[tens] + ' lăm';
    return VI_TENS[tens] + ' ' + VI_DIGITS[ones];
  }
  if (num < 1000) {
    const hundreds = Math.floor(num / 100);
    const remainder = num % 100;
    const hundredsStr = VI_DIGITS[hundreds] + ' trăm';
    if (remainder === 0) return hundredsStr;
    if (remainder < 10) return hundredsStr + ' linh ' + VI_DIGITS[remainder];
    return hundredsStr + ' ' + intToVietnameseWords(remainder);
  }
  return num.toString();
}

const NOT_LETTER_OR_SLASH = '(?![a-zA-Z\\u00C0-\\u024F\\u1EA0-\\u1EF9/])';

const EN_ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/**
 * Converts integer 0-999 to English words.
 */
export function intToEnglishWords(num: number): string {
  if (num < 0) return 'minus ' + intToEnglishWords(-num);
  if (num === 0) return 'zero';
  if (num < 20) return EN_ONES[num];
  if (num < 100) {
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    return ones === 0 ? EN_TENS[tens] : `${EN_TENS[tens]}-${EN_ONES[ones]}`;
  }
  if (num < 1000) {
    const hundreds = Math.floor(num / 100);
    const rem = num % 100;
    return rem === 0 ? `${EN_ONES[hundreds]} hundred` : `${EN_ONES[hundreds]} hundred ${intToEnglishWords(rem)}`;
  }
  return num.toString();
}

/**
 * Normalizes numbers, decimals, and physical units in a Vietnamese text string.
 */
export function normalizeVietnameseNumbers(text: string): string {
  let out = text;

  // Percentage: 74% -> bảy mươi bốn phần trăm
  out = out.replace(/(\d+)[.,](\d+)\s*%/g, (_, a, b) => {
    return `${intToVietnameseWords(parseInt(a, 10))} phẩy ${VI_DIGITS[parseInt(b[0], 10)] ?? b} phần trăm`;
  });
  out = out.replace(/(\d+)\s*%/g, (_, n) => {
    return `${intToVietnameseWords(parseInt(n, 10))} phần trăm`;
  });

  // Units with numbers:
  // Speed: m/s, km/h
  const msDec = new RegExp(`(\\d+)[.,](\\d+)\\s*m/s${NOT_LETTER_OR_SLASH}`, 'gi');
  const msInt = new RegExp(`(\\d+)\\s*m/s${NOT_LETTER_OR_SLASH}`, 'gi');
  out = out.replace(msDec, (_, a, b) => `${intToVietnameseWords(parseInt(a, 10))} phẩy ${VI_DIGITS[parseInt(b[0], 10)] ?? b} mét trên giây`);
  out = out.replace(msInt, (_, n) => `${intToVietnameseWords(parseInt(n, 10))} mét trên giây`);

  const kmhDec = new RegExp(`(\\d+)[.,](\\d+)\\s*km/h${NOT_LETTER_OR_SLASH}`, 'gi');
  const kmhInt = new RegExp(`(\\d+)\\s*km/h${NOT_LETTER_OR_SLASH}`, 'gi');
  out = out.replace(kmhDec, (_, a, b) => `${intToVietnameseWords(parseInt(a, 10))} phẩy ${VI_DIGITS[parseInt(b[0], 10)] ?? b} ki lô mét một giờ`);
  out = out.replace(kmhInt, (_, n) => `${intToVietnameseWords(parseInt(n, 10))} ki lô mét một giờ`);

  // Electrical: V, A, mAh
  const vDec = new RegExp(`(\\d+)[.,](\\d+)\\s*V${NOT_LETTER_OR_SLASH}`, 'g');
  const vInt = new RegExp(`(\\d+)\\s*V${NOT_LETTER_OR_SLASH}`, 'g');
  out = out.replace(vDec, (_, a, b) => `${intToVietnameseWords(parseInt(a, 10))} phẩy ${VI_DIGITS[parseInt(b[0], 10)] ?? b} vôn`);
  out = out.replace(vInt, (_, n) => `${intToVietnameseWords(parseInt(n, 10))} vôn`);

  const mahInt = new RegExp(`(\\d+)\\s*mAh${NOT_LETTER_OR_SLASH}`, 'gi');
  out = out.replace(mahInt, (_, n) => `${intToVietnameseWords(parseInt(n, 10))} mi li am pe giờ`);

  const aDec = new RegExp(`(\\d+)[.,](\\d+)\\s*A${NOT_LETTER_OR_SLASH}`, 'g');
  const aInt = new RegExp(`(\\d+)\\s*A${NOT_LETTER_OR_SLASH}`, 'g');
  out = out.replace(aDec, (_, a, b) => `${intToVietnameseWords(parseInt(a, 10))} phẩy ${VI_DIGITS[parseInt(b[0], 10)] ?? b} am pe`);
  out = out.replace(aInt, (_, n) => `${intToVietnameseWords(parseInt(n, 10))} am pe`);

  // Satellites: 18 SAT / 18 sats
  out = out.replace(/(\d+)\s*(?:SAT|sats?|vệ tinh)\b/gi, (_, n) => `${intToVietnameseWords(parseInt(n, 10))} vệ tinh`);

  // Altitude / Distance: 5.2 m -> năm phẩy hai mét; 5.2 mét -> năm phẩy hai mét
  const mDec = new RegExp(`(\\d+)[.,](\\d+)\\s*(?:mét${NOT_LETTER_OR_SLASH}|m${NOT_LETTER_OR_SLASH})`, 'gi');
  const mInt = new RegExp(`(\\d+)\\s*(?:mét${NOT_LETTER_OR_SLASH}|m${NOT_LETTER_OR_SLASH})`, 'gi');
  out = out.replace(mDec, (_, a, b) => `${intToVietnameseWords(parseInt(a, 10))} phẩy ${VI_DIGITS[parseInt(b[0], 10)] ?? b} mét`);
  out = out.replace(mInt, (_, n) => `${intToVietnameseWords(parseInt(n, 10))} mét`);

  // Standalone decimals: 5.2 -> năm phẩy hai
  out = out.replace(/\b(\d+)\.(\d+)\b/g, (_, a, b) => `${intToVietnameseWords(parseInt(a, 10))} phẩy ${VI_DIGITS[parseInt(b[0], 10)] ?? b}`);

  return out;
}

/**
 * Normalizes numbers, decimals, and physical units in an English text string.
 */
export function normalizeEnglishNumbers(text: string): string {
  let out = text;

  // Percentage: 74% -> seventy-four percent
  out = out.replace(/(\d+)[.,](\d+)\s*%/g, (_, a, b) => {
    return `${intToEnglishWords(parseInt(a, 10))} point ${EN_ONES[parseInt(b[0], 10)] ?? b} percent`;
  });
  out = out.replace(/(\d+)\s*%/g, (_, n) => {
    return `${intToEnglishWords(parseInt(n, 10))} percent`;
  });

  // Units
  out = out.replace(/(\d+)[.,](\d+)\s*m\/s\b/gi, (_, a, b) => `${intToEnglishWords(parseInt(a, 10))} point ${EN_ONES[parseInt(b[0], 10)] ?? b} meters per second`);
  out = out.replace(/(\d+)\s*m\/s\b/gi, (_, n) => `${intToEnglishWords(parseInt(n, 10))} meters per second`);

  out = out.replace(/(\d+)[.,](\d+)\s*V\b/g, (_, a, b) => `${intToEnglishWords(parseInt(a, 10))} point ${EN_ONES[parseInt(b[0], 10)] ?? b} volts`);
  out = out.replace(/(\d+)\s*V\b/g, (_, n) => `${intToEnglishWords(parseInt(n, 10))} volts`);

  out = out.replace(/(\d+)\s*(?:SAT|sats?)\b/gi, (_, n) => `${intToEnglishWords(parseInt(n, 10))} satellites`);

  out = out.replace(/(\d+)[.,](\d+)\s*(?:m\b|meters?\b)/gi, (_, a, b) => `${intToEnglishWords(parseInt(a, 10))} point ${EN_ONES[parseInt(b[0], 10)] ?? b} meters`);
  out = out.replace(/(\d+)\s*(?:m\b|meters?\b)/gi, (_, n) => `${intToEnglishWords(parseInt(n, 10))} meters`);

  // Standalone decimals: 5.2 -> five point two
  out = out.replace(/\b(\d+)\.(\d+)\b/g, (_, a, b) => `${intToEnglishWords(parseInt(a, 10))} point ${EN_ONES[parseInt(b[0], 10)] ?? b}`);

  return out;
}

// -----------------------------------------------------------------------------
// 3. Language Detection Helpers
// -----------------------------------------------------------------------------

const VIETNAMESE_DIACRITICS_REGEX = /[àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i;

const VIETNAMESE_COMMON_WORDS = new Set([
  'pin', 'còn', 'đang', 'ở', 'độ', 'cao', 'là', 'và', 'của', 'với', 'trong', 'trên', 'dưới',
  'được', 'không', 'có', 'vệ', 'tinh', 'mét', 'giây', 'vôn', 'phần', 'trăm', 'bật', 'tắt',
  'hạ', 'cánh', 'cất', 'quay', 'về', 'giữ', 'vị', 'trí', 'hệ', 'thống', 'thiết', 'bị',
  'khoảng', 'cách', 'tín', 'hiệu', 'kết', 'nối', 'cảnh', 'báo', 'lỗi', 'đạt', 'an', 'toàn'
]);

/**
 * Determines whether a given text snippet is predominantly Vietnamese.
 */
export function isVietnameseText(text: string): boolean {
  if (VIETNAMESE_DIACRITICS_REGEX.test(text)) return true;
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return false;
  let viCount = 0;
  for (const w of words) {
    const clean = w.replace(/[^a-z0-9àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/gi, '');
    if (VIETNAMESE_COMMON_WORDS.has(clean)) viCount++;
  }
  return viCount > 0;
}

// -----------------------------------------------------------------------------
// 4. Language Segmentation Pipeline
// -----------------------------------------------------------------------------

/**
 * Regex matching any technical term or acronym from the dictionaries.
 */
function buildDictionaryRegex(): RegExp {
  const terms = Object.keys({ ...ACRONYM_MAP, ...TECHNICAL_TERM_MAP });
  // Sort longest terms first so compound terms like "OPTICAL FLOW" match before "FLOW"
  terms.sort((a, b) => b.length - a.length);
  const pattern = terms.map(t => t.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
  return new RegExp(`\\b(${pattern})\\b`, 'gi');
}

const DICTIONARY_REGEX = buildDictionaryRegex();

/**
 * Normalizes an individual token or technical term to its spoken pronunciation.
 */
export function pronounceTerm(term: string): string {
  const upper = term.toUpperCase();
  if (ACRONYM_MAP[upper]) return ACRONYM_MAP[upper];
  if (TECHNICAL_TERM_MAP[upper]) return TECHNICAL_TERM_MAP[upper];
  return term;
}

/**
 * Splits text into sentences preserving standard punctuation.
 */
function splitIntoSentences(text: string): string[] {
  // Split on '.', '!', '?', or newline followed by space or end of string
  const raw = text.split(/(?<=[.!?\n])\s+/);
  return raw.map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Segments a single sentence into mixed vi-VN and en-US segments.
 */
function segmentSentence(sentence: string): SpeechSegment[] {
  // Check if the entire sentence (excluding punctuation) is purely English
  const hasVietnamese = isVietnameseText(sentence);

  if (!hasVietnamese) {
    // Pure English sentence: expand acronyms and technical terms, then normalize numbers
    const processed = sentence.replace(DICTIONARY_REGEX, match => pronounceTerm(match));
    const normalized = normalizeEnglishNumbers(processed);
    return [{ text: normalized.trim(), lang: 'en-US' }];
  }

  // Mixed sentence: isolate technical terms as en-US, leaving surrounding text as vi-VN
  const segments: SpeechSegment[] = [];
  let lastIndex = 0;
  DICTIONARY_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = DICTIONARY_REGEX.exec(sentence)) !== null) {
    const startIndex = match.index;
    const matchedTerm = match[0];
    const endIndex = startIndex + matchedTerm.length;

    // Preceding Vietnamese segment
    if (startIndex > lastIndex) {
      const prevText = sentence.slice(lastIndex, startIndex).trim();
      if (prevText && /[a-zA-Z0-9àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i.test(prevText)) {
        segments.push({
          text: normalizeVietnameseNumbers(prevText),
          lang: 'vi-VN',
        });
      }
    }

    // English technical term segment
    segments.push({
      text: pronounceTerm(matchedTerm),
      lang: 'en-US',
    });

    lastIndex = endIndex;
  }

  // Trailing Vietnamese segment
  if (lastIndex < sentence.length) {
    const remainingText = sentence.slice(lastIndex).trim();
    if (remainingText && /[a-zA-Z0-9àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i.test(remainingText)) {
      segments.push({
        text: normalizeVietnameseNumbers(remainingText),
        lang: 'vi-VN',
      });
    }
  }

  return segments;
}

/**
 * Merges adjacent segments that share the same language.
 */
function mergeAdjacentSegments(segments: SpeechSegment[]): SpeechSegment[] {
  const merged: SpeechSegment[] = [];
  for (const seg of segments) {
    const cleanText = seg.text.trim();
    if (!cleanText) continue;
    if (!/[a-zA-Z0-9àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i.test(cleanText)) {
      continue;
    }

    const last = merged[merged.length - 1];
    if (last && last.lang === seg.lang) {
      // Connect with space or appropriate punctuation
      const needsSpace = !last.text.endsWith(' ') && !cleanText.startsWith(' ') && !/^[,.:;?!]/.test(cleanText);
      last.text = `${last.text}${needsSpace ? ' ' : ''}${cleanText}`;
    } else {
      merged.push({ text: cleanText, lang: seg.lang });
    }
  }
  return merged;
}

/**
 * Strips Markdown formatting, code fences, and emojis while preserving words, numbers, and technical terms.
 */
export function cleanMarkdownForSpeech(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let out = text;
  out = out.replace(/```[\s\S]*?```/g, ' ');
  out = out.replace(/`([^`]+)`/g, '$1');
  out = out.replace(/\{[^{}]*:[^{}]*\}/g, ' ');
  out = out.replace(/https?:\/\/\S+/g, ' ');
  out = out.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
  out = out.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  out = out.replace(/^[ \t]*\|?[-: ]+\|[-: |]*$/gm, ' ');
  out = out.replace(/\|/g, ', ');
  out = out.replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, ' ');
  out = out.replace(/^[ \t]*#{1,6}[ \t]+/gm, ' ');
  out = out.replace(/^[ \t]*[-*+•][ \t]+/gm, ', ');
  out = out.replace(/^[ \t]*\d+[\.)][ \t]+/gm, ', ');
  out = out.replace(/^[ \t]*>[ \t]*/gm, ' ');
  out = out.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1');
  out = out.replace(/_{1,3}([^_]+)_{1,3}/g, '$1');
  out = out.replace(/~{1,2}([^~]+)~{1,2}/g, '$1');
  out = out.replace(/\[\s*Using local fallback:[^\]]*\]/gi, ' ');
  out = out.replace(/[[\]{}()<>]/g, ' ');
  out = out.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, ' ');
  out = out.replace(/\s+/g, ' ').trim();
  return out;
}

/**
 * Main Entry Point:
 * Segments an arbitrary AI flight response into an ordered array of
 * language-tagged speech segments (vi-VN / en-US).
 *
 * Example:
 * Input:  "Pin còn 74%. GPS signal is stable. Drone đang ở LOITER ở độ cao 5.2 mét."
 * Output:
 * [
 *   { text: "Pin còn bảy mươi bốn phần trăm.", lang: "vi-VN" },
 *   { text: "G P S signal is stable.", lang: "en-US" },
 *   { text: "Drone đang ở", lang: "vi-VN" },
 *   { text: "Loiter", lang: "en-US" },
 *   { text: "ở độ cao năm phẩy hai mét.", lang: "vi-VN" }
 * ]
 */
export function segmentMixedText(rawText: string): SpeechSegment[] {
  if (!rawText || typeof rawText !== 'string') return [];

  const cleaned = cleanMarkdownForSpeech(rawText);
  if (!cleaned) return [];

  const sentences = splitIntoSentences(cleaned);
  const allSegments: SpeechSegment[] = [];

  for (const sentence of sentences) {
    const sentenceSegments = segmentSentence(sentence);
    allSegments.push(...sentenceSegments);
  }

  return mergeAdjacentSegments(allSegments);
}

