export interface WidgetConfig {
  apiKey: string;
  baseUrl: string;
  agentId?: string;
  agentName?: string;
  mode?: 'widget' | 'fullscreen';
  position?: 'bottom-right' | 'bottom-left';
  welcomeMessage?: string;
}

export interface WidgetMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  followUpQuestions?: string[];
  status?: 'completed' | 'processing';
  severity?: string;
  escalated?: boolean;
  incidentUrl?: string;
  summary?: string;
  impact?: string;
  resolution?: string;
  eta?: string;
}

export interface SessionResponse {
  sessionId: string;
  createdAt: string;
  expiresAt: string;
}

export interface ChatResponse {
  sessionId: string;
  chatId: string;
  response: {
    text: string;
    summary?: string;
    impact?: string;
    resolution?: string;
    eta?: string;
    severity?: string;
    escalated?: boolean;
    incidentUrl?: string;
  };
  status: 'completed' | 'processing';
  followUpQuestions?: string[];
}

export interface BrandingConfig {
  branding: {
    primaryColor?: string;
    logoUrl?: string;
    headerText?: string;
    welcomeMessage?: string;
  };
  vapidPublicKey: string;
  maxSessionMessages: number;
}
