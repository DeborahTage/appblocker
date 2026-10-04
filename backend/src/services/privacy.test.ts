import { describe, expect, it } from 'vitest';
import { SessionService } from './sessionService.js';
import { InMemoryLiveStateStore } from '../models/liveState.js';
import { JwtService } from './jwtService.js';
import { loadEnv } from '../types/env.js';
import { ValidationError } from '../utils/errors.js';

describe('privacy validation', () => {
  it('rejects URLs and file paths in state payloads', () => {
    const env = loadEnv({
      ...process.env,
      JWT_SECRET: 'test-secret-that-is-long-enough-123456',
      DATABASE_URL: 'postgresql://x:x@localhost:5432/x',
    });
    // Minimal construction — only validateStatePayload is exercised.
    const svc = new SessionService(
      {} as never,
      new InMemoryLiveStateStore(),
      new JwtService(env),
      {} as never,
      env,
    );

    expect(() =>
      svc.validateStatePayload({
        currentApp: 'https://youtube.com',
        processName: 'chrome.exe',
      }),
    ).toThrow(ValidationError);

    expect(() =>
      svc.validateStatePayload({
        currentApp: 'VS Code',
        processName: 'C:\\Windows\\code.exe',
      }),
    ).toThrow(ValidationError);

    expect(() =>
      svc.validateStatePayload({
        currentApp: 'VS Code',
        processName: 'Code.exe',
      }),
    ).not.toThrow();
  });
});
