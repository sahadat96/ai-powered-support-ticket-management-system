import { Category, Priority } from '../../tickets/domain/ticket';

export interface Analysis {
  category: Category;
  priority: Priority;
  confidence: number;
  summary: string;
  suggestedReply: string;
  reasons: string[];
  modelVersion: string;
  source: 'local-naive-bayes';
  analyzedAt: string;
}
export abstract class TicketAnalyzer {
  abstract analyze(title: string, description: string): Promise<Analysis>;
}
