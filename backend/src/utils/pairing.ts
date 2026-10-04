import { createHash, randomInt } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generatePairingCode(): string {
  const part = (len: number) =>
    Array.from({ length: len }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return `${part(4)}-${part(4)}`;
}

export function hashPairingCode(code: string): string {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}
