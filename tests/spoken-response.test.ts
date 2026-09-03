import test from 'node:test';
import assert from 'node:assert/strict';
import { processSemanticResponse } from '../src/services/ai/semantic/SemanticResponseProcessor';
import { buildSpokenResponse, getEffectiveProsody, PROSODY_MAP } from '../src/services/voice/SpokenResponseBuilder';
import { prepareTextForSpeech } from '../src/services/voice/SpeechSanitizer';
import type { SemanticStructuredCard } from '../src/services/ai/AiTypes';

test('Telemetry Unit Conversion: Vietnamese natural pronunciation', () => {
  // Requirement 12: Telemetry unit normalization
  const input = 'Pin 82%, độ cao 15.2 m, vận tốc 4.5 m/s, điện áp 15.4 V, dòng 4.2 A, hướng 120°, độ trễ 150 ms, tần số 5 Hz.';
  const spoken = prepareTextForSpeech(input, 'vi-VN');

  assert.ok(spoken.includes('82 phần trăm'), `Expected '82 phần trăm', got: ${spoken}`);
  assert.ok(spoken.includes('15 phẩy 2 mét'), `Expected '15 phẩy 2 mét', got: ${spoken}`);
  assert.ok(spoken.includes('4 phẩy 5 mét trên giây'), `Expected '4 phẩy 5 mét trên giây', got: ${spoken}`);
  assert.ok(spoken.includes('15 phẩy 4 vôn'), `Expected '15 phẩy 4 vôn', got: ${spoken}`);
  assert.ok(spoken.includes('4 phẩy 2 am pe'), `Expected '4 phẩy 2 am pe', got: ${spoken}`);
  assert.ok(spoken.includes('120 độ'), `Expected '120 độ', got: ${spoken}`);
  assert.ok(spoken.includes('150 mili giây'), `Expected '150 mili giây', got: ${spoken}`);
  assert.ok(spoken.includes('5 héc'), `Expected '5 héc', got: ${spoken}`);
  // Verify no markdown or symbols
  assert.ok(!spoken.includes('%'));
  assert.ok(!spoken.includes('°'));
});

test('Test Case A: Flight status produces structured card and concise spoken summary', () => {
  const aiText = `[TRẠNG THÁI BAY]
Chế độ: LOITER
Armed: YES
Độ cao: 18.4m
Pin: 72%
GPS: 14 SAT (3D FIX)
Chuyến bay hiện ổn định. Chưa phát hiện cảnh báo cần xử lý.`;

  const result = processSemanticResponse(aiText, null, 'vi-VN');

  // Verify UI has structured card
  assert.ok(result.structuredCard, 'Should generate a structuredCard for flight status');
  assert.equal(result.structuredCard?.type, 'FLIGHT_STATUS');
  assert.ok(result.structuredCard?.metrics?.length && result.structuredCard.metrics.length > 0);

  // Verify spoken text is natural and concise (doesn't read raw table markup)
  assert.ok(result.spokenText.toLowerCase().includes('loiter'));
  assert.ok(result.spokenText.includes('ổn định'));
  assert.ok(!result.spokenText.includes('[TRẠNG THÁI'));
  assert.ok(!result.spokenText.includes('###'));
  assert.ok(!result.spokenText.includes('**'));
});

test('Test Case B: AI response with Markdown symbols is cleanly stripped in TTS', () => {
  const aiText = `### Báo cáo
**Battery** 82% --- GPS OK! *Gió nhẹ*. \`SYSID=1\`
- Không có lỗi cảm biến`;

  const result = processSemanticResponse(aiText, null, 'vi-VN');

  // TTS must not pronounce asterisks, hashes, backticks, or dashes
  assert.ok(!result.spokenText.includes('**'));
  assert.ok(!result.spokenText.includes('###'));
  assert.ok(!result.spokenText.includes('---'));
  assert.ok(!result.spokenText.includes('`'));
  assert.ok(!result.spokenText.includes('asterisk'));
  assert.ok(!result.spokenText.includes('hash'));
});

