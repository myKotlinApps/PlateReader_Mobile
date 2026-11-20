/**
 * Pure TypeScript Zero-Knowledge E2E Cryptography matching `crates/shared/alpr_crypto_core.rs`:
 * - SHA-256 (FIPS 180-4), HMAC-SHA256 (RFC 4231), HKDF-SHA256 (RFC 5869)
 * - X25519 ECDH (RFC 7748 Section 5/6.1)
 * - ChaCha20-Poly1305 AEAD (RFC 8439)
 *
 * Works identically across HTTPS browsers, HTTP local LAN WebViews (no WebCrypto restriction),
 * Android/iOS Capacitor WebViews, and Node.js test runners.
 */

const textEncoder = new TextEncoder();

export function hexEncode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

export function hexDecode(hex: string): Uint8Array {
  const clean = hex.trim();
  if (clean.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(clean)) {
    throw new Error('رشته هگز نامعتبر است.');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function randomBytes(len: number): Uint8Array {
  const buf = new Uint8Array(len);
  globalThis.crypto.getRandomValues(buf);
  return buf;
}

// ---------------------------------------------------------------------------
// 1. SHA-256 / HMAC-SHA256 / HKDF-SHA256
// ---------------------------------------------------------------------------

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (v: number, n: number) => (v >>> n) | (v << (32 - n));

export function sha256(data: Uint8Array): Uint8Array {
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const bitLen = BigInt(data.length) * 8n;
  const padLen = ((data.length + 9 + 63) & ~63);
  const padded = new Uint8Array(padLen);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setBigUint64(padLen - 8, bitLen, false);

  const w = new Uint32Array(64);
  for (let off = 0; off < padLen; off += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  for (let i = 0; i < 8; i += 1) ov.setUint32(i * 4, h[i], false);
  return out;
}

export function hmacSha256(key: Uint8Array, data: Uint8Array): Uint8Array {
  const k = key.length > 64 ? sha256(key) : key;
  const ipad = new Uint8Array(64 + data.length);
  const opad = new Uint8Array(64 + 32);
  ipad.fill(0x36, 0, 64);
  opad.fill(0x5c, 0, 64);
  for (let i = 0; i < k.length; i += 1) {
    ipad[i] ^= k[i];
    opad[i] ^= k[i];
  }
  ipad.set(data, 64);
  opad.set(sha256(ipad), 64);
  return sha256(opad);
}

export function hkdfSha256(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  outLen: number,
): Uint8Array {
  const realSalt = salt.length > 0 ? salt : new Uint8Array(32);
  const prk = hmacSha256(realSalt, ikm);
  const okm = new Uint8Array(outLen);
  let prev: Uint8Array = new Uint8Array(0);
  let written = 0;
  let counter = 1;
  while (written < outLen) {
    const input = new Uint8Array(prev.length + info.length + 1);
    input.set(prev, 0);
    input.set(info, prev.length);
    input[input.length - 1] = counter & 0xff;
    prev = hmacSha256(prk, input);
    const take = Math.min(32, outLen - written);
    okm.set(prev.subarray(0, take), written);
    written += take;
    counter += 1;
  }
  return okm;
}

// ---------------------------------------------------------------------------
// 2. X25519 ECDH (RFC 7748 via exact GF(2^255 - 19) BigInt Montgomery ladder)
// ---------------------------------------------------------------------------

const P25519 = (1n << 255n) - 19n;
const MASK255 = (1n << 255n) - 1n;
const A24 = 121665n;

const modP = (x: bigint): bigint => {
  const r = x % P25519;
  return r >= 0n ? r : r + P25519;
};

function modPowP(base: bigint, exp: bigint): bigint {
  let res = 1n;
  let b = modP(base);
  let e = exp;
  while (e > 0n) {
    if (e & 1n) res = (res * b) % P25519;
    b = (b * b) % P25519;
    e >>= 1n;
  }
  return res;
}

function leBytesToBigInt(bytes: Uint8Array): bigint {
  let n = 0n;
  for (let i = bytes.length - 1; i >= 0; i -= 1) {
    n = (n << 8n) | BigInt(bytes[i]);
  }
  return n;
}

function bigIntToLe32(n: bigint): Uint8Array {
  const out = new Uint8Array(32);
  let v = modP(n);
  for (let i = 0; i < 32; i += 1) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

export function x25519(scalarBytes: Uint8Array, uBytes: Uint8Array): Uint8Array {
  const kBytes = new Uint8Array(scalarBytes);
  kBytes[0] &= 248;
  kBytes[31] &= 127;
  kBytes[31] |= 64;
  const k = leBytesToBigInt(kBytes);
  const u = leBytesToBigInt(uBytes) & MASK255;

  let x1 = u;
  let x2 = 1n;
  let z2 = 0n;
  let x3 = u;
  let z3 = 1n;
  let swap = 0n;

  for (let t = 254; t >= 0; t -= 1) {
    const kt = (k >> BigInt(t)) & 1n;
    swap ^= kt;
    if (swap) {
      [x2, x3] = [x3, x2];
      [z2, z3] = [z3, z2];
    }
    swap = kt;
    const A = modP(x2 + z2);
    const AA = (A * A) % P25519;
    const B = modP(x2 - z2);
    const BB = (B * B) % P25519;
    const E = modP(AA - BB);
    const C = modP(x3 + z3);
    const D = modP(x3 - z3);
    const DA = (D * A) % P25519;
    const CB = (C * B) % P25519;
    x3 = modP(DA + CB) ** 2n % P25519;
    z3 = (x1 * (modP(DA - CB) ** 2n % P25519)) % P25519;
    x2 = (AA * BB) % P25519;
    z2 = (E * modP(AA + A24 * E)) % P25519;
  }
  if (swap) {
    [x2, x3] = [x3, x2];
    [z2, z3] = [z3, z2];
  }
  const result = (x2 * modPowP(z2, P25519 - 2n)) % P25519;
  return bigIntToLe32(result);
}

export function x25519Base(scalarBytes: Uint8Array): Uint8Array {
  const basePoint = new Uint8Array(32);
  basePoint[0] = 9;
  return x25519(scalarBytes, basePoint);
}

// ---------------------------------------------------------------------------
// 3. ChaCha20-Poly1305 AEAD (RFC 8439)
// ---------------------------------------------------------------------------

const rotl = (v: number, n: number) => ((v << n) | (v >>> (32 - n))) >>> 0;

function quarterRound(s: Uint32Array, a: number, b: number, c: number, d: number) {
  s[a] = (s[a] + s[b]) >>> 0; s[d] = rotl(s[d] ^ s[a], 16);
  s[c] = (s[c] + s[d]) >>> 0; s[b] = rotl(s[b] ^ s[c], 12);
  s[a] = (s[a] + s[b]) >>> 0; s[d] = rotl(s[d] ^ s[a], 8);
  s[c] = (s[c] + s[d]) >>> 0; s[b] = rotl(s[b] ^ s[c], 7);
}

export function chacha20Block(key: Uint8Array, counter: number, nonce: Uint8Array): Uint8Array {
  const kv = new DataView(key.buffer, key.byteOffset, 32);
  const nv = new DataView(nonce.buffer, nonce.byteOffset, 12);
  const init = new Uint32Array([
    0x61707865, 0x3320646e, 0x79622d32, 0x6b206574,
    kv.getUint32(0, true), kv.getUint32(4, true), kv.getUint32(8, true), kv.getUint32(12, true),
    kv.getUint32(16, true), kv.getUint32(20, true), kv.getUint32(24, true), kv.getUint32(28, true),
    counter >>> 0, nv.getUint32(0, true), nv.getUint32(4, true), nv.getUint32(8, true),
  ]);
  const work = new Uint32Array(init);
  for (let i = 0; i < 10; i += 1) {
    quarterRound(work, 0, 4, 8, 12);
    quarterRound(work, 1, 5, 9, 13);
    quarterRound(work, 2, 6, 10, 14);
    quarterRound(work, 3, 7, 11, 15);
    quarterRound(work, 0, 5, 10, 15);
    quarterRound(work, 1, 6, 11, 12);
    quarterRound(work, 2, 7, 8, 13);
    quarterRound(work, 3, 4, 9, 14);
  }
  const out = new Uint8Array(64);
  const ov = new DataView(out.buffer);
  for (let i = 0; i < 16; i += 1) ov.setUint32(i * 4, (work[i] + init[i]) >>> 0, true);
  return out;
}

function chacha20Xor(key: Uint8Array, counter0: number, nonce: Uint8Array, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length);
  let ctr = counter0;
  for (let off = 0; off < data.length; off += 64) {
    const blk = chacha20Block(key, ctr, nonce);
    const take = Math.min(64, data.length - off);
    for (let i = 0; i < take; i += 1) out[off + i] = data[off + i] ^ blk[i];
    ctr += 1;
  }
  return out;
}

const POLY_P = (1n << 130n) - 5n;

function poly1305Mac(otk: Uint8Array, msg: Uint8Array): Uint8Array {
  const rBytes = new Uint8Array(otk.subarray(0, 16));
  rBytes[3] &= 15; rBytes[7] &= 15; rBytes[11] &= 15; rBytes[15] &= 15;
  rBytes[4] &= 252; rBytes[8] &= 252; rBytes[12] &= 252;
  const r = leBytesToBigInt(rBytes);
  const s = leBytesToBigInt(otk.subarray(16, 32));

  let acc = 0n;
  for (let off = 0; off < msg.length; off += 16) {
    const slice = msg.subarray(off, Math.min(msg.length, off + 16));
    const n = leBytesToBigInt(slice) + (1n << BigInt(slice.length * 8));
    acc = ((acc + n) * r) % POLY_P;
  }
  const tagVal = acc + s;
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) {
    out[i] = Number((tagVal >> BigInt(i * 8)) & 0xffn);
  }
  return out;
}

function poly1305AeadInput(aad: Uint8Array, ct: Uint8Array): Uint8Array {
  const pad16 = (n: number) => (n % 16 === 0 ? 0 : 16 - (n % 16));
  const aadPad = pad16(aad.length);
  const ctPad = pad16(ct.length);
  const buf = new Uint8Array(aad.length + aadPad + ct.length + ctPad + 16);
  buf.set(aad, 0);
  buf.set(ct, aad.length + aadPad);
  const view = new DataView(buf.buffer);
  view.setBigUint64(buf.length - 16, BigInt(aad.length), true);
  view.setBigUint64(buf.length - 8, BigInt(ct.length), true);
  return buf;
}

export function chacha20Poly1305Encrypt(
  key: Uint8Array,
  nonce: Uint8Array,
  aad: Uint8Array,
  plaintext: Uint8Array,
): Uint8Array {
  const block0 = chacha20Block(key, 0, nonce);
  const otk = block0.subarray(0, 32);
  const ct = chacha20Xor(key, 1, nonce, plaintext);
  const tag = poly1305Mac(otk, poly1305AeadInput(aad, ct));
  const out = new Uint8Array(ct.length + 16);
  out.set(ct, 0);
  out.set(tag, ct.length);
  return out;
}

// ---------------------------------------------------------------------------
// 4. High-Level Relay Envelope Builder (`remote_connect.rs` wire compatible)
// ---------------------------------------------------------------------------

export interface EncryptedRelayEnvelope {
  id: string;
  ts_ms: number;
  ttl_ms: number;
  eph_pub_hex: string;
  nonce_hex: string;
  ciphertext_hex: string;
}

const RELAY_SALT = textEncoder.encode('alpr-relay-salt-v1');
const RELAY_INFO = textEncoder.encode('alpr-relay-chacha20poly1305-v1');

export function encryptRelayEnvelope(
  serverPubKeyHex: string,
  envelopeId: string,
  payload: unknown,
  ttlMs = 3 * 86_400_000,
): EncryptedRelayEnvelope {
  const recPub = hexDecode(serverPubKeyHex);
  if (recPub.length !== 32) {
    throw new Error('کلید عمومی سرور نامعتبر است.');
  }
  const ephPriv = randomBytes(32);
  const ephPub = x25519Base(ephPriv);
  const shared = x25519(ephPriv, recPub);
  ephPriv.fill(0);

  const aeadKey = hkdfSha256(RELAY_SALT, shared, RELAY_INFO, 32);
  shared.fill(0);

  const tsMs = Date.now();
  const nonce = randomBytes(12);
  const aad = textEncoder.encode(`${envelopeId}|${tsMs}`);
  const plaintext = textEncoder.encode(JSON.stringify(payload));
  const ciphertext = chacha20Poly1305Encrypt(aeadKey, nonce, aad, plaintext);
  aeadKey.fill(0);

  return {
    id: envelopeId,
    ts_ms: tsMs,
    ttl_ms: ttlMs,
    eph_pub_hex: hexEncode(ephPub),
    nonce_hex: hexEncode(nonce),
    ciphertext_hex: hexEncode(ciphertext),
  };
}
