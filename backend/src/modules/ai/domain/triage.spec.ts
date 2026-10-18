import { MODEL_VERSION, TicketTriageModel, TrainingExample } from './triage';
import { TRAINING_EXAMPLES } from '../infrastructure/training-data';

describe('local ticket triage model', () => {
  const model = new TicketTriageModel(TRAINING_EXAMPLES);

  it.each([
    ['Payment dispute', 'The subscription charged my bank card twice and I need a refund.', 'BILLING'],
    ['Broken dashboard', 'Every attempt to load the page returns an internal server error.', 'TECHNICAL'],
    ['Password recovery', 'My account reset link expired and I cannot login.', 'ACCOUNT'],
    ['Getting started', 'Where is the onboarding tutorial and product documentation?', 'GENERAL'],
  ])('classifies the held-out example %s', (title, description, expected) => {
    const result = model.analyze(title, description);
    expect(result.category).toBe(expected);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it.each([
    ['', ''],
    ['help', 'please help me'],
    ['zxqwvbnr', 'qzxwvrpk lmnqzbrt vxqzfnmb'],
    ['invoice', ''],
    ['বাংলা প্রশ্ন', 'আমার একটি সমস্যা আছে'],
  ])('sends low information or unsupported text to general review', (title, description) => {
    const result = model.analyze(title, description);
    expect(result.category).toBe('GENERAL');
    expect(result.confidence).toBe(0.25);
    expect(result.explanation[0]).toContain('manual review');
  });

  it('prioritizes a widespread outage independently of category inference', () => {
    const result = model.analyze('Production outage', 'All customers see a server error and the service is down.');
    expect(result.category).toBe('TECHNICAL');
    expect(result.priority).toBe('URGENT');
    expect(result.explanation[1]).toContain('widespread');
  });

  it('requires urgent human review for an account compromise', () => {
    expect(model.analyze('Account compromised', 'My account has been compromised and the password was changed.').priority).toBe('URGENT');
  });

  it('marks blocked login and duplicate charges high priority', () => {
    expect(model.analyze('Login problem', 'I cannot login to my account after resetting my password.').priority).toBe('HIGH');
    expect(model.analyze('Duplicate charge', 'My card was charged twice for the subscription.').priority).toBe('HIGH');
  });

  it.each([
    ['Not urgent', 'A feature request for the dashboard. There is no outage for all users.'],
    ['Feature request', 'The production service is not down. This is a suggestion for a cosmetic change.'],
    ['General question', 'No security breach or unauthorized activity. I would like documentation.'],
    ['Scheduled maintenance', 'There is a planned outage for all users, no rush, just a general question.'],
  ])('does not escalate common negated or planned incidents: %s', (title, description) => {
    expect(model.analyze(title, description).priority).toBe('LOW');
  });

  it('returns deterministic results and does not mutate training examples', () => {
    const before = JSON.stringify(TRAINING_EXAMPLES);
    const frozen = Object.freeze(TRAINING_EXAMPLES.map((example) => Object.freeze({ ...example })));
    const instance = new TicketTriageModel(frozen);
    const first = instance.analyze('Invoice question', 'Please explain my subscription payment and invoice total.');
    expect(instance.analyze('Invoice question', 'Please explain my subscription payment and invoice total.')).toEqual(first);
    expect(JSON.stringify(TRAINING_EXAMPLES)).toBe(before);
  });

  it('extracts the summary and provides clearly local output metadata', () => {
    const result = model.analyze('Payment question', 'My invoice contains an extra fee. A later sentence is not in the summary.');
    expect(result.summary).toBe('Payment question — My invoice contains an extra fee.');
    expect(result.provider).toBe('local-naive-bayes');
    expect(result.modelVersion).toBe(MODEL_VERSION);
    expect(result.suggestedReply).toContain('Please do not send full card numbers');
    expect(result.explanation.join(' ')).toContain('not a calibrated probability');
  });

  it('bounds long summaries and strips HTML markup', () => {
    const result = model.analyze('<b>Dashboard issue</b>', 'The dashboard error repeats. '.repeat(1_000));
    expect(result.summary).not.toContain('<b>');
    expect(result.summary.length).toBeLessThanOrEqual(240);
    const longTitle = model.analyze('Long title '.repeat(100), 'Some details.');
    expect(longTitle.summary.length).toBeLessThanOrEqual(240);
    expect(longTitle.summary.endsWith('…')).toBe(true);
  });

  it('rejects incomplete training data instead of creating an invalid model', () => {
    expect(() => new TicketTriageModel([])).toThrow('every category');
    const invalid = [{ category: 'OTHER', text: 'invalid' }] as unknown as TrainingExample[];
    expect(() => new TicketTriageModel(invalid)).toThrow('Unsupported training category');
  });
});
