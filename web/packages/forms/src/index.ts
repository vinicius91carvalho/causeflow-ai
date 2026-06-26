// Domain

// Application — Validators
export {
  type ContactSchemaType,
  contactSchema,
  type GetStartedSchemaType,
  getStartedSchema,
  type NotifySchemaType,
  notifySchema,
  type WaitlistSchemaType,
  waitlistSchema,
} from './application/validators';
export type {
  ContactFormData,
  DemoRequestFormData,
  FormState,
  FormStatus,
  GetStartedFormData,
  NotifyFormData,
} from './domain/types/form-types';

// Infrastructure — Sanitization
export {
  sanitizeFormData,
  sanitizeInput,
} from './infrastructure/sanitization/sanitize';

// Presentation — Hooks
export { useForm } from './presentation/hooks/use-form';
