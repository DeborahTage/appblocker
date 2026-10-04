import bcrypt from 'bcryptjs';
import { loadEnv } from '../types/env.js';
import { prisma } from '../services/prisma.js';
import { DEFAULT_SESSION_CONFIG } from '@focusmentor/contracts';

async function seed() {
  const env = loadEnv();
  const email = (env.SEED_MENTOR_EMAIL ?? 'mentor@example.com').toLowerCase();
  const password = env.SEED_MENTOR_PASSWORD ?? 'ChangeMe123!';
  const name = env.SEED_MENTOR_NAME ?? 'Demo Mentor';

  const passwordHash = await bcrypt.hash(password, 12);
  const mentor = await prisma.mentor.upsert({
    where: { email },
    update: { name, passwordHash },
    create: { email, name, passwordHash },
  });

  await prisma.mentorSettings.upsert({
    where: { mentorId: mentor.id },
    update: {},
    create: {
      mentorId: mentor.id,
      defaultAllowedApps: DEFAULT_SESSION_CONFIG.allowedApps,
      defaultBlockedApps: DEFAULT_SESSION_CONFIG.blockedApps,
      defaultAllowedDomains: DEFAULT_SESSION_CONFIG.allowedDomains,
      defaultBlockedDomains: DEFAULT_SESSION_CONFIG.blockedDomains,
      defaultDurationMinutes: 60,
      enableSessionSummaryByDefault: false,
      summaryRetentionHours: 24,
    },
  });

  const existingStudent = await prisma.student.findFirst({
    where: { mentorId: mentor.id, name: 'Alex Student' },
  });
  if (!existingStudent) {
    await prisma.student.create({
      data: {
        mentorId: mentor.id,
        name: 'Alex Student',
        email: 'alex@example.com',
      },
    });
  }

  console.log(`Seeded mentor ${email}`);
  await prisma.$disconnect();
}

seed().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
