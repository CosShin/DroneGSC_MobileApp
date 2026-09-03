import { MAVLINK_ARDUPILOTMEGA_CRC_EXTRA } from './MavlinkArduPilotMegaCrc';
import { MavlinkSigningSession } from './MavlinkSigning';

export interface MavlinkFrame {
  version: 1 | 2;
  sequence: number;
  systemId: number;
  componentId: number;
  messageId: number;
  payload: Uint8Array;
  /** Exact wire frame, captured only while a diagnostics observer is active. */
  rawFrame?: Uint8Array;
}

export interface MavlinkParserDiagnostics {
  bytesReceived: number;
  framesAccepted: number;
  crcErrors: number;
  unsupportedFrames: number;
  signedFramesRejected: number;
  signaturesValid: number;
  signaturesInvalid: number;
  unsignedFramesRejected: number;
  signatureReplaysRejected: number;
  discardedBytes: number;
  bufferedBytes: number;
}

const CRC_EXTRA = MAVLINK_ARDUPILOTMEGA_CRC_EXTRA;

function accumulate(byte: number, crc: number) {
  let value = byte ^ (crc & 0xff);
  value ^= (value << 4) & 0xff;
  return ((crc >> 8) ^ (value << 8) ^ (value << 3) ^ (value >> 4)) & 0xffff;
}

function checksum(data: Uint8Array, extra: number) {
  let value = 0xffff;
  for (const byte of data) value = accumulate(byte, value);
  return accumulate(extra, value);
}

export class MavlinkParser {
  private buffer = new Uint8Array();
  private captureRawFrames = false;
  private signing: MavlinkSigningSession | null = null;
  private diagnostics: Omit<MavlinkParserDiagnostics, 'bufferedBytes'> = {
    bytesReceived: 0,
    framesAccepted: 0,
    crcErrors: 0,
    unsupportedFrames: 0,
    signedFramesRejected: 0,
    signaturesValid: 0,
    signaturesInvalid: 0,
    unsignedFramesRejected: 0,
    signatureReplaysRejected: 0,
    discardedBytes: 0,
  };

  getDiagnostics(): MavlinkParserDiagnostics {
    return { ...this.diagnostics, bufferedBytes: this.buffer.byteLength };
  }

  setRawCaptureEnabled(enabled: boolean) {
    this.captureRawFrames = enabled;
  }

  setSigning(session: MavlinkSigningSession | null) {
    this.signing = session;
  }

  reset() {
    this.buffer = new Uint8Array();
    this.diagnostics = {
      bytesReceived: 0,
      framesAccepted: 0,
      crcErrors: 0,
      unsupportedFrames: 0,
      signedFramesRejected: 0,
      signaturesValid: 0,
      signaturesInvalid: 0,
      unsignedFramesRejected: 0,
      signatureReplaysRejected: 0,
      discardedBytes: 0,
    };
  }

  pushDatagram(input: Uint8Array) {
    this.buffer = new Uint8Array();
    const frames = this.push(input);
    this.buffer = new Uint8Array();
    return frames;
  }

