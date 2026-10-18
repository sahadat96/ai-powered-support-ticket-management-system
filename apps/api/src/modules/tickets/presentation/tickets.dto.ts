import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  CATEGORIES,
  Category,
  PRIORITIES,
  Priority,
  STATUSES,
  Status,
} from '../domain/ticket';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class CreateTicketDto {
  @ApiProperty({
    example: 'Unable to access the billing dashboard',
    minLength: 5,
    maxLength: 160,
  })
  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(160)
  title: string;
  @ApiProperty({
    example: 'The billing dashboard returns an error after I sign in.',
    minLength: 20,
    maxLength: 10000,
  })
  @Transform(trim)
  @IsString()
  @MinLength(20)
  @MaxLength(10000)
  description: string;
}
export class VersionDto {
  @ApiProperty({
    description:
      'Current ticket version; prevents overwriting concurrent changes',
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  version: number;
}
export class UpdateTicketDto extends VersionDto {
  @ApiPropertyOptional()
  @ValidateIf((_, v) => v !== undefined)
  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(160)
  title?: string;
  @ApiPropertyOptional()
  @ValidateIf((_, v) => v !== undefined)
  @Transform(trim)
  @IsString()
  @MinLength(20)
  @MaxLength(10000)
  description?: string;
  @ApiPropertyOptional({ enum: STATUSES })
  @ValidateIf((_, v) => v !== undefined)
  @IsIn(STATUSES)
  status?: Status;
  @ApiPropertyOptional({ enum: PRIORITIES })
  @ValidateIf((_, v) => v !== undefined)
  @IsIn(PRIORITIES)
  priority?: Priority;
  @ApiPropertyOptional({ enum: CATEGORIES })
  @ValidateIf((_, v) => v !== undefined)
  @IsIn(CATEGORIES)
  category?: Category;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Staff UUID; null unassigns (admin only)',
  })
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;
}
export class ListTicketsDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;
  @ApiPropertyOptional({ default: 10, maximum: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 10;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  search?: string;
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: Status;
  @ApiPropertyOptional({ enum: PRIORITIES })
  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: Priority;
  @ApiPropertyOptional({ enum: CATEGORIES })
  @IsOptional()
  @IsIn(CATEGORIES)
  category?: Category;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  assignedToMe?: boolean;
}
export class CommentDto {
  @ApiProperty({ minLength: 1, maxLength: 5000 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body: string;
}
