import test from 'node:test';
import assert from 'node:assert/strict';
import * as mod from './cryptoRelay.ts';

test('X25519 matches RFC 7748 Section 6.1 test vector', () => {
  const alicePriv = mod.hexDecode('77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a');
  const alicePub = mod.x25519Base(alicePriv);
  assert.equal(mod.hexEncode(alicePub), '8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a');

  const bobPriv = mod.hexDecode('5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb');
  const bobPub = mod.x25519Base(bobPriv);
  assert.equal(mod.hexEncode(bobPub), 'de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f');

  const s1 = mod.x25519(alicePriv, bobPub);
  const s2 = mod.x25519(bobPriv, alicePub);
  assert.equal(mod.hexEncode(s1), '4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742');
  assert.equal(mod.hexEncode(s2), mod.hexEncode(s1));
});

test('ChaCha20-Poly1305 matches RFC 8439 Section 2.8.2 test vector', () => {
  const key = mod.hexDecode('808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f');
  const nonce = mod.hexDecode('070000004041424344454647');
  const aad = mod.hexDecode('50515253c0c1c2c3c4c5c6c7');
  const plaintext = new TextEncoder().encode("Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it.");
  const out = mod.chacha20Poly1305Encrypt(key, nonce, aad, plaintext);
  const tagHex = mod.hexEncode(out.subarray(out.length - 16));
  assert.equal(tagHex, '1ae10b594f09e26a7e902ecbd0600691');
});

test('encryptRelayEnvelope builds valid wire envelope', () => {
  const serverPriv = mod.hexDecode('77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a');
  const serverPubHex = mod.hexEncode(mod.x25519Base(serverPriv));
  const env = mod.encryptRelayEnvelope(serverPubHex, 'env-ts-001', { form_id: 'work_order' });
  assert.equal(env.id, 'env-ts-001');
  assert.equal(env.eph_pub_hex.length, 64);
  assert.equal(env.nonce_hex.length, 24);
  assert.ok(env.ciphertext_hex.length > 32);
});
