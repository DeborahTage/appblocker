import type { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../utils/errors.js';

export class StudentService {
  constructor(private readonly db: PrismaClient) {}

  async list(mentorId: string) {
    return this.db.student.findMany({
      where: { mentorId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true, createdAt: true },
    });
  }

  async create(mentorId: string, name: string, email?: string) {
    return this.db.student.create({
      data: {
        mentorId,
        name,
        email: email?.toLowerCase(),
      },
      select: { id: true, name: true, email: true, createdAt: true },
    });
  }

  async get(mentorId: string, studentId: string) {
    const student = await this.db.student.findFirst({
      where: { id: studentId, mentorId },
      select: { id: true, name: true, email: true, createdAt: true },
    });
    if (!student) throw new NotFoundError('Student not found');
    return student;
  }
}
