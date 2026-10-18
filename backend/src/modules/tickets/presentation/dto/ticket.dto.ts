import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '../../domain/ticket';

export class CreateTicketDto {
  @ApiProperty({ example: 'Unable to access the billing dashboard', minLength: 5, maxLength: 160 })
  @IsString()
  @MinLength(5)
  @MaxLength(160)
  @Matches(/\S/)
  title: string;

  @ApiProperty({
    example: 'After signing in, the billing page returns a 500 error for our team.',
    minLength: 15,
    maxLength: 10000,
  })
  @IsString()
  @MinLength(15)
  @MaxLength(10000)
  @Matches(/\S/)
  description: string;

  @ApiPropertyOptional({
    enum: TICKET_CATEGORIES,
    description: 'Omit to use the classifier suggestion',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(TICKET_CATEGORIES)
  category?: TicketCategory;

  @ApiPropertyOptional({
    enum: TICKET_PRIORITIES,
    description: 'Omit to use the priority suggestion',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(TICKET_PRIORITIES)
  priority?: TicketPriority;
}
export class VersionDto {
  @ApiProperty({ example: 1, description: 'Current ticket version; a stale version returns 409' })
  @IsInt()
  @Min(1)
  version: number;
}
export class UpdateTicketDto extends VersionDto {
  @ApiPropertyOptional({ minLength: 5, maxLength: 160 })
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MinLength(5)
  @MaxLength(160)
  @Matches(/\S/)
  title?: string;

  @ApiPropertyOptional({ minLength: 15, maxLength: 10000 })
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MinLength(15)
  @MaxLength(10000)
  @Matches(/\S/)
  description?: string;

  @ApiPropertyOptional({ enum: TICKET_CATEGORIES })
  @ValidateIf((_, v) => v !== undefined)
  @IsIn(TICKET_CATEGORIES)
  category?: TicketCategory;

  @ApiPropertyOptional({ enum: TICKET_PRIORITIES })
  @ValidateIf((_, v) => v !== undefined)
  @IsIn(TICKET_PRIORITIES)
  priority?: TicketPriority;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Staff only. Null removes the assignee from an open ticket.',
  })
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsUUID('4')
  assigneeId?: string | null;
}
export class ChangeStatusDto extends VersionDto {
  @ApiProperty({ enum: TICKET_STATUSES })
  @IsIn(TICKET_STATUSES)
  status: TicketStatus;
}
export class CreateCommentDto {
  @ApiProperty({ minLength: 1, maxLength: 5000 })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  @Matches(/\S/)
  body: string;

  @ApiPropertyOptional({ default: false, description: 'Internal notes are visible to staff only' })
  @ValidateIf((_, v) => v !== undefined)
  @IsBoolean()
  internal?: boolean;
}
export class AnalyzeTicketDto extends VersionDto {
  @ApiPropertyOptional({
    default: false,
    description: 'Apply suggested category and priority as well as saving the analysis',
  })
  @ValidateIf((_, v) => v !== undefined)
  @IsBoolean()
  apply?: boolean;
}
export class TicketListDto {
  @ApiPropertyOptional({ default: 1, maximum: 1000000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;
  @ApiPropertyOptional({ default: 10, maximum: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 10;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
  @ApiPropertyOptional({ enum: TICKET_STATUSES })
  @IsOptional()
  @IsIn(TICKET_STATUSES)
  status?: TicketStatus;
  @ApiPropertyOptional({ enum: TICKET_CATEGORIES })
  @IsOptional()
  @IsIn(TICKET_CATEGORIES)
  category?: TicketCategory;
  @ApiPropertyOptional({ enum: TICKET_PRIORITIES })
  @IsOptional()
  @IsIn(TICKET_PRIORITIES)
  priority?: TicketPriority;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  assigneeId?: string;
  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  unassigned?: boolean;
  @ApiPropertyOptional({ enum: ['newest', 'oldest', 'priority'], default: 'newest' })
  @IsOptional()
  @IsIn(['newest', 'oldest', 'priority'])
  sort?: 'newest' | 'oldest' | 'priority';
}
export class DeleteTicketDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;
}
