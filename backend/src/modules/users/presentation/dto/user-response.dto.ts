import { ApiProperty } from '@nestjs/swagger';
import { AuthUser, UserRole } from '../../domain/user';

export class UserResponseDto implements AuthUser {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'customer@example.com' })
  email!: string;

  @ApiProperty({ example: 'Alex Morgan' })
  name!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;
}

export class AgentsResponseDto {
  @ApiProperty({ type: [UserResponseDto] })
  items!: UserResponseDto[];
}
