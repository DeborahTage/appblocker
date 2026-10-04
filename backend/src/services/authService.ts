import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import { UnauthorizedError } from '../utils/errors.js';
import type { JwtService } from './jwtService.js';
import { createCsrfToken } from '../utils/csrf.js';

export class AuthService {
  constructor(
    private readonly db: PrismaClient,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const mentor = await this.db.mentor.findUnique({ where: { email: email.toLowerCase() } });
    if (!mentor) {
      throw new UnauthorizedError('Invalid credentials');
    }
    const ok = await bcrypt.compare(password, mentor.passwordHash);
    if (!ok) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const token = this.jwt.signMentor({
      sub: mentor.id,
      email: mentor.email,
    });
    const csrfToken = createCsrfToken();

    return {
      token,
      csrfToken,
      mentor: {
        id: mentor.id,
        email: mentor.email,
        name: mentor.name,
      },
    };
  }

  async getMentor(id: string) {
    const mentor = await this.db.mentor.findUnique({
      where: { id },
      select: { id: true, email: true, name: true },
    });
    if (!mentor) {
      throw new UnauthorizedError('Mentor not found');
    }
    return mentor;
  }
}
