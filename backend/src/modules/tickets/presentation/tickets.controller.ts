import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import { AuthUser } from '../../users/domain/user';
import { TicketsService } from '../application/tickets.service';
import {
  AnalyzeTicketDto,
  ChangeStatusDto,
  CreateCommentDto,
  CreateTicketDto,
  DeleteTicketDto,
  TicketListDto,
  UpdateTicketDto,
} from './dto/ticket.dto';

@ApiTags('Tickets')
@ApiCookieAuth('support_session')
@ApiResponse({ status: 401, description: 'Authentication required' })
@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}
  @Get()
  @ApiOperation({ summary: 'Search and filter tickets; customers see only their own' })
  list(@Query() query: TicketListDto, @CurrentUser() user: AuthUser) {
    return this.tickets.list(query, user);
  }
  @Get('stats')
  @ApiOperation({ summary: 'Dashboard aggregates scoped to the current user' })
  stats(@CurrentUser() user: AuthUser) {
    return this.tickets.stats(user);
  }
  @Post()
  @ApiOperation({ summary: 'Create a ticket with automatic ML triage' })
  create(@Body() input: CreateTicketDto, @CurrentUser() user: AuthUser) {
    return this.tickets.create(input, user);
  }
  @Get(':id')
  @ApiOperation({
    summary: 'Ticket, visible comments, audit events, and allowed status transitions',
  })
  detail(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.detail(id, user);
  }
  @Patch(':id')
  @ApiOperation({ summary: 'Edit ticket fields with optimistic concurrency protection' })
  @ApiResponse({ status: 409, description: 'Version is stale; fetch the current ticket' })
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdateTicketDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.update(id, input, user);
  }
  @Patch(':id/status')
  @ApiOperation({ summary: 'Move through the authorized ticket workflow' })
  changeStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: ChangeStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.changeStatus(id, input, user);
  }
  @Post(':id/comments')
  @ApiOperation({ summary: 'Add a public reply or staff-only internal note' })
  comment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: CreateCommentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.addComment(id, input, user);
  }
  @Post(':id/triage')
  @HttpCode(200)
  @ApiOperation({ summary: 'Staff: refresh ML analysis and optionally apply its suggestions' })
  analyze(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: AnalyzeTicketDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.analyze(id, input, user);
  }
  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft delete a ticket (administrator, or requester while open)' })
  delete(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() input: DeleteTicketDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.delete(id, input.version, user);
  }
}
