import { sha256 } from '@noble/hashes/sha256';
import { concatBytes } from '@noble/hashes/utils';

export type MavlinkSigningPolicy = 'DISABLED' | 'SIGN_OUTGOING' | 'REQUIRE_VALID';

export interface MavlinkSigningDiagnostics {
  valid: number;
  invalid: number;
  unsignedRejected: number;
  replayRejected: number;
}

const MAVLINK_EPOCH_MS = Date.UTC(2015, 0, 1);
const SIGNATURE_TIMESTAMP_LIMIT = 60n * 100_000n;
const MAX_TIMESTAMP = (1n << 48n) - 1n;

function currentTimestamp() {
  return BigInt(Math.max(0, Date.now() - MAVLINK_EPOCH_MS)) * 100n;
}

function readTimestamp(bytes: Uint8Array, offset: number) {
  let value = 0n;
  for (let index = 0; index < 6; index++) value |= BigInt(bytes[offset + index]) << BigInt(index * 8);
  return value;
}

function writeTimestamp(bytes: Uint8Array, offset: number, value: bigint) {
  for (let index = 0; index < 6; index++) bytes[offset + index] = Number((value >> BigInt(index * 8)) & 0xffn);
}

function equalSignature(left: Uint8Array, right: Uint8Array) {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index++) difference |= left[index] ^ right[index];
  return difference === 0;
}

export class MavlinkSigningSession {
  readonly policy: MavlinkSigningPolicy;
  readonly linkId: number;
  private readonly secretKey: Uint8Array;
  private timestamp: bigint;
  private readonly streams = new Map<string, bigint>();
  private diagnostics: MavlinkSigningDiagnostics = { valid: 0, invalid: 0, unsignedRejected: 0, replayRejected: 0 };

  constructor(policy: Exclude<MavlinkSigningPolicy, 'DISABLED'>, secretKey: Uint8Array, linkId: number, timestamp = currentTimestamp()) {
    if (secretKey.byteLength !== 32) throw new Error('MAVLINK_SIGNING_KEY_MUST_BE_32_BYTES');
    if (!Number.isInteger(linkId) || linkId < 0 || linkId > 255) throw new Error('MAVLINK_SIGNING_LINK_ID_INVALID');
    this.policy = policy;
    this.secretKey = secretKey.slice();
    this.linkId = linkId;
    this.timestamp = timestamp & MAX_TIMESTAMP;
  }

  getDiagnostics(): MavlinkSigningDiagnostics { return { ...this.diagnostics }; }

  rejectUnsigned() {
    if (this.policy !== 'REQUIRE_VALID') return false;
    this.diagnostics.unsignedRejected++;
    return true;
  }

  sign(unsignedPacket: Uint8Array) {
    if (unsignedPacket[0] !== 0xfd) throw new Error('MAVLINK_SIGNING_REQUIRES_V2');
    const packet = unsignedPacket.slice();
    if ((packet[2] & 0x01) === 0) throw new Error('MAVLINK_SIGNING_FLAG_NOT_SET');
    const signaturePrefix = new Uint8Array(7);
    signaturePrefix[0] = this.linkId;
    const now = currentTimestamp();
    if (this.timestamp < now) this.timestamp = now;
    this.timestamp = (this.timestamp + 1n) & MAX_TIMESTAMP;
    writeTimestamp(signaturePrefix, 1, this.timestamp);
    const digest = sha256(concatBytes(this.secretKey, packet, signaturePrefix));
    return concatBytes(packet, signaturePrefix, digest.slice(0, 6));
  }

  verify(packetWithoutSignature: Uint8Array, signatureBlock: Uint8Array, systemId: number, componentId: number) {
    if (signatureBlock.byteLength !== 13) {
      this.diagnostics.invalid++;
      return false;
    }
    const prefix = signatureBlock.subarray(0, 7);
    const expected = sha256(concatBytes(this.secretKey, packetWithoutSignature, prefix)).slice(0, 6);
    if (!equalSignature(expected, signatureBlock.subarray(7, 13))) {
      this.diagnostics.invalid++;
      return false;
    }
    const timestamp = readTimestamp(signatureBlock, 1);
    const streamKey = `${systemId}:${componentId}:${signatureBlock[0]}`;
    const previous = this.streams.get(streamKey);
    if (previous !== undefined && timestamp <= previous) {
      this.diagnostics.replayRejected++;
      return false;
    }
    if (previous === undefined && timestamp + SIGNATURE_TIMESTAMP_LIMIT < currentTimestamp()) {
      this.diagnostics.invalid++;
      return false;
    }
    this.streams.set(streamKey, timestamp);
    if (timestamp > this.timestamp) this.timestamp = timestamp;
    this.diagnostics.valid++;
    return true;
  }
}
