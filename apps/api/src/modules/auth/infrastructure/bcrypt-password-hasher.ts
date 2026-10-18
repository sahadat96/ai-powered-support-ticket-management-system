import { Injectable } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { PasswordHasher } from '../domain/password-hasher';

@Injectable()
export class BcryptPasswordHasher extends PasswordHasher {
  hash(value: string) {
    return hash(value, 12);
  }
  verify(value: string, hashed: string) {
    return compare(value, hashed);
  }
}
