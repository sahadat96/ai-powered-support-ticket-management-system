import { ApiProperty } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateBy,
} from 'class-validator';
import { UserResponseDto } from '../../../users/presentation/dto/user-response.dto';

function NormalizeEmail() {
  return Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );
}

function BcryptPasswordLength() {
  return ValidateBy({
    name: 'bcryptPasswordLength',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= 72,
      defaultMessage: () => 'password must be at most 72 UTF-8 bytes',
    },
  });
}

export class RegisterDto {
  @ApiProperty({ example: 'Alex Morgan', minLength: 1, maxLength: 100 })
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/\S/, { message: 'name must contain a non-whitespace character' })
  name!: string;

  @ApiProperty({ example: 'customer@example.com', maxLength: 254 })
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'A-long-password-2026', minLength: 10, maxLength: 72 })
  @IsString()
  @MinLength(10)
  @MaxLength(72)
  @BcryptPasswordLength()
  password!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'customer@example.com' })
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'A-long-password-2026' })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  @BcryptPasswordLength()
  password!: string;
}

export class AuthResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;
}
