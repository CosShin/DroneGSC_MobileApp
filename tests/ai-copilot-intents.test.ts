import test from 'node:test';
import assert from 'node:assert/strict';
import { aiIntentParser } from '../src/services/ai/intents/AiIntentParser';

test('AiIntentParser parses valid TAKEOFF proposal correctly', () => {
  const raw = `Tôi đã nhận lệnh cất cánh.
\`\`\`json
{
  "message": "Tôi đã tạo yêu cầu cất cánh lên 20 mét.",
  "intent": {
    "type": "TAKEOFF",
    "parameters": {
      "altitudeMeters": 20
    }
  }
}
\`\`\``;

  const result = aiIntentParser.parse(raw, 'session-123');
  assert.equal(result.requiresConfirmation, true);
  assert.ok(result.proposal);
  assert.equal(result.proposal?.intent.type, 'TAKEOFF');
  assert.equal((result.proposal?.intent as any).altitudeMeters, 20);
  assert.equal(result.proposal?.requiresHoldConfirmation, true);
  assert.equal(result.proposal?.vehicleSessionId, 'session-123');
  assert.equal(result.message, 'Tôi đã tạo yêu cầu cất cánh lên 20 mét.');
});

test('AiIntentParser parses ARM intent with hold-to-confirm requirement', () => {
  const raw = `\`\`\`json
{
  "message": "Tôi đã tạo yêu cầu ARM máy bay.",
  "intent": {
    "type": "ARM"
  }
}
\`\`\``;

  const result = aiIntentParser.parse(raw);
  assert.equal(result.requiresConfirmation, true);
  assert.ok(result.proposal);
  assert.equal(result.proposal?.intent.type, 'ARM');
  assert.equal(result.proposal?.requiresHoldConfirmation, true);
});

test('AiIntentParser parses SET_MODE intent correctly', () => {
  const raw = `\`\`\`json
{
  "intent": {
    "type": "SET_MODE",
    "parameters": {
      "mode": "LOITER"
    }
  }
}
\`\`\``;

  const result = aiIntentParser.parse(raw);
  assert.equal(result.requiresConfirmation, true);
  assert.ok(result.proposal);
  assert.equal(result.proposal?.intent.type, 'SET_MODE');
  assert.equal((result.proposal?.intent as any).mode, 'LOITER');
  // SET_MODE does not require hold-to-confirm, single tap confirmation is sufficient
  assert.equal(result.proposal?.requiresHoldConfirmation, false);
});

test('AiIntentParser parses RTL intent correctly', () => {
  const raw = `\`\`\`json
{
  "message": "Tôi đã tạo yêu cầu RTL.",
  "intent": {
    "type": "RTL"
  }
}
\`\`\``;

  const result = aiIntentParser.parse(raw);
  assert.ok(result.proposal);
  assert.equal(result.proposal?.intent.type, 'RTL');
});

test('AiIntentParser rejects malformed altitude (banana) and retains text response only', () => {
  const raw = `Yêu cầu bay lên.
\`\`\`json
{
  "intent": {
    "type": "TAKEOFF",
    "parameters": {
      "altitudeMeters": "banana"
    }
  }
}
\`\`\``;

  const result = aiIntentParser.parse(raw);
  // Malformed parameter MUST reject proposal
  assert.equal(result.proposal, null);
  assert.equal(result.requiresConfirmation, false);
  assert.ok(result.message.includes('Yêu cầu bay lên'));
});

test('AiIntentParser rejects null altitude and out-of-bounds ceiling (> 120m)', () => {
  const nullAlt = `{"intent":{"type":"TAKEOFF","parameters":{"altitudeMeters":null}}}`;
  assert.equal(aiIntentParser.parse(nullAlt).proposal, null);

  const tooHighAlt = `{"intent":{"type":"TAKEOFF","parameters":{"altitudeMeters":500}}}`;
  assert.equal(aiIntentParser.parse(tooHighAlt).proposal, null);

  const negativeAlt = `{"intent":{"type":"TAKEOFF","parameters":{"altitudeMeters":-10}}}`;
  assert.equal(aiIntentParser.parse(negativeAlt).proposal, null);
});

test('AiIntentParser rejects unsupported flight mode', () => {
  const raw = `{"intent":{"type":"SET_MODE","parameters":{"mode":"SUPER_WARP_MODE"}}}`;
  const result = aiIntentParser.parse(raw);
  assert.equal(result.proposal, null);
});

test('AiIntentParser parses CREATE_MISSION proposal with valid waypoints', () => {
  const raw = `\`\`\`json
{
  "message": "Tôi đã tạo kế hoạch bay 3 điểm.",
  "intent": {
    "type": "CREATE_MISSION",
    "parameters": {
      "proposal": {
        "takeoffAltitudeMeters": 20,
        "speedMetersPerSecond": 5,
        "waypoints": [
          { "latitude": 10.762622, "longitude": 106.660172, "altitudeMeters": 25 },
          { "latitude": 10.763622, "longitude": 106.661172, "altitudeMeters": 25 },
          { "latitude": 10.764622, "longitude": 106.662172, "altitudeMeters": 30 }
        ],
        "endAction": "RTL"
      }
    }
  }
}
\`\`\``;

  const result = aiIntentParser.parse(raw);
  assert.ok(result.proposal);
  assert.equal(result.proposal?.intent.type, 'CREATE_MISSION');
  const p = (result.proposal?.intent as any).proposal;
  assert.equal(p.takeoffAltitudeMeters, 20);
  assert.equal(p.waypoints.length, 3);
  assert.equal(p.endAction, 'RTL');
});

test('AiIntentParser preserves plain conversational responses without creating proposals', () => {
  const raw = 'Thời tiết hiện tại rất phù hợp để bay. Pin máy bay đang ở mức 92%.';
  const result = aiIntentParser.parse(raw);
  assert.equal(result.proposal, null);
  assert.equal(result.requiresConfirmation, false);
  assert.equal(result.message, raw);
});
