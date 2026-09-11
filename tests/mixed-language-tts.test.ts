import test from 'node:test';
import assert from 'node:assert/strict';
import {
  segmentMixedText,
  cleanMarkdownForSpeech,
  intToVietnameseWords,
  intToEnglishWords,
  normalizeVietnameseNumbers,
  normalizeEnglishNumbers,
  pronounceTerm,
  ACRONYM_MAP,
  TECHNICAL_TERM_MAP,
} from '../src/services/voice/MixedLanguageTts';
import {
  AniSpeechQueue,
  type QueueSegmentItem,
} from '../src/services/voice/AniSpeechQueue';
import { AiSpeechService } from '../src/services/voice/AiSpeechService';

test('1. Exact Benchmark: splits mixed sentence into 5 segments with vi-VN and en-US', () => {
  const input = 'Pin còn 74%. GPS signal is stable. Drone đang ở LOITER ở độ cao 5.2 mét.';
  const segments = segmentMixedText(input);

  assert.equal(segments.length, 5);

  assert.deepEqual(segments[0], {
    text: 'Pin còn bảy mươi bốn phần trăm.',
    lang: 'vi-VN',
  });

  assert.deepEqual(segments[1], {
    text: 'G P S signal is stable.',
    lang: 'en-US',
  });

  assert.deepEqual(segments[2], {
    text: 'Drone đang ở',
    lang: 'vi-VN',
  });

  assert.deepEqual(segments[3], {
    text: 'Loiter',
    lang: 'en-US',
  });

  assert.deepEqual(segments[4], {
    text: 'ở độ cao năm phẩy hai mét.',
    lang: 'vi-VN',
  });
});

test('2. Prompt Section 1 scenario: Battery 75%, GPS good, LOITER', () => {
  const input = 'Pin hiện tại còn 75%. GPS signal is good. Drone đang ở LOITER.';
  const segments = segmentMixedText(input);

  assert.equal(segments.length, 4);

  assert.equal(segments[0].text, 'Pin hiện tại còn bảy mươi lăm phần trăm.');
  assert.equal(segments[0].lang, 'vi-VN');

  assert.equal(segments[1].text, 'G P S signal is good.');
  assert.equal(segments[1].lang, 'en-US');

  assert.equal(segments[2].text, 'Drone đang ở');
  assert.equal(segments[2].lang, 'vi-VN');

  assert.equal(segments[3].text, 'Loiter');
  assert.equal(segments[3].lang, 'en-US');
});

test('3. Acronym pronunciation mappings', () => {
  assert.equal(pronounceTerm('GPS'), 'G P S');
  assert.equal(pronounceTerm('EKF'), 'E K F');
  assert.equal(pronounceTerm('HDOP'), 'H D O P');
  assert.equal(pronounceTerm('VDOP'), 'V D O P');
  assert.equal(pronounceTerm('RTL'), 'R T L');
  assert.equal(pronounceTerm('RTK'), 'R T K');
  assert.equal(pronounceTerm('PID'), 'P I D');
  assert.equal(pronounceTerm('LTE'), 'L T E');
  assert.equal(pronounceTerm('GNSS'), 'G N S S');
});

test('4. Drone technical term mappings', () => {
  assert.equal(pronounceTerm('LOITER'), 'Loiter');
  assert.equal(pronounceTerm('STABILIZE'), 'Stabilize');
  assert.equal(pronounceTerm('ALTHOLD'), 'Alt Hold');
  assert.equal(pronounceTerm('POSHOLD'), 'Pos Hold');
  assert.equal(pronounceTerm('MAVLINK'), 'Mavlink');
  assert.equal(pronounceTerm('PIXHAWK'), 'Pixhawk');
  assert.equal(pronounceTerm('ARDUPILOT'), 'ArduPilot');
  assert.equal(pronounceTerm('OPTICAL FLOW'), 'Optical Flow');
  assert.equal(pronounceTerm('WEBSOCKET'), 'WebSocket');
  assert.equal(pronounceTerm('WEBRTC'), 'WebRTC');
});

test('5. Vietnamese number to words conversion', () => {
  assert.equal(intToVietnameseWords(0), 'không');
  assert.equal(intToVietnameseWords(5), 'năm');
  assert.equal(intToVietnameseWords(10), 'mười');
  assert.equal(intToVietnameseWords(15), 'mười lăm');
  assert.equal(intToVietnameseWords(21), 'hai mươi mốt');
  assert.equal(intToVietnameseWords(74), 'bảy mươi bốn');
  assert.equal(intToVietnameseWords(75), 'bảy mươi lăm');
  assert.equal(intToVietnameseWords(100), 'một trăm');
  assert.equal(intToVietnameseWords(105), 'một trăm linh năm');
});

test('6. English number to words conversion', () => {
  assert.equal(intToEnglishWords(0), 'zero');
  assert.equal(intToEnglishWords(5), 'five');
  assert.equal(intToEnglishWords(15), 'fifteen');
  assert.equal(intToEnglishWords(74), 'seventy-four');
  assert.equal(intToEnglishWords(100), 'one hundred');
});

test('7. Vietnamese telemetry units normalization', () => {
  assert.equal(normalizeVietnameseNumbers('75%'), 'bảy mươi lăm phần trăm');
  assert.equal(normalizeVietnameseNumbers('5.2m'), 'năm phẩy hai mét');
  assert.equal(normalizeVietnameseNumbers('5.2 mét'), 'năm phẩy hai mét');
  assert.equal(normalizeVietnameseNumbers('15.4V'), 'mười lăm phẩy bốn vôn');
  assert.equal(normalizeVietnameseNumbers('18 SAT'), 'mười tám vệ tinh');
  assert.equal(normalizeVietnameseNumbers('12 m/s'), 'mười hai mét trên giây');
  assert.equal(normalizeVietnameseNumbers('45 km/h'), 'bốn mươi lăm ki lô mét một giờ');
  assert.equal(normalizeVietnameseNumbers('2.5 A'), 'hai phẩy năm am pe');
});

