import {
  MODEL_VERSION,
  TICKET_CATEGORIES,
  TicketCategory,
  TicketTriageModel,
} from './domain/triage';
import { TRAINING_EXAMPLES } from './infrastructure/training-data';

interface EvaluationExample {
  category: TicketCategory;
  title: string;
  description: string;
}

// Held out: these sentences are not included in model fitting. This small
// handcrafted English benchmark is a smoke evaluation, not a production claim.
const EVALUATION_EXAMPLES: readonly EvaluationExample[] = [
  { category: 'BILLING', title: 'Unrecognized payment', description: 'A second subscription charge appeared on my card statement this morning.' },
  { category: 'BILLING', title: 'Need receipt for expenses', description: 'Could you provide the invoice for our annual purchase?' },
  { category: 'BILLING', title: 'Return my money', description: 'I accidentally purchased the wrong plan and would like a refund.' },
  { category: 'BILLING', title: 'Tax amount is wrong', description: 'The total on the latest bill does not include our agreed discount.' },
  { category: 'BILLING', title: 'New card details', description: 'How do we replace the payment method before the subscription renews?' },
  { category: 'BILLING', title: 'Money taken after cancellation', description: 'The recurring subscription payment continued after we cancelled.' },
  { category: 'BILLING', title: 'Balance dispute', description: 'Our bank transfer payment completed but the invoice remains overdue.' },
  { category: 'BILLING', title: 'Reimbursement pending', description: 'When will the refund for the duplicate transaction reach my bank?' },

  { category: 'TECHNICAL', title: 'Export problem', description: 'Downloading the report produces a corrupted file with no data.' },
  { category: 'TECHNICAL', title: 'Dashboard will not open', description: 'The page keeps loading then displays a server timeout error.' },
  { category: 'TECHNICAL', title: 'Deployment regression', description: 'The mobile application crashes after the new software update.' },
  { category: 'TECHNICAL', title: 'Service unavailable', description: 'All customers are affected by a production outage.' },
  { category: 'TECHNICAL', title: 'Search results incorrect', description: 'The filter returns every record instead of matching the search.' },
  { category: 'TECHNICAL', title: 'Attachment problem', description: 'Selecting a file to upload causes a blank screen in the browser.' },
  { category: 'TECHNICAL', title: 'Events missing', description: 'Our integration webhook endpoint stopped receiving API requests.' },
  { category: 'TECHNICAL', title: 'Saving does nothing', description: 'The submit button is broken and my changes disappear on refresh.' },

  { category: 'ACCOUNT', title: 'Recovery email missing', description: 'I requested a password reset but never received the email link.' },
  { category: 'ACCOUNT', title: 'Access denied', description: 'My account is locked and login says my credentials are invalid.' },
  { category: 'ACCOUNT', title: 'New phone', description: 'I cannot complete two factor authentication with my replacement device.' },
  { category: 'ACCOUNT', title: 'Change profile email', description: 'My company email address changed and I want to update the account.' },
  { category: 'ACCOUNT', title: 'Remove my membership', description: 'Please deactivate my account and delete the personal profile.' },
  { category: 'ACCOUNT', title: 'Team permissions', description: 'A colleague needs administrator access; how can I change their user role?' },
  { category: 'ACCOUNT', title: 'Registration blocked', description: 'The email verification code expires before I can finish signup.' },
  { category: 'ACCOUNT', title: 'Suspicious account activity', description: 'An unknown login changed my password and my account may be compromised.' },

  { category: 'GENERAL', title: 'Introduction to the product', description: 'Do you have a tutorial or onboarding guide for new team members?' },
  { category: 'GENERAL', title: 'Dark mode suggestion', description: 'I would like to submit a feature request for a different dashboard theme.' },
  { category: 'GENERAL', title: 'Learning materials', description: 'Where can we find the documentation and training resources?' },
  { category: 'GENERAL', title: 'Contact sales', description: 'Our company would like a product demonstration before discussing a partnership.' },
  { category: 'GENERAL', title: 'Operating hours', description: 'When is your support team available during the weekend?' },
  { category: 'GENERAL', title: 'Product feedback', description: 'The layout looks good and I have a suggestion for improving navigation.' },
  { category: 'GENERAL', title: 'Service policies', description: 'Please share the privacy policy and terms documentation.' },
  { category: 'GENERAL', title: 'Roadmap question', description: 'Where can I see the upcoming features and release notes?' },
];

const model = new TicketTriageModel(TRAINING_EXAMPLES);
const confusion: Record<TicketCategory, Record<TicketCategory, number>> =
  Object.fromEntries(TICKET_CATEGORIES.map((category) => [
    category,
    Object.fromEntries(TICKET_CATEGORIES.map((prediction) => [prediction, 0])),
  ])) as Record<TicketCategory, Record<TicketCategory, number>>;
const failures: Array<{ title: string; expected: TicketCategory; predicted: TicketCategory }> = [];
let correct = 0;
for (const example of EVALUATION_EXAMPLES) {
  const result = model.analyze(example.title, example.description);
  confusion[example.category][result.category] += 1;
  if (result.category === example.category) correct += 1;
  else failures.push({ title: example.title, expected: example.category, predicted: result.category });
}

const metrics = TICKET_CATEGORIES.map((category) => {
  const truePositive = confusion[category][category];
  const predicted = TICKET_CATEGORIES.reduce((sum, actual) => sum + confusion[actual][category], 0);
  const actual = TICKET_CATEGORIES.reduce((sum, prediction) => sum + confusion[category][prediction], 0);
  const precision = predicted ? truePositive / predicted : 0;
  const recall = actual ? truePositive / actual : 0;
  const f1 = precision + recall ? 2 * precision * recall / (precision + recall) : 0;
  return { category, support: actual, precision, recall, f1 };
});

console.log(JSON.stringify({
  modelVersion: MODEL_VERSION,
  provider: 'local-naive-bayes',
  trainingExamples: TRAINING_EXAMPLES.length,
  evaluationExamples: EVALUATION_EXAMPLES.length,
  accuracy: correct / EVALUATION_EXAMPLES.length,
  macroF1: metrics.reduce((sum, metric) => sum + metric.f1, 0) / metrics.length,
  metrics,
  confusionMatrix: confusion,
  failures,
  note: 'Small held-out handcrafted English benchmark; confidence is uncalibrated. Do not treat these metrics as production accuracy.',
}, null, 2));
