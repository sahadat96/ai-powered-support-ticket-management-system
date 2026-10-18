import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Actor } from '../../users/domain/user';
import { CurrentUser, Roles } from '../../auth/presentation/auth.decorators';
import {
  CreateTicketDto,
  VersionDto,
} from '../../tickets/presentation/tickets.dto';
import { AiService } from '../application/ai.service';

@ApiTags('AI triage')
@ApiBearerAuth()
@ApiCookieAuth()
@Controller()
export class AiController {
  constructor(private readonly ai: AiService) {}
  @Post('ai/preview')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Preview local ML categorization and heuristic priority; no data persisted',
  })
  preview(@Body() dto: CreateTicketDto) {
    return this.ai.preview(dto.title, dto.description);
  }
  @Roles('ADMIN', 'AGENT')
  @Post('tickets/:id/analysis')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Save triage suggestions for staff review; does not change category or priority',
  })
  analyze(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VersionDto,
  ) {
    return this.ai.analyze(actor, id, dto.version);
  }
}
