'use client';

import { SectionLayout } from '@causeflow/ui/layouts';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@causeflow/ui/primitives';
import { AnimateOnScroll } from '@causeflow/ui/themes';
import { useTranslations } from 'next-intl';

interface DeploymentApproachesSectionProps {
  variant?: 'hero' | 'detailed' | 'security';
}

const CloudIcon = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="1.5"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"
    />
  </svg>
);

const ShieldIcon = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="1.5"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
    />
  </svg>
);

const CheckmarkIcon = () => (
  <svg
    aria-hidden="true"
    className="mt-1 h-5 w-5 flex-shrink-0 text-success"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="2"
    stroke="currentColor"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const ShieldCheckIcon = () => (
  <svg
    aria-hidden="true"
    className="mt-1 h-5 w-5 flex-shrink-0 text-success"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="2"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
    />
  </svg>
);

// Data flow step box — dark variant (hero/dark backgrounds)
function FlowBoxDark({ label }: { label: string }) {
  return (
    <span className="px-3 py-2 rounded-lg bg-slate-800 text-sm text-slate-300 border border-slate-700 whitespace-nowrap">
      {label}
    </span>
  );
}

// Data flow step box — light variant (default/accent backgrounds)
function FlowBoxLight({ label }: { label: string }) {
  return (
    <span className="px-3 py-2 rounded-lg bg-muted text-sm text-foreground border border-border whitespace-nowrap">
      {label}
    </span>
  );
}

// Arrow divider for horizontal (desktop) layout
function ArrowH({ dark }: { dark?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`hidden sm:inline-block text-lg font-bold ${dark ? 'text-slate-500' : 'text-muted-foreground'}`}
    >
      →
    </span>
  );
}

// Arrow divider for vertical (mobile) layout
function ArrowV({ dark }: { dark?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`sm:hidden text-lg font-bold ${dark ? 'text-slate-500' : 'text-muted-foreground'}`}
    >
      ↓
    </span>
  );
}

interface DataFlowProps {
  steps: string[];
  dark?: boolean;
}

