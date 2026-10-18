import { Analysis, TicketAnalyzer } from '../domain/ticket-analyzer';
import { CATEGORIES, Category, Priority } from '../../tickets/domain/ticket';
import { TRAINING_DATA } from './training-data';

const STOP_WORDS = new Set('the a an is are was were i we my our to for of and or with on in it this that have has not please can could would be do does after from at as me us your you'.split(' '));
function tokenize(text: string) { return (text.toLowerCase().match(/[a-z]+/g) ?? []).filter(w => w.length > 2 && !STOP_WORDS.has(w)); }

export class LocalTicketAnalyzer extends TicketAnalyzer {
  private readonly vocabulary = new Set<string>();
  private readonly counts = new Map<Category, Map<string, number>>();
  private readonly totals = new Map<Category, number>();
  constructor() {
    super();
    for (const category of CATEGORIES) { this.counts.set(category, new Map()); this.totals.set(category, 0); }
    for (const row of TRAINING_DATA) for (const word of tokenize(row.text)) {
      this.vocabulary.add(word);
      const counts = this.counts.get(row.category)!;
      counts.set(word, (counts.get(word) ?? 0) + 1);
      this.totals.set(row.category, this.totals.get(row.category)! + 1);
    }
  }
  async analyze(title: string, description: string): Promise<Analysis> {
    const text = `${title}. ${description}`;
    const words = tokenize(`${title} ${title} ${description}`).filter(w => this.vocabulary.has(w));
    const scores = CATEGORIES.map(category => ({category, score: words.reduce((score, word) => score + Math.log(((this.counts.get(category)!.get(word) ?? 0) + 1) / (this.totals.get(category)! + this.vocabulary.size)), Math.log(0.25))}));
    const max = Math.max(...scores.map(s => s.score));
    const probabilities = scores.map(s => ({category: s.category, probability: Math.exp(s.score - max)}));
    const total = probabilities.reduce((sum, p) => sum + p.probability, 0);
    probabilities.sort((a, b) => b.probability - a.probability);
    const confidence = Math.round((probabilities[0].probability / total) * 100) / 100;
    const uncertain = words.length === 0 || confidence < 0.55;
    const category: Category = uncertain ? 'GENERAL' : probabilities[0].category;
    // Priority is a transparent heuristic, separate from the statistical category model.
    const lower = text.toLowerCase().replace(/\b(?:not|isn't|is not|no longer)\s+(?:an?\s+)?(?:urgent|critical|outage|emergency)\b/g, '');
    let priority: Priority = 'MEDIUM';
    let reason = 'Default medium priority; no explicit high-impact signal detected.';
    if (/\b(outage|data loss|security breach|production down|all users|everyone|emergency)\b/.test(lower)) { priority = 'URGENT'; reason = 'Potential widespread disruption, security incident, or data loss mentioned.'; }
    else if (/\b(urgent|critical|blocked|cannot work|can.t access|unable to access|deadline|charged twice|locked out)\b/.test(lower)) { priority = 'HIGH'; reason = 'A blocked workflow or time-sensitive impact was mentioned.'; }
    else if (/\b(feature request|suggestion|feedback|how to|documentation)\b/.test(lower)) { priority = 'LOW'; reason = 'Informational request or product feedback detected.'; }
    const replies: Record<Category, string> = {
      BILLING: 'Thanks for reporting this billing issue. Please share the invoice or transaction reference and approximate date. Do not send full card details. We will review the charge and follow up.',
      TECHNICAL: 'Thanks for flagging this issue. Please share the steps to reproduce, the time it occurred, and any error message. Avoid including secrets or sensitive data. Our technical team will investigate.',
      ACCOUNT: 'Thanks for contacting us about your account. Please describe the sign-in or access error and confirm which step fails. Never share your password, recovery code, or authentication code.',
      GENERAL: 'Thanks for reaching out. Could you share a little more context about what you would like to accomplish? We will route your request to the right person.',
    };
    return {category, priority, confidence: uncertain ? Math.min(confidence, 0.54) : confidence,
      summary: text.replace(/\s+/g, ' ').trim().slice(0, 240) + (text.trim().length > 240 ? '…' : ''),
      suggestedReply: replies[category], reasons: [uncertain ? 'Insufficient familiar vocabulary or low confidence; routed to general review.' : `Category predicted by a multinomial Naive Bayes classifier using ${new Set(words).size} familiar terms.`, reason, 'Suggestions require human review. Confidence is a model score, not a calibrated probability.'],
      modelVersion: 'local-nb-v1', source: 'local-naive-bayes', analyzedAt: new Date().toISOString()};
  }
}
