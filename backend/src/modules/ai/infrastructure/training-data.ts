import type { TrainingExample } from '../domain/triage';

/** Curated training corpus. Evaluation cases live separately in evaluate.ts. */
export const TRAINING_EXAMPLES: readonly TrainingExample[] = [
  {
    category: 'BILLING',
    text: 'My credit card was charged twice for the same monthly subscription payment.',
  },
  {
    category: 'BILLING',
    text: 'Please send a copy of my invoice and payment receipt for accounting.',
  },
  { category: 'BILLING', text: 'I need a refund for an incorrect charge on my latest bill.' },
  {
    category: 'BILLING',
    text: 'The subscription renewal price is different from the amount we agreed.',
  },
  { category: 'BILLING', text: 'My payment was declined but the money left my bank account.' },
  {
    category: 'BILLING',
    text: 'Can I change the credit card used for recurring subscription payments?',
  },
  { category: 'BILLING', text: 'There is an extra fee and incorrect tax on our invoice.' },
  { category: 'BILLING', text: 'I cancelled the subscription but you are still charging my card.' },
  {
    category: 'BILLING',
    text: 'We want to upgrade the plan and understand the prorated billing cost.',
  },
  {
    category: 'BILLING',
    text: 'The refund has not arrived in my bank after the transaction was reversed.',
  },
  {
    category: 'BILLING',
    text: 'Our annual renewal charged the wrong amount and needs a billing adjustment.',
  },
  {
    category: 'BILLING',
    text: 'Please update the company name and billing address on this invoice.',
  },
  { category: 'BILLING', text: 'I was overcharged on the subscription and need a credit note.' },
  {
    category: 'BILLING',
    text: 'How much does the enterprise plan cost and what payment methods are accepted?',
  },
  {
    category: 'BILLING',
    text: 'The checkout payment failed when I tried to purchase a subscription.',
  },
  { category: 'BILLING', text: 'I cannot download my paid invoice or view the billing history.' },
  { category: 'BILLING', text: 'The discount coupon was not applied to my order total.' },
  {
    category: 'BILLING',
    text: 'Please explain the overdue balance and outstanding payment on my bill.',
  },
  {
    category: 'BILLING',
    text: 'Our company needs a VAT tax invoice for the last subscription purchase.',
  },
  {
    category: 'BILLING',
    text: 'I want to stop automatic renewal and cancel future subscription charges.',
  },
  {
    category: 'BILLING',
    text: 'The pricing page lists a lower price than the subscription invoice.',
  },
  {
    category: 'BILLING',
    text: 'I paid the invoice through a bank transfer but the balance still says unpaid.',
  },
  { category: 'BILLING', text: 'There are duplicate transactions on my debit card statement.' },
  {
    category: 'BILLING',
    text: 'Can you reimburse the accidental purchase and confirm the refund amount?',
  },

  {
    category: 'TECHNICAL',
    text: 'The application crashes with an unexpected error whenever I open the dashboard.',
  },
  { category: 'TECHNICAL', text: 'The API endpoint returns a server error and requests time out.' },
  {
    category: 'TECHNICAL',
    text: 'I cannot upload an attachment because the file upload button is broken.',
  },
  { category: 'TECHNICAL', text: 'The website is slow and pages take several minutes to load.' },
  {
    category: 'TECHNICAL',
    text: 'The search function returns empty results despite matching records.',
  },
  {
    category: 'TECHNICAL',
    text: 'Our production service is down and all customers see an unavailable error.',
  },
  {
    category: 'TECHNICAL',
    text: 'The mobile app freezes and stops responding after the latest update.',
  },
  {
    category: 'TECHNICAL',
    text: 'There is a bug in the report export and the CSV file is corrupted.',
  },
  {
    category: 'TECHNICAL',
    text: 'The browser shows a blank screen instead of loading the application.',
  },
  {
    category: 'TECHNICAL',
    text: 'The database connection fails and the API returns internal server errors.',
  },
  {
    category: 'TECHNICAL',
    text: 'Webhook events are not delivered and the integration request fails.',
  },
  {
    category: 'TECHNICAL',
    text: 'The save button does not work and changes are lost after refreshing.',
  },
  { category: 'TECHNICAL', text: 'A network timeout prevents downloading the generated report.' },
  {
    category: 'TECHNICAL',
    text: 'The dashboard chart renders incorrectly on a small browser screen.',
  },
  {
    category: 'TECHNICAL',
    text: 'The notification integration stopped sending events after deployment.',
  },
  { category: 'TECHNICAL', text: 'I found a reproducible bug with sorting and filtering tickets.' },
  {
    category: 'TECHNICAL',
    text: 'The page returns a not found error even though the URL is correct.',
  },
  {
    category: 'TECHNICAL',
    text: 'File attachments disappear when I submit a ticket through the form.',
  },
  {
    category: 'TECHNICAL',
    text: 'The service is offline for our entire team and nothing will load.',
  },
  {
    category: 'TECHNICAL',
    text: 'A software update broke the integration and caused an error message.',
  },
  {
    category: 'TECHNICAL',
    text: 'The application has a memory leak causing repeated crashes under load.',
  },
  {
    category: 'TECHNICAL',
    text: 'The image preview is broken and file download produces an empty document.',
  },
  {
    category: 'TECHNICAL',
    text: 'The API response contains incorrect data after saving the record.',
  },
  {
    category: 'TECHNICAL',
    text: 'The server is unavailable and every page displays a gateway timeout.',
  },

  { category: 'ACCOUNT', text: 'I forgot my password and need to reset my account login.' },
  { category: 'ACCOUNT', text: 'I am locked out of my account and cannot login.' },
  { category: 'ACCOUNT', text: 'Please change the email address associated with my user profile.' },
  {
    category: 'ACCOUNT',
    text: 'My password reset link has expired and I need a new recovery email.',
  },
  { category: 'ACCOUNT', text: 'I lost my phone and cannot complete two factor authentication.' },
  {
    category: 'ACCOUNT',
    text: 'The verification code never arrives when I try to verify my email.',
  },
  {
    category: 'ACCOUNT',
    text: 'Please delete my account and remove my personal profile information.',
  },
  { category: 'ACCOUNT', text: 'I need to update my profile name and account contact details.' },
  { category: 'ACCOUNT', text: 'My user account is suspended and I want to restore access.' },
  {
    category: 'ACCOUNT',
    text: 'How do I invite a new team member and assign an administrator role?',
  },
  {
    category: 'ACCOUNT',
    text: 'I cannot access my account because my login credentials were rejected.',
  },
  { category: 'ACCOUNT', text: 'The authentication page says my username or password is invalid.' },
  {
    category: 'ACCOUNT',
    text: 'Please revoke the old user permissions and update my account role.',
  },
  {
    category: 'ACCOUNT',
    text: 'I received a suspicious login notification and think my account is compromised.',
  },
  {
    category: 'ACCOUNT',
    text: 'Can I deactivate my profile temporarily without deleting my account?',
  },
  {
    category: 'ACCOUNT',
    text: 'I want to transfer ownership of the team account to another administrator.',
  },
  {
    category: 'ACCOUNT',
    text: 'The registration email verification link is expired and signup is blocked.',
  },
  {
    category: 'ACCOUNT',
    text: 'I need help changing my password and securing my user credentials.',
  },
  { category: 'ACCOUNT', text: 'The user invitation expired before my colleague joined the team.' },
  {
    category: 'ACCOUNT',
    text: 'My session expires immediately after login and asks me to authenticate again.',
  },
  {
    category: 'ACCOUNT',
    text: 'Please merge my duplicate user accounts under my primary email address.',
  },
  {
    category: 'ACCOUNT',
    text: 'How do I enable two factor authentication in my account security settings?',
  },
  { category: 'ACCOUNT', text: 'I cannot login after changing the email address on my profile.' },
  {
    category: 'ACCOUNT',
    text: 'The account recovery process says the email address is not registered.',
  },

  { category: 'GENERAL', text: 'Where can I find a getting started guide and a product tutorial?' },
  {
    category: 'GENERAL',
    text: 'I have a general question about your business hours and support availability.',
  },
  { category: 'GENERAL', text: 'I would like to suggest a new feature for the product roadmap.' },
  {
    category: 'GENERAL',
    text: 'Please share documentation explaining how to use the ticket workflow.',
  },
  {
    category: 'GENERAL',
    text: 'Can we schedule a product demonstration and training session for our team?',
  },
  { category: 'GENERAL', text: 'I want to share feedback about the design and user experience.' },
  {
    category: 'GENERAL',
    text: 'Do you offer onboarding guidance or a tutorial for new customers?',
  },
  {
    category: 'GENERAL',
    text: 'What are the available languages and supported geographic regions?',
  },
  {
    category: 'GENERAL',
    text: 'Please tell me where to find the documentation and knowledge base.',
  },
  { category: 'GENERAL', text: 'I have a suggestion to add dark mode as an optional feature.' },
  {
    category: 'GENERAL',
    text: 'Can your sales team discuss a partnership and product demonstration?',
  },
  {
    category: 'GENERAL',
    text: 'What is the process for submitting feedback and feature requests?',
  },
  {
    category: 'GENERAL',
    text: 'I would like general information about the company and its services.',
  },
  {
    category: 'GENERAL',
    text: 'Does your product offer training materials and an introductory guide?',
  },
  {
    category: 'GENERAL',
    text: 'Thank you for the excellent service; I wanted to leave some positive feedback.',
  },
  {
    category: 'GENERAL',
    text: 'I want to request a feature that makes the navigation easier to use.',
  },
  { category: 'GENERAL', text: 'How can I contact your team about a business proposal?' },
  {
    category: 'GENERAL',
    text: 'Please explain which features are available and how the product works.',
  },
  {
    category: 'GENERAL',
    text: 'Could you share release notes and information about upcoming features?',
  },
  {
    category: 'GENERAL',
    text: 'I have a nonurgent question about the documentation and onboarding process.',
  },
  {
    category: 'GENERAL',
    text: 'Are there any webinars or educational resources for learning the software?',
  },
  {
    category: 'GENERAL',
    text: 'I suggest improving the dashboard layout and adding a compact view option.',
  },
  { category: 'GENERAL', text: 'Where can I read your privacy policy and service terms?' },
  {
    category: 'GENERAL',
    text: 'Please arrange a consultation so we can understand the product capabilities.',
  },
];
