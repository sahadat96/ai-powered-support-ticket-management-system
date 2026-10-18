import { LocalTicketAnalyzer } from './local-ticket-analyzer';
import { EVALUATION_DATA } from './evaluation-data';

describe('Local triage model', () => {
  const model = new LocalTicketAnalyzer();
  it('performs above a 75% baseline on held-out synthetic examples', async () => {
    let correct = 0;
    for (const row of EVALUATION_DATA) if ((await model.analyze('', row.text)).category === row.category) correct++;
    expect(correct / EVALUATION_DATA.length).toBeGreaterThanOrEqual(0.75);
  });
  it('flags widespread incidents as urgent', async () => {
    const result = await model.analyze('Production down', 'API unavailable for all users after deployment');
    expect(result.category).toBe('TECHNICAL'); expect(result.priority).toBe('URGENT');
  });
  it('routes unfamiliar vocabulary for low-confidence review', async () => {
    const result = await model.analyze('xyzabc', 'qwerty zxcvb');
    expect(result.category).toBe('GENERAL'); expect(result.confidence).toBeLessThan(0.55);
  });
  it('does not escalate an explicitly non-urgent request', async () => {
    expect((await model.analyze('Question', 'This is not urgent, just checking an invoice')).priority).toBe('MEDIUM');
  });
  it('never promises a refund or an automated resolution', async () => {
    expect((await model.analyze('Refund request', 'My card was charged twice')).suggestedReply).toContain('review');
  });
});
