import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Actor } from '../../users/domain/user';
import { CurrentUser, Roles } from '../../auth/presentation/auth.decorators';
import { TicketsService } from '../application/tickets.service';
import { CommentDto, CreateTicketDto, ListTicketsDto, UpdateTicketDto, VersionDto } from './tickets.dto';

@ApiTags('Tickets') @ApiBearerAuth() @ApiCookieAuth() @Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}
  @Get() @ApiOperation({summary: 'Paginated tickets, scoped to the current customer or staff queue'})
  list(@CurrentUser() actor: Actor, @Query() query: ListTicketsDto) { return this.tickets.list(actor, query); }
  @Get('stats') stats(@CurrentUser() actor: Actor) { return this.tickets.stats(actor); }
  @Post() create(@CurrentUser() actor: Actor, @Body() dto: CreateTicketDto) { return this.tickets.create(actor, dto); }
  @Get(':id') detail(@CurrentUser() actor: Actor, @Param('id', ParseUUIDPipe) id: string) { return this.tickets.detail(actor, id); }
  @Patch(':id') update(@CurrentUser() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTicketDto) { return this.tickets.update(actor, id, dto); }
  @Post(':id/comments') comment(@CurrentUser() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CommentDto) { return this.tickets.comment(actor, id, dto.body); }
  @Roles('ADMIN') @Delete(':id') @HttpCode(204)
  delete(@CurrentUser() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: VersionDto) { return this.tickets.delete(actor, id, dto.version); }
}
