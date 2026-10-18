import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { InjectDataSource, TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { validateEnvironment } from './config/environment';
import { AuthModule } from './modules/auth/auth.module';
import { Public } from './modules/auth/presentation/decorators/public.decorator';
import { TicketsModule } from './modules/tickets/tickets.module';

@Controller('health')
class HealthController {
  constructor(@InjectDataSource() private readonly data: DataSource) {}
  @Public()
  @Get()
  async health() {
    await this.data.query('SELECT 1');
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
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
        installExtensions: false,
        logging: false,
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    AuthModule,
    TicketsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
