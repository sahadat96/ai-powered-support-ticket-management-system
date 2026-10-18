/** Public, framework-independent contract for local ticket triage. */
export const TICKET_CATEGORIES = [
  'BILLING',
  'TECHNICAL',
  'ACCOUNT',
  'GENERAL',
] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface TrainingExample {
  category: TicketCategory;
  text: string;
}

export interface TriageResult {
  category: TicketCategory;
  priority: TicketPriority;
  /** Relative model score. This is not a calibrated probability of correctness. */
  confidence: number;
  summary: string;
  suggestedReply: string;
  explanation: string[];
  modelVersion: string;
  provider: 'local-naive-bayes';
}

export const MODEL_VERSION = 'nb-en-v1.0.0';

const STOP_WORDS = new Set(
  ('a an and are as at be been being but by can could did do does for from had has ' +
    'have he her here him his how i if in into is it its just me my of on or our ' +
    'please she so some than that the their them there these they this those to ' +
    'us very was we were what when where which who why will with would you your ' +
    'also am need needs want wants hello hi thanks thank help support ticket ' +
    'regarding about still getting get got really someone something').split(' '),
);

const NORMALIZED_WORDS: Readonly<Record<string, string>> = {
  bills: 'bill', billed: 'bill', billing: 'bill',
  invoices: 'invoice', invoiced: 'invoice',
  charges: 'charge', charged: 'charge', charging: 'charge',
  payments: 'payment', paid: 'payment', paying: 'payment',
  refunds: 'refund', refunded: 'refund', refunding: 'refund',
  subscriptions: 'subscription', subscribed: 'subscription',
  renewals: 'renewal', renewing: 'renewal', renewed: 'renewal',
  accounts: 'account', profiles: 'profile', passwords: 'password',
  credentials: 'credential', permissions: 'permission',
  notifications: 'notification', addresses: 'address', emails: 'email',
  users: 'user', members: 'member', teams: 'team',
  errors: 'error', crashes: 'crash', crashed: 'crash', crashing: 'crash',
  failures: 'failure', failed: 'fail', fails: 'fail', failing: 'fail',
  bugs: 'bug', broken: 'break', breaks: 'break',
  loading: 'load', loads: 'load', loaded: 'load',
  uploading: 'upload', uploaded: 'upload', uploads: 'upload',
  downloading: 'download', downloaded: 'download', downloads: 'download',
  requests: 'request', requesting: 'request', requested: 'request',
  features: 'feature', suggestions: 'suggestion',
  questions: 'question', tutorials: 'tutorial', guides: 'guide',
  integrations: 'integration', options: 'option', details: 'detail',
  attachments: 'attachment', files: 'file', pages: 'page',
};

