process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-123456';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://focusmentor:focusmentor@localhost:5432/focusmentor_test';
