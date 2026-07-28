import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './auth.dto';

// Real, direct proof that RegisterDto's class-validator decorators work —
// the same class-transformer/class-validator pipeline NestJS's global
// ValidationPipe (main.ts) runs on every @Body() RegisterDto parameter.
// This is what makes /auth/register reject a malformed body with a clean
// 400 instead of the raw Prisma 500 that reached the client before this
// fix — see docs/ai-tuning/security-hotfix.md.
describe('RegisterDto validation', () => {
  it('rejects a completely empty body with real validation errors, not silence', async () => {
    const dto = plainToInstance(RegisterDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const properties = errors.map((e) => e.property);
    expect(properties).toEqual(expect.arrayContaining(['email', 'name', 'password', 'role']));
  });

  it('rejects a non-email string in the email field', async () => {
    const dto = plainToInstance(RegisterDto, { email: 'not-an-email', name: 'Test', password: 'x', role: 'GENERAL_MANAGER' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects an invalid role value', async () => {
    const dto = plainToInstance(RegisterDto, { email: 'a@b.com', name: 'Test', password: 'x', role: 'NOT_A_REAL_ROLE' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'role')).toBe(true);
  });

  it('accepts a real, complete, valid registration payload without the optional branchId', async () => {
    const dto = plainToInstance(RegisterDto, { email: 'a@b.com', name: 'Test User', password: 'Str0ng!Passw0rd', role: 'GENERAL_MANAGER' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts a real, complete, valid registration payload including the optional branchId', async () => {
    const dto = plainToInstance(RegisterDto, { email: 'a@b.com', name: 'Test User', password: 'Str0ng!Passw0rd', role: 'GENERAL_MANAGER', branchId: 'some-branch-id' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