test('Test Case C: Camera analysis produces structured vision card', () => {
  const visionText = `CAMERA ANALYSIS
Summary: Không đủ chi tiết để nhận diện chính xác môi trường.
Findings:
• Khung hình gần như đồng nhất
• Không thấy vật thể rõ ràng
Recommendation:
• Kiểm tra nguồn video
• Chụp lại frame rõ hơn`;

  const result = processSemanticResponse(visionText, null, 'vi-VN');

  assert.ok(result.structuredCard, 'Should generate structuredCard');
  assert.equal(result.structuredCard?.type, 'CAMERA_ANALYSIS');
  assert.ok(result.structuredCard?.findings?.length && result.structuredCard.findings.length >= 2);
  assert.ok(result.structuredCard?.recommendations?.length && result.structuredCard.recommendations.length >= 1);

  // Spoken text summarizes without reading the entire bullet list
  assert.ok(result.spokenText.includes('phân tích camera'));
  assert.ok(result.spokenText.length < 200, 'Spoken text should be concise summary');
});

test('Test Case D: Warning produces CAUTION or URGENT tone and structured card', () => {
  const warningText = `⚠️ [CẢNH BÁO PIN]
Pin hiện tại còn 18%. Mức pin đang dưới ngưỡng an toàn 25%.
Khuyến nghị: Cân nhắc chuyển RTL hoặc hạ cánh khẩn cấp.`;

  const result = processSemanticResponse(warningText, null, 'vi-VN');

  assert.ok(result.structuredCard);
  assert.equal(result.structuredCard?.type, 'WARNING');
  assert.ok(result.tone === 'CAUTION' || result.tone === 'URGENT');
  assert.ok(result.spokenText.includes('Cảnh báo') || result.spokenText.includes('Pin'));
});

test('Test Case E: Mission completed resolves to POSITIVE tone', () => {
  const successText = 'Nhiệm vụ bay đã hoàn thành thành công. Drone đã hạ cánh an toàn.';
  const spoken = buildSpokenResponse(successText, 'vi-VN', null);

  assert.equal(spoken.tone, 'POSITIVE');
  assert.ok(spoken.spokenText.includes('thành công'));
});

test('Test Case F: Long AI response produces concise spoken script', () => {
  const longText = `Chào bạn. Đây là bản tin tổng hợp dữ liệu chuyến bay ngày hôm nay.
Tất cả các thông số khí tượng và cảm biến đo lường đều ở mức bình thường.
Độ cao bay tối đa đo được là 45.2 m.
Vận tốc gió duy trì ở mức 3 m/s.
Pin tiêu thụ tổng cộng 3500 mAh trong suốt thời gian 20 phút hoạt động.
Không ghi nhận bất kỳ sự cố mất tín hiệu MAVLink hay cảnh báo nào.
Bạn có thể tiếp tục kế hoạch bay tiếp theo theo đúng lộ trình.`;

  const spoken = buildSpokenResponse(longText, 'vi-VN', null);

  // Spoken text should take the first 1-2 key sentences rather than all paragraphs
  assert.ok(spoken.spokenText.length < 250);
  assert.ok(spoken.spokenText.includes('bình thường') || spoken.spokenText.includes('Chào bạn'));
});

test('Deterministic Tone Prosody Mapping (Requirement 14)', () => {
  const normalProsody = getEffectiveProsody('NORMAL', 1.0, 1.0, 'NATURAL');
  assert.equal(normalProsody.rate, PROSODY_MAP.NORMAL.rate);
  assert.equal(normalProsody.pitch, PROSODY_MAP.NORMAL.pitch);

  const urgentProsody = getEffectiveProsody('URGENT', 1.0, 1.0, 'NATURAL');
  assert.equal(urgentProsody.rate, PROSODY_MAP.URGENT.rate);
  assert.equal(urgentProsody.pitch, PROSODY_MAP.URGENT.pitch);

  const copilotStyleProsody = getEffectiveProsody('INFORMATIVE', 1.0, 1.0, 'COPILOT');
  // Copilot style gives crisper speed
  assert.ok(copilotStyleProsody.rate > PROSODY_MAP.INFORMATIVE.rate * 0.99);
});
