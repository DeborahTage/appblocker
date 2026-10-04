import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_MENTOR_TTL: z.string().default('8h'),
  JWT_STUDENT_TTL: z.string().default('4h'),
  JWT_WS_TICKET_TTL: z.string().default('2m'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  PAIRING_CODE_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  SUMMARY_CLEANUP_INTERVAL_MS: z.coerce.number().int().positive().default(300_000),
  SEED_MENTOR_EMAIL: z.string().email().optional(),
  SEED_MENTOR_PASSWORD: z.string().min(8).optional(),
  SEED_MENTOR_NAME: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${details}`);
  }
  return parsed.data;
}
