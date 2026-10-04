import { describe, expect, it } from 'vitest';
import { generatePairingCode, hashPairingCode } from './pairing.js';

describe('pairing codes', () => {
  it('generates ABCD-1234 style codes', () => {
    const code = generatePairingCode();
    expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it('hashes case-insensitively', () => {
    expect(hashPairingCode('abcd-1234')).toBe(hashPairingCode('ABCD-1234'));
  });
});
