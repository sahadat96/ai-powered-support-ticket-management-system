import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './database/prisma.module';
import { PrismaService } from './database/prisma.service';
import { validateEnvironment } from './config/environment';
import { AuthModule } from './modules/auth/auth.module';
import { Public } from './modules/auth/presentation/decorators/public.decorator';
import { TicketsModule } from './modules/tickets/tickets.module';

@Controller('health')
class HealthController {
  constructor(private readonly data: PrismaService) {}
  @Public()
  @Get()
  async health() {
    await this.data.$queryRaw`SELECT 1`;
    return { status: 'ok', service: 'support-desk-api' };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
      validate: validateEnvironment,
    }),
    PrismaModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    AuthModule,
    TicketsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