function normalizeInput(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\b(?:can['’]t|cant|can not)\b/g, 'cannot')
    .replace(/\b(?:log[ -]?in|sign[ -]?in)\b/g, 'login')
    .replace(/\b(?:doesn['’]t|doesnt)\b/g, 'does not')
    .replace(/\b(?:isn['’]t|isnt)\b/g, 'is not')
    .replace(/\b(?:don['’]t|dont)\b/g, 'do not');
}

function words(value: string): string[] {
  // The model intentionally uses English words, not email addresses or numbers.
  return (normalizeInput(value).match(/[a-z]{2,}/g) ?? [])
    .map((word) => NORMALIZED_WORDS[word] ?? word)
    .filter((word) => !STOP_WORDS.has(word));
}

function features(tokens: readonly string[]): string[] {
  return [
    ...tokens,
    ...tokens.slice(1).map((token, index) => `${tokens[index]}~${token}`),
  ];
}

interface CategoryStatistics {
  documents: number;
  totalFeatures: number;
  counts: Map<string, number>;
}

interface Classification {
  category: TicketCategory;
  confidence: number;
  explanation: string;
}

/**
 * Multinomial naive Bayes, fitted once from labeled examples. No network, model
 * service, randomness, or changes to the supplied corpus occur during fitting.
 */
export class TicketTriageModel {
  private readonly vocabulary = new Set<string>();
  private readonly statistics = new Map<TicketCategory, CategoryStatistics>();
  private readonly documentCount: number;

  constructor(examples: readonly TrainingExample[]) {
    for (const category of TICKET_CATEGORIES) {
      this.statistics.set(category, {
        documents: 0,
        totalFeatures: 0,
        counts: new Map(),
      });
    }
    this.documentCount = examples.length;
    for (const example of examples) {
      const stats = this.statistics.get(example.category);
      if (!stats) throw new Error(`Unsupported training category: ${example.category}`);
      stats.documents += 1;
      for (const feature of features(words(example.text))) {
        this.vocabulary.add(feature);
        stats.totalFeatures += 1;
        stats.counts.set(feature, (stats.counts.get(feature) ?? 0) + 1);
      }
    }
    if (
      this.vocabulary.size === 0 ||
      TICKET_CATEGORIES.some((category) => !this.statistics.get(category)!.documents)
    ) {
      throw new Error('Training requires nonempty English examples for every category.');
    }
  }

  analyze(title: string, description: string): TriageResult {
    const text = `${title}\n${description}`;
    const classification = this.classify(text);
    const priority = determinePriority(text);
    return {
      category: classification.category,
      priority: priority.value,
      confidence: classification.confidence,
      summary: summarize(title, description),
      suggestedReply: REPLIES[classification.category],
      explanation: [
        classification.explanation,
        priority.explanation,
        'Confidence is the model\'s relative category score, not a calibrated probability of correctness. Summary extraction and reply templates run locally.',
      ],
      modelVersion: MODEL_VERSION,
      provider: 'local-naive-bayes',
    };
  }

  private classify(text: string): Classification {
    // Bound repeated tokens and document length so one repeated term cannot
    // arbitrarily dominate the posterior or make request processing expensive.
    const tokens = words(text.slice(0, 30_000)).slice(0, 1_000);
    const uniqueTokens = [...new Set(tokens)];
    const knownWords = uniqueTokens.filter((token) => this.vocabulary.has(token));
    if (
      knownWords.length < 2 ||
      knownWords.length / Math.max(uniqueTokens.length, 1) < 0.2
    ) {
      return {
        category: 'GENERAL',
        confidence: 0.25,
        explanation: 'Assigned GENERAL for manual review because the text contains too little recognizable English context for this model.',
      };
    }

    const observed = new Map<string, number>();
    for (const feature of features(tokens)) {
      if (this.vocabulary.has(feature)) {
        observed.set(feature, Math.min((observed.get(feature) ?? 0) + 1, 3));
      }
    }
    const scores = TICKET_CATEGORIES.map((category) => {
      const stats = this.statistics.get(category)!;
      let logScore = Math.log(stats.documents / this.documentCount);
      for (const [feature, count] of observed) {
        logScore += count * this.logLikelihood(feature, category);
      }
      return { category, logScore, probability: 0 };
    }).sort((a, b) => b.logScore - a.logScore);
    const denominator = scores.reduce(
      (sum, score) => sum + Math.exp(score.logScore - scores[0].logScore),
      0,
    );
    for (const score of scores) {
      score.probability = Math.exp(score.logScore - scores[0].logScore) / denominator;
    }
    const best = scores[0];
    if (best.probability < 0.48 || best.probability - scores[1].probability < 0.1) {
      return {
        category: 'GENERAL',
        confidence: Number(best.probability.toFixed(4)),
        explanation: 'Assigned GENERAL for manual review because learned category scores were too close or below the confidence threshold; confidence is the leading model score before fallback.',
      };
    }
    const signals = knownWords
      .map((word) => ({
        word,
        weight: this.logLikelihood(word, best.category) -
          Math.max(...TICKET_CATEGORIES
            .filter((category) => category !== best.category)
            .map((category) => this.logLikelihood(word, category))),
      }))
      .filter((item) => item.weight > 0)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 4)
      .map((item) => item.word);
    return {
      category: best.category,
      confidence: Number(best.probability.toFixed(4)),
      explanation: `A trained multinomial naive Bayes model selected ${best.category}.${signals.length ? ` Learned word signals: ${signals.join(', ')}.` : ''}`,
    };
  }

  private logLikelihood(feature: string, category: TicketCategory): number {
    const stats = this.statistics.get(category)!;
    // Add-one (Laplace) smoothing keeps unseen class/word pairs finite.
    return Math.log(
      ((stats.counts.get(feature) ?? 0) + 1) /
      (stats.totalFeatures + this.vocabulary.size),
    );
  }
}

interface PriorityDecision {
  value: TicketPriority;
  explanation: string;
}

function determinePriority(text: string): PriorityDecision {
  // Negation is limited to a nearby phrase. It is deliberately conservative:
  // this is a transparent rule system, not a natural-language understanding model.
  const normalized = normalizeInput(text).slice(0, 30_000);
  const activeText = normalized
    .replace(/\b(?:no|not an?|without)\s+(?:evidence of\s+)?(?:major\s+|current\s+)?(?:security\s+)?(?:outage|breach|emergency|unauthorized access)\b/g, '')
    .replace(/\b(?:is |are )?not\s+(?:down|offline|unavailable|urgent|critical|locked out)\b/g, '')
    .replace(/\b(?:planned|scheduled|resolved|previous)\s+(?:outage|maintenance)\b/g, '')
    .replace(/\bnot\s+(?:a\s+)?(?:security\s+)?(?:breach|compromised|urgent)\b/g, '');
  if (/\b(?:data breach|security breach|account (?:was |is |has been )?compromised|credentials? (?:were |was |are )?(?:leaked|stolen)|unauthorized access)\b/.test(activeText)) {
    return { value: 'URGENT', explanation: 'Priority rule: a possible security compromise requires urgent human review.' };
  }
  const outage = /\b(?:outage|down|offline|unavailable|cannot access|cannot login|not working|fail(?:ing|ed)?)\b/.test(activeText);
  const widespread = /\b(?:production|entire (?:service|system|team)|all (?:users|customers|agents)|everyone|company wide|company-wide)\b/.test(activeText);
  if (outage && widespread) {
    return { value: 'URGENT', explanation: 'Priority rule: service failure with production or widespread impact requires urgent review.' };
  }
  if (/\b(?:locked out|cannot login|unable to login|cannot access (?:my |the )?account|duplicate charge|charged twice|charged (?:three|multiple) times|fraud|urgent|critical|blocking|blocked)\b/.test(activeText)) {
    return { value: 'HIGH', explanation: 'Priority rule: the text reports blocked access, a duplicate charge, a security concern, or explicit high urgency.' };
  }
  if (/\b(?:feature request|suggestion|feedback|cosmetic|nice to have|not urgent|no rush|general question)\b/.test(normalized)) {
    return { value: 'LOW', explanation: 'Priority rule: feedback, a feature request, or an explicitly nonurgent question is low priority.' };
  }
  return { value: 'MEDIUM', explanation: 'Priority rule: no explicit urgent, high, or low priority condition was found; human review can override the default MEDIUM.' };
}

function plainText(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function summarize(title: string, description: string): string {
  const heading = plainText(title);
  const detail = plainText(description).split(/(?<=[.!?])\s+/)[0] ?? '';
  const text = heading && detail && heading.toLowerCase() !== detail.toLowerCase()
    ? `${heading} — ${detail}`
    : heading || detail || 'Ticket requires additional details.';
  if (text.length <= 240) return text;
  const shortened = text.slice(0, 237);
  const lastSpace = shortened.lastIndexOf(' ');
  return `${shortened.slice(0, lastSpace > 180 ? lastSpace : 237)}…`;
}

const REPLIES: Readonly<Record<TicketCategory, string>> = {
  BILLING: 'Thank you for contacting support about billing. Please share the relevant invoice or transaction reference and the date of the charge so our team can review it. Please do not send full card numbers or other sensitive payment details.',
  TECHNICAL: 'Thank you for reporting this technical issue. Please share the steps to reproduce it, the exact error message, and the browser or app version you are using. Our support team can use those details to investigate.',
  ACCOUNT: 'Thank you for contacting support about your account. Please describe the account change or access problem and any error message you see. Please do not share passwords, recovery codes, or one-time verification codes.',
  GENERAL: 'Thank you for contacting support. Please share a little more detail about your question or request, including the outcome you are looking for, so our team can help.',
};
