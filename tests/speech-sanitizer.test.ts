import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTextForSpeech } from '../src/services/voice/SpeechSanitizer';

test('prepareTextForSpeech strips all Markdown, code blocks, tables, and formatting symbols', () => {
  const rawInput = `
# BÁO CÁO BAY CHÍNH
### Tình trạng hệ thống
- Tham số: **Quan trọng**
- Dữ liệu: *Nghiêng*, _Gạch chân_, ~~Gạch xóa~~
\`\`\`json
{ "altitude": 25.5, "mode": "LOITER" }
\`\`\`
Xem chi tiết tại [Tài liệu](https://docs.anitech.vn/guide).
| Tên | Giá trị |
| --- | --- |
| Alt | 25m |
---
> Lưu ý: Giữ khoảng cách an toàn.
`;

  const spoken = prepareTextForSpeech(rawInput, 'vi-VN');

  // Must not contain any raw markdown symbols
  assert.ok(!spoken.includes('#'), 'Should not contain # headers');
  assert.ok(!spoken.includes('**'), 'Should not contain ** bold');
  assert.ok(!spoken.includes('```'), 'Should not contain ``` code blocks');
  assert.ok(!spoken.includes('json'), 'Should not contain raw json code fence label');
  assert.ok(!spoken.includes('{ "altitude"'), 'Should not contain raw JSON payload');
  assert.ok(!spoken.includes('https://'), 'Should not contain raw URLs');
  assert.ok(!spoken.includes('|'), 'Should not contain markdown table pipes');
  assert.ok(!spoken.includes('---'), 'Should not contain markdown horizontal rules');
  assert.ok(!spoken.includes('>'), 'Should not contain blockquote symbols');
});

test('prepareTextForSpeech converts Vietnamese telemetry tokens into natural spoken words', () => {
  const telemetryReport = `
Tình trạng drone:
- Trạng thái: ARMED
- Chế độ: LOITER
- Pin: Batt 85% (15.2V)
- Tốc độ: 4.5m/s
- Độ cao: 20m
- GPS: GPS 16
- PreArm: Battery 1 below minimum arming voltage
✓ PreArm kiểm tra xong
⚠️ Gió mạnh
`;

  const spoken = prepareTextForSpeech(telemetryReport, 'vi-VN');

  assert.ok(spoken.includes('đã arm, sẵn sàng cất cánh'), 'Should expand ARMED');
  assert.ok(spoken.includes('chế độ Loiter giữ vị trí'), 'Should expand LOITER');
  assert.ok(spoken.includes('Pin 85 phần trăm'), 'Should expand Batt 85%');
  assert.ok(spoken.includes('15 phẩy 2 vôn'), 'Should expand 15.2V');
  assert.ok(spoken.includes('4 phẩy 5 mét trên giây'), 'Should expand 4.5m/s');
  assert.ok(spoken.includes('20 mét'), 'Should expand 20m');
  assert.ok(spoken.includes('GPS 16 vệ tinh'), 'Should expand GPS 16');
  assert.ok(spoken.includes('Cảnh báo trước khi cất cánh:'), 'Should expand PreArm:');
  assert.ok(spoken.includes('Đạt'), 'Should expand ✓');
  assert.ok(spoken.includes('Cảnh báo:'), 'Should expand ⚠️');
});

test('prepareTextForSpeech converts English telemetry tokens into natural spoken words', () => {
  const telemetryReport = `
Vehicle status:
- State: ARMED
- Mode: RTL
- Battery: Batt 92% (16.4V)
- Speed: 3.8m/s
- Altitude: 15m
- GPS: GPS 14
- PreArm: RC not found
✓ System ready
❌ Compass error
`;

  const spoken = prepareTextForSpeech(telemetryReport, 'en-US');

  assert.ok(spoken.includes('armed and ready for flight'), 'Should expand ARMED in English');
  assert.ok(spoken.includes('Return to Launch mode'), 'Should expand RTL in English');
  assert.ok(spoken.includes('Battery 92 percent'), 'Should expand Batt 92% in English');
  assert.ok(spoken.includes('16 point 4 volts'), 'Should expand 16.4V in English');
  assert.ok(spoken.includes('3 point 8 meters per second'), 'Should expand 3.8m/s in English');
  assert.ok(spoken.includes('15 meters'), 'Should expand 15m in English');
  assert.ok(spoken.includes('GPS 14 satellites'), 'Should expand GPS 14 in English');
  assert.ok(spoken.includes('Pre arm warning:'), 'Should expand PreArm in English');
  assert.ok(spoken.includes('Passed'), 'Should expand ✓ in English');
  assert.ok(spoken.includes('Error:'), 'Should expand ❌ in English');
});

test('prepareTextForSpeech handles disarmed and land modes gracefully', () => {
  const vi = prepareTextForSpeech('DISARMED, LAND tại bãi đáp', 'vi-VN');
  assert.ok(vi.includes('đã disarm, động cơ đã tắt'));
  assert.ok(vi.includes('chế độ hạ cánh'));

  const en = prepareTextForSpeech('DISARMED, LAND at home', 'en-US');
  assert.ok(en.includes('disarmed, motors off'));
  assert.ok(en.includes('Land mode'));
});