  push(input: Uint8Array) {
    this.diagnostics.bytesReceived += input.byteLength;
    const merged = new Uint8Array(this.buffer.length + input.length);
    merged.set(this.buffer);
    merged.set(input, this.buffer.length);
    this.buffer = merged;
    const frames: MavlinkFrame[] = [];
    let offset = 0;

    while (offset < this.buffer.length) {
      const magic = this.buffer[offset];
      if (magic !== 0xfe && magic !== 0xfd) {
        this.diagnostics.discardedBytes++;
        offset++;
        continue;
      }
      const isV2 = magic === 0xfd;
      const headerLength = isV2 ? 10 : 6;
      if (this.buffer.length - offset < headerLength + 2) break;
      const payloadLength = this.buffer[offset + 1];
      const signatureLength = isV2 && (this.buffer[offset + 2] & 1) !== 0 ? 13 : 0;
      const frameLength = headerLength + payloadLength + 2 + signatureLength;
      if (this.buffer.length - offset < frameLength) break;
      const messageId = isV2
        ? this.buffer[offset + 7] | (this.buffer[offset + 8] << 8) | (this.buffer[offset + 9] << 16)
        : this.buffer[offset + 5];
      const extra = CRC_EXTRA[messageId];
      const crcOffset = offset + headerLength + payloadLength;
      const expected = this.buffer[crcOffset] | (this.buffer[crcOffset + 1] << 8);
      // The boundary is already known, so an unsupported message must be
      // skipped whole. Scanning its payload for another magic byte can retain
      // a false partial frame and stall parsing across later UDP datagrams.
      if (extra === undefined) {
        this.diagnostics.unsupportedFrames++;
        offset += frameLength;
        continue;
      }
      const actual = checksum(this.buffer.slice(offset + 1, crcOffset), extra);
      if (actual !== expected) {
        this.diagnostics.crcErrors++;
        offset += frameLength;
        continue;
      }
      if (signatureLength > 0) {
        if (!this.signing) {
          this.diagnostics.signedFramesRejected++;
          offset += frameLength;
          continue;
        }
        const signingBefore = this.signing.getDiagnostics();
        const packetWithoutSignature = this.buffer.slice(offset, crcOffset + 2);
        const signature = this.buffer.slice(crcOffset + 2, offset + frameLength);
        if (!this.signing.verify(
          packetWithoutSignature,
          signature,
          this.buffer[offset + 5],
          this.buffer[offset + 6],
        )) {
          const signingAfter = this.signing.getDiagnostics();
          this.diagnostics.signedFramesRejected++;
          if (signingAfter.replayRejected > signingBefore.replayRejected) this.diagnostics.signatureReplaysRejected++;
          else this.diagnostics.signaturesInvalid++;
          offset += frameLength;
          continue;
        }
        this.diagnostics.signaturesValid++;
      } else if (this.signing?.rejectUnsigned()) {
        this.diagnostics.unsignedFramesRejected++;
        offset += frameLength;
        continue;
      }
      this.diagnostics.framesAccepted++;
      frames.push({
        version: isV2 ? 2 : 1,
        sequence: this.buffer[offset + (isV2 ? 4 : 2)],
        systemId: this.buffer[offset + (isV2 ? 5 : 3)],
        componentId: this.buffer[offset + (isV2 ? 6 : 4)],
        messageId,
        payload: this.buffer.slice(offset + headerLength, crcOffset),
        rawFrame: this.captureRawFrames ? this.buffer.slice(offset, offset + frameLength) : undefined,
      });
      offset += frameLength;
    }
    this.buffer = this.buffer.slice(offset);
    return frames;
  }
}

export function encodeMavlinkV2(
  messageId: number,
  payload: Uint8Array,
  sequence: number,
  systemId = 255,
  componentId = 190,
  signing: MavlinkSigningSession | null = null,
) {
  const extra = CRC_EXTRA[messageId];
  if (extra === undefined) throw new Error(`MAVLINK_CRC_EXTRA_UNKNOWN_${messageId}`);
  const frame = new Uint8Array(12 + payload.length);
  frame[0] = 0xfd;
  frame[1] = payload.length;
  if (signing) frame[2] = 0x01;
  frame[4] = sequence;
  frame[5] = systemId;
  frame[6] = componentId;
  frame[7] = messageId & 0xff;
  frame[8] = (messageId >> 8) & 0xff;
  frame[9] = (messageId >> 16) & 0xff;
  frame.set(payload, 10);
  const crc = checksum(frame.slice(1, 10 + payload.length), extra);
  frame[10 + payload.length] = crc & 0xff;
  frame[11 + payload.length] = crc >> 8;
  return signing ? signing.sign(frame) : frame;
}
