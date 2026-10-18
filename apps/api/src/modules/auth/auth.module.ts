import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthService } from './application/auth.service';
import { PasswordHasher } from './domain/password-hasher';
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher';
import { AuthController } from './presentation/auth.controller';
import { AuthGuard } from './presentation/auth.guard';

@Module({
  imports: [UsersModule, JwtModule.registerAsync({inject: [ConfigService], useFactory: (config: ConfigService) => ({secret: config.getOrThrow<string>('JWT_SECRET'), signOptions: {expiresIn: config.getOrThrow<number>('JWT_EXPIRES_IN_SECONDS'), issuer: 'support-api', audience: 'support-app'}, verifyOptions: {issuer: 'support-api', audience: 'support-app', algorithms: ['HS256']}})})],
  providers: [AuthService, {provide: PasswordHasher, useClass: BcryptPasswordHasher}, {provide: APP_GUARD, useClass: AuthGuard}],
  controllers: [AuthController], exports: [UsersModule]
})
export class AuthModule {}
