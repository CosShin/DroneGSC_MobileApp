export type SpeechLanguage = 'vi-VN' | 'en-US';

// Non-letter boundary lookahead that handles unicode accented characters (e.g. 'mét', 'vôn')
const NOT_LETTER_OR_SLASH = '(?![a-zA-Z\\u00C0-\\u024F\\u1EA0-\\u1EF9/])';
const NOT_LETTER = '(?![a-zA-Z\\u00C0-\\u024F\\u1EA0-\\u1EF9])';

/**
 * Prepares raw text from AI copilot for natural, human-like voice synthesis.
 * Strips all Markdown formatting, symbols, tables, JSON code blocks,
 * and phonetically expands aviation telemetry units into natural spoken language.
 */
export function prepareTextForSpeech(text: string, language: SpeechLanguage = 'vi-VN'): string {
  if (!text || typeof text !== 'string') return '';

  let out = text;

  // 1. Remove JSON code blocks and markdown code fences
  out = out.replace(/```[\s\S]*?```/g, ' ');
  out = out.replace(/`([^`]+)`/g, '$1');

  // 2. Strip JSON payload blocks like {"voltage": 14.8}
  out = out.replace(/\{[^{}]*:[^{}]*\}/g, ' ');

  // 3. Remove raw URLs and image tags
  out = out.replace(/https?:\/\/\S+/g, ' ');
  out = out.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
  out = out.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

  // 4. Handle Markdown tables: strip table separator lines and outer pipes
  out = out.replace(/^[ \t]*\|?[-: ]+\|[-: |]*$/gm, ' ');
  out = out.replace(/\|/g, ', ');

  // 5. Remove horizontal rules and header markers
  out = out.replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, ' ');
  out = out.replace(/^[ \t]*#{1,6}[ \t]+/gm, ' ');

  // 6. Convert list bullets & numbered items to natural spoken pauses
  out = out.replace(/^[ \t]*[-*+•][ \t]+/gm, ', ');
  out = out.replace(/^[ \t]*\d+[\.)][ \t]+/gm, ', ');

  // 7. Strip blockquote symbols
  out = out.replace(/^[ \t]*>[ \t]*/gm, ' ');

  // 8. Convert checkmarks, warnings, error symbols to spoken phrases
  if (language === 'vi-VN') {
    out = out.replace(/✓/g, 'Đạt ');
    out = out.replace(/⚠️/g, 'Cảnh báo: ');
    out = out.replace(/❌/g, 'Lỗi: ');
  } else {
    out = out.replace(/✓/g, 'Passed ');
    out = out.replace(/⚠️/g, 'Warning: ');
    out = out.replace(/❌/g, 'Error: ');
  }

  // 9. Strip bold, italic, and strikethrough markup
  out = out.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1');
  out = out.replace(/_{1,3}([^_]+)_{1,3}/g, '$1');
  out = out.replace(/~{1,2}([^~]+)~{1,2}/g, '$1');

  // 10. Strip brackets, braces, and technical framing tokens
  out = out.replace(/\[\s*Using local fallback:[^\]]*\]/gi, ' ');
  out = out.replace(/[\[\]{}()<>]/g, ' ');
  out = out.replace(/[=_^\\~`]/g, ' ');

  // 11. Language-Specific Phonetic Telemetry Conversion
  if (language === 'vi-VN') {
    // PreArm warnings
    out = out.replace(/\bPreArm:\s*/gi, 'Cảnh báo trước khi cất cánh: ');

    // Flight modes
    out = out.replace(/\bARMED\b/g, 'đã arm, sẵn sàng cất cánh');
    out = out.replace(/\bDISARMED\b/g, 'đã disarm, động cơ đã tắt');
    out = out.replace(/\bLOITER\b/g, 'chế độ Loiter giữ vị trí');
    out = out.replace(/\bGUIDED\b/g, 'chế độ Guided tự định vị');
    out = out.replace(/\bRETURN_TO_LAUNCH\b|\bRTL\b/g, 'chế độ quay về R T L');
    out = out.replace(/\bAUTO\b/g, 'chế độ bay tự động Auto');
    out = out.replace(/\bSTABILIZE\b/g, 'chế độ cân bằng Stabilize');
    out = out.replace(/\bALT_HOLD\b/g, 'chế độ giữ độ cao Alt Hold');
    out = out.replace(/\bLAND\b/g, 'chế độ hạ cánh');

    // Telemetry labels
    out = out.replace(/(?:GPS|Sats?)\s*[:=]?\s*(\d+)\b/gi, 'GPS $1 vệ tinh');
    out = out.replace(/(?:Batt|Battery)\s*[:=]?\s*(\d+)\s*%/gi, 'Pin $1 phần trăm');

    // Compound units (m/s, km/h) before simple units (m)
    const msDecRegex = new RegExp(`(\\d+)[.,](\\d+)\\s*m/s${NOT_LETTER}`, 'gi');
    const msIntRegex = new RegExp(`(\\d+)\\s*m/s${NOT_LETTER}`, 'gi');
    out = out.replace(msDecRegex, '$1 phẩy $2 mét trên giây');
    out = out.replace(msIntRegex, '$1 mét trên giây');

    const kmhDecRegex = new RegExp(`(\\d+)[.,](\\d+)\\s*km/h${NOT_LETTER}`, 'gi');
    const kmhIntRegex = new RegExp(`(\\d+)\\s*km/h${NOT_LETTER}`, 'gi');
    out = out.replace(kmhDecRegex, '$1 phẩy $2 ki lô mét một giờ');
    out = out.replace(kmhIntRegex, '$1 ki lô mét một giờ');

    // Electrical units (V, A, mAh)
    const vDecRegex = new RegExp(`(\\d+)[.,](\\d+)\\s*V${NOT_LETTER}`, 'g');
    const vIntRegex = new RegExp(`(\\d+)\\s*V${NOT_LETTER}`, 'g');
    out = out.replace(vDecRegex, '$1 phẩy $2 vôn');
    out = out.replace(vIntRegex, '$1 vôn');

    const mahDecRegex = new RegExp(`(\\d+)[.,](\\d+)\\s*mAh${NOT_LETTER}`, 'gi');
    const mahIntRegex = new RegExp(`(\\d+)\\s*mAh${NOT_LETTER}`, 'gi');
    out = out.replace(mahDecRegex, '$1 phẩy $2 mi li am pe giờ');
    out = out.replace(mahIntRegex, '$1 mi li am pe giờ');

    const aDecRegex = new RegExp(`(\\d+)[.,](\\d+)\\s*A${NOT_LETTER}`, 'g');
    const aIntRegex = new RegExp(`(\\d+)\\s*A${NOT_LETTER}`, 'g');
    out = out.replace(aDecRegex, '$1 phẩy $2 am pe');
    out = out.replace(aIntRegex, '$1 am pe');

    // Percentage & Angles / Temperature
    out = out.replace(/(\d+)[.,](\d+)\s*%/g, '$1 phẩy $2 phần trăm');
    out = out.replace(/(\d+)\s*%/g, '$1 phần trăm');

    const degCDecRegex = new RegExp(`(\\d+)[.,](\\d+)\\s*°C${NOT_LETTER}`, 'g');
    const degCIntRegex = new RegExp(`(\\d+)\\s*°C${NOT_LETTER}`, 'g');
    out = out.replace(degCDecRegex, '$1 phẩy $2 độ C');
    out = out.replace(degCIntRegex, '$1 độ C');

    const degDecRegex = new RegExp(`(\\d+)[.,](\\d+)\\s*°${NOT_LETTER}`, 'g');
    const degIntRegex = new RegExp(`(\\d+)\\s*°${NOT_LETTER}`, 'g');
    out = out.replace(degDecRegex, '$1 phẩy $2 độ');
    out = out.replace(degIntRegex, '$1 độ');

    // Milliseconds & Hertz
    const milliSecDecRegex = new RegExp(`(\\d+)[.,](\\d+)\\s*ms${NOT_LETTER}`, 'gi');
    const milliSecIntRegex = new RegExp(`(\\d+)\\s*ms${NOT_LETTER}`, 'gi');
    out = out.replace(milliSecDecRegex, '$1 phẩy $2 mili giây');
    out = out.replace(milliSecIntRegex, '$1 mili giây');

    const hzDecRegex = new RegExp(`(\\d+)[.,](\\d+)\\s*Hz${NOT_LETTER}`, 'gi');
    const hzIntRegex = new RegExp(`(\\d+)\\s*Hz${NOT_LETTER}`, 'gi');
    out = out.replace(hzDecRegex, '$1 phẩy $2 héc');
    out = out.replace(hzIntRegex, '$1 héc');

    // Distance meters (m) with safe non-letter/slash lookahead
    const mDecRegex = new RegExp(`(\\d+)[.,](\\d+)\\s*m${NOT_LETTER_OR_SLASH}`, 'gi');
    const mIntRegex = new RegExp(`(\\d+)\\s*m${NOT_LETTER_OR_SLASH}`, 'gi');
    out = out.replace(mDecRegex, '$1 phẩy $2 mét');
    out = out.replace(mIntRegex, '$1 mét');

    // Technical acronyms
    out = out.replace(/\bMAVLink\b/gi, 'Máp-link');
    out = out.replace(/\bSYSID\b/g, 'hệ thống');
    out = out.replace(/\bCOMPID\b/g, 'thành phần');
    out = out.replace(/\bHDOP\b/g, 'H-DOP');

    // General decimal numbers: 14.8 -> 14 phẩy 8
    out = out.replace(/(\d+)\.(\d+)/g, '$1 phẩy $2');
  } else {
    // English (en-US)
    // PreArm warnings
    out = out.replace(/\bPreArm:\s*/gi, 'Pre arm warning: ');

    // Flight modes
    out = out.replace(/\bARMED\b/g, 'armed and ready for flight');
    out = out.replace(/\bDISARMED\b/g, 'disarmed, motors off');
    out = out.replace(/\bLOITER\b/g, 'Loiter mode');
    out = out.replace(/\bGUIDED\b/g, 'Guided mode');
    out = out.replace(/\bRETURN_TO_LAUNCH\b|\bRTL\b/g, 'Return to Launch mode');
    out = out.replace(/\bAUTO\b/g, 'Auto mode');
    out = out.replace(/\bSTABILIZE\b/g, 'Stabilize mode');
    out = out.replace(/\bALT_HOLD\b/g, 'Altitude hold mode');
    out = out.replace(/\bLAND\b/g, 'Land mode');

    // Telemetry labels
    out = out.replace(/(?:GPS|Sats?)\s*[:=]?\s*(\d+)\b/gi, 'GPS $1 satellites');
    out = out.replace(/(?:Batt|Battery)\s*[:=]?\s*(\d+)\s*%/gi, 'Battery $1 percent');

    // Compound units
    const msDecRegex = new RegExp(`(\\d+)[.,](\\d+)\\s*m/s${NOT_LETTER}`, 'gi');
    const msIntRegex = new RegExp(`(\\d+)\\s*m/s${NOT_LETTER}`, 'gi');
    out = out.replace(msDecRegex, '$1 point $2 meters per second');
    out = out.replace(msIntRegex, '$1 meters per second');

    const kmhDecRegex = new RegExp(`(\\d+)[.,](\\d+)\\s*km/h${NOT_LETTER}`, 'gi');
    const kmhIntRegex = new RegExp(`(\\d+)\\s*km/h${NOT_LETTER}`, 'gi');
    out = out.replace(kmhDecRegex, '$1 point $2 kilometers per hour');
    out = out.replace(kmhIntRegex, '$1 kilometers per hour');

    // Electrical units
    const vDecRegex = new RegExp(`(\\d+)[.,](\\d+)\\s*V${NOT_LETTER}`, 'g');
    const vIntRegex = new RegExp(`(\\d+)\\s*V${NOT_LETTER}`, 'g');
    out = out.replace(vDecRegex, '$1 point $2 volts');
    out = out.replace(vIntRegex, '$1 volts');

    const mahDecRegex = new RegExp(`(\\d+)[.,](\\d+)\\s*mAh${NOT_LETTER}`, 'gi');
    const mahIntRegex = new RegExp(`(\\d+)\\s*mAh${NOT_LETTER}`, 'gi');
    out = out.replace(mahDecRegex, '$1 point $2 milliamp hours');
    out = out.replace(mahIntRegex, '$1 milliamp hours');

    const aDecRegex = new RegExp(`(\\d+)[.,](\\d+)\\s*A${NOT_LETTER}`, 'g');
    const aIntRegex = new RegExp(`(\\d+)\\s*A${NOT_LETTER}`, 'g');
    out = out.replace(aDecRegex, '$1 point $2 amps');
    out = out.replace(aIntRegex, '$1 amps');

    // Percentage & Angles / Temperature
    out = out.replace(/(\d+)[.,](\d+)\s*%/g, '$1 point $2 percent');
    out = out.replace(/(\d+)\s*%/g, '$1 percent');

    const degCDecRegex = new RegExp(`(\\d+)[.,](\\d+)\\s*°C${NOT_LETTER}`, 'g');
    const degCIntRegex = new RegExp(`(\\d+)\\s*°C${NOT_LETTER}`, 'g');
    out = out.replace(degCDecRegex, '$1 point $2 degrees Celsius');
    out = out.replace(degCIntRegex, '$1 degrees Celsius');

    const degDecRegex = new RegExp(`(\\d+)[.,](\\d+)\\s*°${NOT_LETTER}`, 'g');
    const degIntRegex = new RegExp(`(\\d+)\\s*°${NOT_LETTER}`, 'g');
    out = out.replace(degDecRegex, '$1 point $2 degrees');
    out = out.replace(degIntRegex, '$1 degrees');

    // Milliseconds & Hertz
    const milliSecDecRegex = new RegExp(`(\\d+)[.,](\\d+)\\s*ms${NOT_LETTER}`, 'gi');
    const milliSecIntRegex = new RegExp(`(\\d+)\\s*ms${NOT_LETTER}`, 'gi');
    out = out.replace(milliSecDecRegex, '$1 point $2 milliseconds');
    out = out.replace(milliSecIntRegex, '$1 milliseconds');

    const hzDecRegex = new RegExp(`(\\d+)[.,](\\d+)\\s*Hz${NOT_LETTER}`, 'gi');
    const hzIntRegex = new RegExp(`(\\d+)\\s*Hz${NOT_LETTER}`, 'gi');
    out = out.replace(hzDecRegex, '$1 point $2 hertz');
    out = out.replace(hzIntRegex, '$1 hertz');

    // Distance meters (m)
    const mDecRegex = new RegExp(`(\\d+)[.,](\\d+)\\s*m${NOT_LETTER_OR_SLASH}`, 'gi');
    const mIntRegex = new RegExp(`(\\d+)\\s*m${NOT_LETTER_OR_SLASH}`, 'gi');
    out = out.replace(mDecRegex, '$1 point $2 meters');
    out = out.replace(mIntRegex, '$1 meters');

    // Technical acronyms
    out = out.replace(/\bMAVLink\b/gi, 'Mavlink');
    out = out.replace(/\bSYSID\b/g, 'system I D');
    out = out.replace(/\bCOMPID\b/g, 'component I D');

    // General decimal numbers: 14.8 -> 14 point 8
    out = out.replace(/(\d+)\.(\d+)/g, '$1 point $2');
  }

  // 12. Strip remaining emojis and non-standard unicode symbols
  out = out.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, ' ');

  // 13. Clean up commas, dashes, and duplicate punctuation
  out = out.replace(/[ \t]*,[ \t]*,+/g, ',');
  out = out.replace(/\s*([,.:;?!])\s*/g, '$1 ');
  out = out.replace(/\s+/g, ' ').trim();

  // 14. Remove leading punctuation artifacts
  out = out.replace(/^[,.:;?!-]+\s*/, '');

  return out;
}
