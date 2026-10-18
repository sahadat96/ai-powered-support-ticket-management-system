import { Category } from '../../tickets/domain/ticket';

// Small, authored synthetic corpus. No customer content is used for training.
export const TRAINING_DATA: { category: Category; text: string }[] = [
  {
    category: 'BILLING',
    text: 'Payment failed card declined transaction charge checkout',
  },
  {
    category: 'BILLING',
    text: 'Invoice incorrect billing amount subscription plan cost',
  },
  {
    category: 'BILLING',
    text: 'Refund requested duplicate charge charged twice money',
  },
  {
    category: 'BILLING',
    text: 'Cancel subscription renewal billing payment receipt',
  },
  {
    category: 'BILLING',
    text: 'Upgrade plan pricing monthly annual subscription',
  },
  { category: 'BILLING', text: 'Credit card payment charged invoice tax' },
  { category: 'BILLING', text: 'Discount coupon invoice refund overcharged' },
  {
    category: 'BILLING',
    text: 'Bank transfer pending transaction payment failed',
  },
  {
    category: 'TECHNICAL',
    text: 'Server error application crash broken page bug',
  },
  {
    category: 'TECHNICAL',
    text: 'API timeout integration endpoint unavailable outage',
  },
  {
    category: 'TECHNICAL',
    text: 'Upload file fails download broken attachment',
  },
  {
    category: 'TECHNICAL',
    text: 'Website slow performance loading dashboard frozen',
  },
  {
    category: 'TECHNICAL',
    text: 'Database connection error server down production',
  },
  {
    category: 'TECHNICAL',
    text: 'Application blank screen browser javascript error',
  },
  {
    category: 'TECHNICAL',
    text: 'Webhook API integration sync failure timeout',
  },
  {
    category: 'TECHNICAL',
    text: 'Search results broken export bug software crash',
  },
  { category: 'ACCOUNT', text: 'Login password reset sign in locked account' },
  {
    category: 'ACCOUNT',
    text: 'Email verification access account authentication',
  },
  { category: 'ACCOUNT', text: 'Change profile name email settings account' },
  { category: 'ACCOUNT', text: 'Two factor authentication code MFA login' },
  { category: 'ACCOUNT', text: 'Forgot password reset link expired locked' },
  {
    category: 'ACCOUNT',
    text: 'Permission access denied user invitation team',
  },
  {
    category: 'ACCOUNT',
    text: 'Security suspicious login account compromised',
  },
  {
    category: 'ACCOUNT',
    text: 'Deactivate delete account profile personal data',
  },
  {
    category: 'GENERAL',
    text: 'Question product information documentation help guide',
  },
  {
    category: 'GENERAL',
    text: 'Feature request suggestion feedback improvement',
  },
  { category: 'GENERAL', text: 'How use product tutorial onboarding training' },
  { category: 'GENERAL', text: 'Contact sales partnership enterprise demo' },
  { category: 'GENERAL', text: 'Thank you feedback excellent support service' },
  {
    category: 'GENERAL',
    text: 'Request new feature roadmap suggestion dark mode',
  },
  {
    category: 'GENERAL',
    text: 'Where documentation guide instructions learning',
  },
  {
    category: 'GENERAL',
    text: 'Business hours contact support general question',
  },
];
