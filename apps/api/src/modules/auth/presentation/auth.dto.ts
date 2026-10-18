import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({example: 'agent@support.local'})
  @Transform(({value}) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail() @MaxLength(254)
  email: string;

  @ApiProperty({minLength: 8, maxLength: 64, format: 'password'})
  @IsString() @MinLength(8) @MaxLength(64)
  password: string;
}

export class RegisterDto extends LoginDto {
  @ApiProperty({example: 'Sahadat Hossain', minLength: 2, maxLength: 80})
  @Transform(({value}) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(2) @MaxLength(80)
  name: string;

  @ApiProperty({minLength: 10, maxLength: 64, format: 'password', description: 'At least one letter and one number.'})
  @IsString() @MinLength(10) @MaxLength(64) @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {message: 'Password must include a letter and a number.'})
  declare password: string;
}
