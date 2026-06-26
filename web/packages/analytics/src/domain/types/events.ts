export type AnalyticsEvent =
  | { name: 'page_view'; properties: { path: string; locale: string } }
  | { name: 'cta_click'; properties: { cta_id: string; cta_text: string; page: string } }
  | { name: 'form_submit'; properties: { form_id: string; page: string } }
  | { name: 'integration_filter'; properties: { category: string } }
  | { name: 'pricing_plan_click'; properties: { plan: string } }
  | {
      name: 'roi_calculator_use';
      properties: { incidents: number; time: string; engineers: number };
    }
  | { name: 'language_switch'; properties: { from: string; to: string } }
  | { name: 'demo_request'; properties: { page: string } }
  | { name: 'compare_page_view'; properties: { competitor?: string } };

export interface AnalyticsConfig {
  ga4MeasurementId?: string;
  clarityId?: string;
  enabled: boolean;
}
