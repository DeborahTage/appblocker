import { randomBytes } from 'node:crypto';

export function createCsrfToken(): string {
  return randomBytes(32).toString('hex');
}
