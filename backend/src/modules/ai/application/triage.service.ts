import { Injectable } from '@nestjs/common';
import { TicketTriageModel, TriageResult } from '../domain/triage';
import { TRAINING_EXAMPLES } from '../infrastructure/training-data';

@Injectable()
export class TriageService {
  private readonly model = new TicketTriageModel(TRAINING_EXAMPLES);

  analyze(title: string, description: string): TriageResult {
    return this.model.analyze(title, description);
  }
}
