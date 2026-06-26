export interface GetStartedFormData {
  fullName: string;
  workEmail: string;
  companyName: string;
  teamSize: '1-5' | '6-20' | '21-50' | '50+';
}

export interface ContactFormData {
  name: string;
  email: string;
  message: string;
}

export interface DemoRequestFormData {
  name: string;
  email: string;
  company: string;
  teamSize: string;
}

export interface NotifyFormData {
  email: string;
}

export type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

export interface FormState<T> {
  data: T;
  status: FormStatus;
  errors: Partial<Record<keyof T, string>>;
  message?: string;
}
