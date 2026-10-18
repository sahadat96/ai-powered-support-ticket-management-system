import { ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './auth.dto';

describe('Registration validation', () => {
  const valid = {
    name: 'Alex Morgan',
    email: 'alex@example.com',
    password: 'a-secure-password',
  };

  it('rejects whitespace-only names and passwords shorter than ten characters', async () => {
    const errors = await validate(
      plainToInstance(RegisterDto, {
        ...valid,
        name: '   ',
        password: 'short',
      }),
    );

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['name', 'password']),
    );
  });

  it('rejects passwords that exceed bcrypt byte limits, including Unicode', async () => {
    const errors = await validate(
      plainToInstance(RegisterDto, {
        ...valid,
        password: '🔐'.repeat(20),
      }),
    );

    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });

  it('rejects role injection through the strict HTTP validation pipe', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    await expect(
      pipe.transform(
        { ...valid, role: 'ADMIN' },
        {
          type: 'body',
          metatype: RegisterDto,
        },
      ),
    ).rejects.toThrow('Bad Request Exception');
  });
});
