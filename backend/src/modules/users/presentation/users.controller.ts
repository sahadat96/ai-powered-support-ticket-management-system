import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { UsersService } from '../application/users.service';
import { UserRole } from '../domain/user';
import { AgentsResponseDto } from './dto/user-response.dto';

@ApiTags('Users')
@ApiBearerAuth()
@ApiCookieAuth('support_session')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('agents')
  @Roles(UserRole.AGENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'List agents and administrators available for assignment' })
  @ApiOkResponse({ type: AgentsResponseDto })
  async listAgents(): Promise<AgentsResponseDto> {
    return { items: await this.users.listAgents() };
  }
}
