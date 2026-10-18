import { Module } from '@nestjs/common';
import { TriageService } from './application/triage.service';

@Module({
  providers: [TriageService],
  exports: [TriageService],
})
export class AiModule {}
