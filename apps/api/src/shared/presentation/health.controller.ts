import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../infrastructure/prisma.service';
import { Public } from '../../modules/auth/presentation/auth.decorators';

@ApiTags('Health') @Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}
  @Public() @Get()
  async check() {
    try { await this.prisma.$queryRaw`SELECT 1`; return {status: 'ok', database: 'connected'}; }
    catch { throw new ServiceUnavailableException('Database unavailable.'); }
  }
}
