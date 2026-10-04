import { z } from 'zod';

/**
 * Session monitoring configuration.
 * Domain lists are retained for API compatibility; the Windows MVP agent
 * does not match domains (window titles / URLs are never inspected).
 */
export const SessionConfigSchema = z.object({
  allowedApps: z.array(z.string().min(1)).default([]),
  blockedApps: z.array(z.string().min(1)).default([]),
  allowedDomains: z.array(z.string().min(1)).default([]),
  blockedDomains: z.array(z.string().min(1)).default([]),
  /** When true, aggregate app/state durations may be retained briefly. */
  enableSessionSummary: z.boolean().default(false),
  summaryRetentionHours: z.number().int().positive().max(168).default(24),
});

export type SessionConfig = z.infer<typeof SessionConfigSchema>;

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  allowedApps: ['Code.exe', 'WindowsTerminal.exe', 'cmd.exe', 'powershell.exe'],
  blockedApps: ['Discord.exe', 'Steam.exe', 'LeagueClient.exe'],
  allowedDomains: ['developer.mozilla.org', 'docs.python.org', 'react.dev'],
  blockedDomains: ['youtube.com', 'tiktok.com'],
  enableSessionSummary: false,
  summaryRetentionHours: 24,
};
