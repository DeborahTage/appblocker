import type { Response } from 'express';
import { CreateStudentRequestSchema } from '@focusmentor/contracts';
import type { StudentService } from '../services/studentService.js';
import type { AuthedRequest } from '../middleware/auth.js';

export function createStudentController(students: StudentService) {
  return {
    async list(req: AuthedRequest, res: Response) {
      const list = await students.list(req.mentor!.sub);
      res.json({ students: list });
    },
    async create(req: AuthedRequest, res: Response) {
      const body = CreateStudentRequestSchema.parse(req.body);
      const student = await students.create(req.mentor!.sub, body.name, body.email);
      res.status(201).json(student);
    },
    async get(req: AuthedRequest, res: Response) {
      const student = await students.get(req.mentor!.sub, String(req.params.id));
      res.json(student);
    },
  };
}
