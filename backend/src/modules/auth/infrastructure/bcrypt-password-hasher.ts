import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PasswordHasher } from '../domain/auth-session';

@Injectable()
export class BcryptPasswordHasher extends PasswordHasher {
  hash(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