function DataFlow({ steps, dark = false }: DataFlowProps) {
  const Box = dark ? FlowBoxDark : FlowBoxLight;

  return (
    <div className="flex flex-col items-center gap-1 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-2">
      {steps.map((step, i) => (
        <div key={step} className="flex flex-col items-center gap-1 sm:flex-row sm:gap-2">
          <Box label={step} />
          {i < steps.length - 1 && (
            <>
              <ArrowH dark={dark} />
              <ArrowV dark={dark} />
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export function DeploymentApproachesSection({
  variant = 'hero',
}: DeploymentApproachesSectionProps) {
  const t = useTranslations('deploymentApproaches');

  // ----------------------------------------------------------------
  // variant="security" — compact accent panel, privacy-preserving focus only
  // ----------------------------------------------------------------
  if (variant === 'security') {
    const guarantees = t.raw('security.guarantees') as string[];

    return (
      <SectionLayout variant="accent" id="deployment-approaches">
        <AnimateOnScroll>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">{t('security.title')}</h2>
            <p className="mt-4 text-muted-foreground">{t('security.description')}</p>
          </div>
        </AnimateOnScroll>

        <AnimateOnScroll delay={100}>
          <div className="mx-auto mt-10 max-w-2xl">
            <div className="border-l-4 border-success bg-background p-8 rounded-lg">
              <div className="flex items-start gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10 text-success flex-shrink-0">
                  <ShieldIcon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant="secondary"
                      className="bg-success/10 text-success border-success/20"
                    >
                      {t('privacyPreserving.badge')}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-semibold">{t('privacyPreserving.title')}</h3>
                </div>
              </div>
              <ul className="space-y-3">
                {guarantees.map((guarantee) => (
                  <li key={guarantee} className="flex items-start gap-3">
                    <ShieldCheckIcon />
                    <span className="text-sm">{guarantee}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </AnimateOnScroll>
      </SectionLayout>
    );
  }

  // ----------------------------------------------------------------
  // variant="hero" and variant="detailed" share the two-card layout
  // ----------------------------------------------------------------
  const isDark = variant === 'hero';
  const sectionVariant = isDark ? 'dark' : 'default';

  const titleKey = isDark ? 'sectionTitle' : 'product.title';
  const subtitleKey = isDark ? 'sectionSubtitle' : 'product.subtitle';

  const connectedFeatures = t.raw('connected.features') as string[];
  const ppFeatures = t.raw('privacyPreserving.features') as string[];

  const connectedFlowSteps = [
    t('dataFlow.connected.step1'),
    t('dataFlow.connected.step2'),
    t('dataFlow.connected.step3'),
    t('dataFlow.connected.step4'),
  ];
  const ppFlowSteps = [
    t('dataFlow.privacyPreserving.step1'),
    t('dataFlow.privacyPreserving.step2'),
    t('dataFlow.privacyPreserving.step3'),
    t('dataFlow.privacyPreserving.step4'),
    t('dataFlow.privacyPreserving.step5'),
  ];

  return (
    <SectionLayout variant={sectionVariant} id="deployment-approaches" className="">
      {/* Section header */}
      <AnimateOnScroll>
        <div className="mx-auto max-w-3xl text-center">
          {isDark && (
            <Badge
              variant="secondary"
              className="mb-4 bg-success/10 text-success border-success/20"
            >
              {t('freeBadge')}
            </Badge>
          )}
          <h2
            className={`text-2xl font-bold sm:text-3xl lg:text-4xl ${isDark ? 'text-white' : ''}`}
          >
            {t(titleKey)}
          </h2>
          <p className={`mt-4 ${isDark ? 'text-slate-400' : 'text-muted-foreground'}`}>
            {t(subtitleKey)}
          </p>
        </div>
      </AnimateOnScroll>

      {/* Two-card grid */}
      <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Connected Mode card */}
        <AnimateOnScroll delay={0}>
          <Card
            className={`group h-full hover:-translate-y-1 hover:shadow-lg transition-all duration-300 ${
              isDark
                ? 'border-primary/30 bg-slate-900/50 hover:border-primary/50'
                : 'bg-card border hover:border-primary/30'
            }`}
          >
            <CardHeader>
              <div
                className={`mb-3 flex h-12 w-12 items-center justify-center rounded-lg ${
                  isDark ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary'
                }`}
              >
                <CloudIcon className="h-6 w-6" />
              </div>
              <CardTitle className={`text-xl ${isDark ? 'text-white' : ''}`}>
                {t('connected.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-sm mb-5 ${isDark ? 'text-slate-400' : 'text-muted-foreground'}`}>
                {t('connected.description')}
              </p>
              <ul className="space-y-3">
                {connectedFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <CheckmarkIcon />
                    <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-foreground'}`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
              <p
                className={`mt-5 text-xs font-medium ${
                  isDark ? 'text-slate-500' : 'text-muted-foreground'
                }`}
              >
                {t('connected.pricing')}
              </p>
            </CardContent>
          </Card>
        </AnimateOnScroll>

        {/* Privacy-Preserving Mode card */}
        <AnimateOnScroll delay={100}>
          <Card
            className={`group h-full hover:-translate-y-1 hover:shadow-lg transition-all duration-300 ${
              isDark
                ? 'border-success/30 bg-slate-900/50 shadow-lg shadow-success/10 hover:border-success/50'
                : 'bg-card border-success/30 hover:border-success/50'
            }`}
          >
            <CardHeader>
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-success/10 text-success">
                <ShieldIcon className="h-6 w-6" />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <Badge
                  variant="secondary"
                  className="bg-success/10 text-success border-success/20 text-xs"
                >
                  {t('privacyPreserving.badge')}
                </Badge>
              </div>
              <CardTitle className={`text-xl ${isDark ? 'text-white' : ''}`}>
                {t('privacyPreserving.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-sm mb-5 ${isDark ? 'text-slate-400' : 'text-muted-foreground'}`}>
                {t('privacyPreserving.description')}
              </p>
              <ul className="space-y-3">
                {ppFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <CheckmarkIcon />
                    <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-foreground'}`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
              <p
                className={`mt-5 text-xs font-medium ${
                  isDark ? 'text-slate-500' : 'text-muted-foreground'
                }`}
              >
                {t('connected.pricing')}
              </p>
            </CardContent>
          </Card>
        </AnimateOnScroll>
      </div>

      {/* Data flow visualization — only on product page (detailed variant) */}
      {variant === 'detailed' && (
        <div
          className={`mt-10 rounded-xl p-6 pb-8 sm:p-8 sm:pb-10 ${
            isDark ? 'bg-slate-900/50 border border-slate-800' : 'bg-muted/50 border border-border'
          }`}
        >
          <AnimateOnScroll delay={200}>
            <h3
              className={`mb-6 text-center text-sm font-semibold uppercase tracking-wider ${
                isDark ? 'text-slate-500' : 'text-muted-foreground'
              }`}
            >
              {t('dataFlow.heading')}
            </h3>
          </AnimateOnScroll>
          <div className="space-y-6">
            {/* Connected mode flow */}
            <AnimateOnScroll delay={300} variant="fade-left">
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
                <span
                  className={`w-full sm:w-36 flex-shrink-0 text-xs font-semibold text-primary text-center sm:text-right`}
                >
                  {t('connected.title')}
                </span>
                <div className="flex-1 flex justify-center">
                  <DataFlow steps={connectedFlowSteps} dark={isDark} />
                </div>
              </div>
            </AnimateOnScroll>
            {/* Divider */}
            <hr className={`border-t ${isDark ? 'border-slate-800' : 'border-border'}`} />
            {/* Privacy-preserving flow */}
            <AnimateOnScroll delay={400} variant="fade-right">
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
                <span className="w-full sm:w-36 flex-shrink-0 text-xs font-semibold text-success text-center sm:text-right">
                  {t('privacyPreserving.title')}
                </span>
                <div className="flex-1 flex justify-center">
                  <DataFlow steps={ppFlowSteps} dark={isDark} />
                </div>
              </div>
            </AnimateOnScroll>
          </div>
        </div>
      )}
    </SectionLayout>
  );
}
