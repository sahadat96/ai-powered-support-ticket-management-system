import { Category } from '../../tickets/domain/ticket';
// Held-out authored examples: never passed to model training.
export const EVALUATION_DATA: { text: string; category: Category }[] = [
  {
    text: 'My invoice shows the wrong tax amount this month',
    category: 'BILLING',
  },
  { text: 'I was charged twice and need a refund', category: 'BILLING' },
  { text: 'The credit card transaction was declined', category: 'BILLING' },
  {
    text: 'Please cancel the annual subscription renewal',
    category: 'BILLING',
  },
  {
    text: 'The API endpoint keeps returning a timeout error',
    category: 'TECHNICAL',
  },
  {
    text: 'The website is slow and the dashboard is frozen',
    category: 'TECHNICAL',
  },
  { text: 'File upload fails with a server error', category: 'TECHNICAL' },
  { text: 'There is a bug in the webhook integration', category: 'TECHNICAL' },
  { text: 'The password reset link has expired', category: 'ACCOUNT' },
  { text: 'My account is locked and login fails', category: 'ACCOUNT' },
  { text: 'I need to change the email in my profile', category: 'ACCOUNT' },
  {
    text: 'The authentication code never arrives during sign in',
    category: 'ACCOUNT',
  },
  { text: 'I have a suggestion for the product roadmap', category: 'GENERAL' },
  {
    text: 'Where can I find the onboarding tutorial guide',
    category: 'GENERAL',
  },
  { text: 'Can sales arrange an enterprise demo', category: 'GENERAL' },
  { text: 'Feature request for a new dark mode', category: 'GENERAL' },
];
