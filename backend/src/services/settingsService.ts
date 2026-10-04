import type { PrismaClient } from '@prisma/client';
import { DEFAULT_SESSION_CONFIG, type MentorSettings } from '@focusmentor/contracts';
import { NotFoundError } from '../utils/errors.js';

const DEFAULT_SETTINGS: MentorSettings = {
  defaultAllowedApps: DEFAULT_SESSION_CONFIG.allowedApps,
  defaultBlockedApps: DEFAULT_SESSION_CONFIG.blockedApps,
  defaultAllowedDomains: DEFAULT_SESSION_CONFIG.allowedDomains,
  defaultBlockedDomains: DEFAULT_SESSION_CONFIG.blockedDomains,
  defaultDurationMinutes: 60,
  enableSessionSummaryByDefault: false,
  summaryRetentionHours: 24,
};

export class SettingsService {
  constructor(private readonly db: PrismaClient) {}

  async getOrCreate(mentorId: string): Promise<MentorSettings> {
    const existing = await this.db.mentorSettings.findUnique({ where: { mentorId } });
    if (existing) {
      return this.toDto(existing);
    }
    const created = await this.db.mentorSettings.create({
      data: {
        mentorId,
        defaultAllowedApps: DEFAULT_SETTINGS.defaultAllowedApps,
        defaultBlockedApps: DEFAULT_SETTINGS.defaultBlockedApps,
        defaultAllowedDomains: DEFAULT_SETTINGS.defaultAllowedDomains,
        defaultBlockedDomains: DEFAULT_SETTINGS.defaultBlockedDomains,
        defaultDurationMinutes: DEFAULT_SETTINGS.defaultDurationMinutes,
        enableSessionSummaryByDefault: DEFAULT_SETTINGS.enableSessionSummaryByDefault,
        summaryRetentionHours: DEFAULT_SETTINGS.summaryRetentionHours,
      },
    });
    return this.toDto(created);
  }

  async update(mentorId: string, patch: Partial<MentorSettings>): Promise<MentorSettings> {
    await this.getOrCreate(mentorId);
    const updated = await this.db.mentorSettings.update({
      where: { mentorId },
      data: {
        ...(patch.defaultAllowedApps !== undefined
          ? { defaultAllowedApps: patch.defaultAllowedApps }
          : {}),
        ...(patch.defaultBlockedApps !== undefined
          ? { defaultBlockedApps: patch.defaultBlockedApps }
          : {}),
        ...(patch.defaultAllowedDomains !== undefined
          ? { defaultAllowedDomains: patch.defaultAllowedDomains }
          : {}),
        ...(patch.defaultBlockedDomains !== undefined
          ? { defaultBlockedDomains: patch.defaultBlockedDomains }
          : {}),
        ...(patch.defaultDurationMinutes !== undefined
          ? { defaultDurationMinutes: patch.defaultDurationMinutes }
          : {}),
        ...(patch.enableSessionSummaryByDefault !== undefined
          ? { enableSessionSummaryByDefault: patch.enableSessionSummaryByDefault }
          : {}),
        ...(patch.summaryRetentionHours !== undefined
          ? { summaryRetentionHours: patch.summaryRetentionHours }
          : {}),
      },
    });
    return this.toDto(updated);
  }

  private toDto(row: {
    defaultAllowedApps: string[];
    defaultBlockedApps: string[];
    defaultAllowedDomains: string[];
    defaultBlockedDomains: string[];
    defaultDurationMinutes: number;
    enableSessionSummaryByDefault: boolean;
    summaryRetentionHours: number;
  }): MentorSettings {
    return {
      defaultAllowedApps: row.defaultAllowedApps,
      defaultBlockedApps: row.defaultBlockedApps,
      defaultAllowedDomains: row.defaultAllowedDomains,
      defaultBlockedDomains: row.defaultBlockedDomains,
      defaultDurationMinutes: row.defaultDurationMinutes,
      enableSessionSummaryByDefault: row.enableSessionSummaryByDefault,
      summaryRetentionHours: row.summaryRetentionHours,
    };
  }

  async requireMentor(mentorId: string) {
    const mentor = await this.db.mentor.findUnique({ where: { id: mentorId } });
    if (!mentor) throw new NotFoundError('Mentor not found');
    return mentor;
  }
}