test('8. English telemetry units normalization', () => {
  assert.equal(normalizeEnglishNumbers('75%'), 'seventy-five percent');
  assert.equal(normalizeEnglishNumbers('5.2m'), 'five point two meters');
  assert.equal(normalizeEnglishNumbers('15.4V'), 'fifteen point four volts');
  assert.equal(normalizeEnglishNumbers('18 SAT'), 'eighteen satellites');
  assert.equal(normalizeEnglishNumbers('12 m/s'), 'twelve meters per second');
});

test('9. cleanMarkdownForSpeech strips formatting while preserving content', () => {
  const md = '**Cảnh báo**: Pin *yếu* 15.4V. Xem [chi tiết](url). `LOITER` mode active.';
  const cleaned = cleanMarkdownForSpeech(md);
  assert.equal(cleaned.includes('**'), false);
  assert.equal(cleaned.includes('*'), false);
  assert.equal(cleaned.includes('`'), false);
  assert.equal(cleaned.includes('['), false);
  assert.ok(cleaned.includes('Cảnh báo: Pin yếu 15.4V'));
  assert.ok(cleaned.includes('LOITER mode active'));
});

test('10. AniSpeechQueue plays items sequentially without overlap', async () => {
  const playbackLog: string[] = [];
  let currentlyPlaying = false;
  let overlapDetected = false;

  const queue = new AniSpeechQueue(
    (text, opts) => {
      if (currentlyPlaying) {
        overlapDetected = true;
      }
      currentlyPlaying = true;
      playbackLog.push(`START: ${text} (${opts.language})`);

      // Simulate asynchronous speech playback
      setTimeout(() => {
        playbackLog.push(`DONE: ${text}`);
        currentlyPlaying = false;
        opts.onDone?.();
      }, 20);
    },
    async () => {
      currentlyPlaying = false;
      playbackLog.push('STOPPED_NATIVE');
    }
  );

  const segments: QueueSegmentItem[] = [
    { text: 'Đoạn 1', lang: 'vi-VN' },
    { text: 'Segment 2', lang: 'en-US' },
    { text: 'Đoạn 3', lang: 'vi-VN' },
  ];

  await queue.play(segments);

  // Wait for all 3 segments to complete
  await new Promise(resolve => setTimeout(resolve, 120));

  assert.equal(overlapDetected, false);
  assert.equal(playbackLog.filter(l => l.startsWith('START')).length, 3);
  assert.equal(playbackLog.filter(l => l.startsWith('DONE')).length, 3);
  assert.equal(queue.isSpeaking, false);
});

test('11. AniSpeechQueue immediate interruption stops previous playback cleanly', async () => {
  const events: string[] = [];

  const queue = new AniSpeechQueue(
    (text, opts) => {
      events.push(`SPEAK: ${text}`);
      // Hangs indefinitely unless stopped
    },
    async () => {
      events.push('NATIVE_STOP');
    }
  );

  await queue.play([
    { text: 'First long sentence part 1', lang: 'en-US' },
    { text: 'First long sentence part 2', lang: 'en-US' },
  ]);

  assert.equal(queue.isSpeaking, true);
  assert.equal(events.includes('SPEAK: First long sentence part 1'), true);

  // Interrupt with new question
  await queue.stop();

  assert.equal(queue.isSpeaking, false);
  assert.equal(events.includes('NATIVE_STOP'), true);
  // Part 2 should never have been spoken
  assert.equal(events.includes('SPEAK: First long sentence part 2'), false);
});

test('12. AiSpeechService uses mixed language pipeline and routes correct voices', async () => {
  const spokenSegments: QueueSegmentItem[] = [];
  let isSpeakingState = false;

  const mockProvider = {
    speak: async () => {},
    speakSegments: async (segments: QueueSegmentItem[]) => {
      spokenSegments.push(...segments);
    },
    stop: async () => {
      isSpeakingState = false;
    },
    isSpeaking: () => isSpeakingState,
    getAvailableVoices: async () => [
      { identifier: 'vi-vn-enhanced-1', name: 'Linh', quality: 'Enhanced', language: 'vi-VN' },
      { identifier: 'en-us-enhanced-1', name: 'Samantha', quality: 'Enhanced', language: 'en-US' },
    ],
    autoSelectVoices: async () => ({
      vi: 'vi-vn-enhanced-1',
      en: 'en-us-enhanced-1',
    }),
  };

  const service = new AiSpeechService(mockProvider as any);

  await service.speak('Pin còn 74%. GPS signal is stable. Drone đang ở LOITER ở độ cao 5.2 mét.', {
    vietnameseVoice: 'custom-vi-voice',
    englishVoice: 'custom-en-voice',
    rate: 0.95,
  });

  assert.equal(spokenSegments.length, 5);

  // Vietnamese segments must use vietnameseVoice
  assert.equal(spokenSegments[0].voice, 'custom-vi-voice');
  assert.equal(spokenSegments[0].lang, 'vi-VN');

  // English segments must use englishVoice
  assert.equal(spokenSegments[1].voice, 'custom-en-voice');
  assert.equal(spokenSegments[1].lang, 'en-US');

  assert.equal(spokenSegments[2].voice, 'custom-vi-voice');
  assert.equal(spokenSegments[3].voice, 'custom-en-voice');
  assert.equal(spokenSegments[4].voice, 'custom-vi-voice');
});
