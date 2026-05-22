const crypto = require('crypto');
const { generateCodeVerifier, generateCodeChallenge } = require('../utils/pkce');

describe('PKCE utilities', () => {
  describe('generateCodeVerifier', () => {
    it('returns a base64url-encoded string', () => {
      const verifier = generateCodeVerifier();
      expect(typeof verifier).toBe('string');
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('generates verifiers of valid length (43-128 chars per RFC 7636)', () => {
      const verifier = generateCodeVerifier();
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      expect(verifier.length).toBeLessThanOrEqual(128);
    });

    it('generates unique verifiers each call', () => {
      const v1 = generateCodeVerifier();
      const v2 = generateCodeVerifier();
      expect(v1).not.toBe(v2);
    });
  });

  describe('generateCodeChallenge', () => {
    it('returns a base64url-encoded SHA-256 hash', () => {
      const verifier = 'test_verifier_value';
      const challenge = generateCodeChallenge(verifier);

      const expected = crypto
        .createHash('sha256')
        .update(verifier)
        .digest('base64url');

      expect(challenge).toBe(expected);
    });

    it('produces different challenges for different verifiers', () => {
      const c1 = generateCodeChallenge('verifier_a');
      const c2 = generateCodeChallenge('verifier_b');
      expect(c1).not.toBe(c2);
    });

    it('is deterministic for same input', () => {
      const input = 'same_verifier';
      expect(generateCodeChallenge(input)).toBe(generateCodeChallenge(input));
    });

    it('produces a 43-char challenge (SHA-256 → base64url is always 43 chars)', () => {
      const challenge = generateCodeChallenge(generateCodeVerifier());
      expect(challenge.length).toBe(43);
    });
  });
});
