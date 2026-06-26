import { LegalPageLayout, PageLayout } from '@causeflow/ui/layouts';
import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import { Footer } from '@/contexts/shell/presentation/components/navigation/footer';
import { Header } from '@/contexts/shell/presentation/components/navigation/header';
import { generatePageMetadata } from '@/lib/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'privacy' });

  return generatePageMetadata({
    title: t('title'),
    description: t('subtitle'),
    path: '/privacy',
    locale,
  });
}

export default function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);

  const t = useTranslations('privacy');

  return (
    <PageLayout header={<Header />} footer={<Footer />}>
      <LegalPageLayout title={t('title')} lastUpdated={t('lastUpdated')}>
        {/* 1. Data Collection */}
        <h2>{t('sections.dataCollected')}</h2>
        <p>CauseFlow AI collects the following categories of personal and non-personal data:</p>
        <ul>
          <li>
            <strong>Account information:</strong> Full name, work email address, company name, and
            team size provided during registration.
          </li>
          <li>
            <strong>Usage data:</strong> Pages visited, features used, investigation frequency,
            integration configurations, and session duration.
          </li>
          <li>
            <strong>Technical data:</strong> Browser type, operating system, IP address, device
            identifiers, and referral URLs.
          </li>
          <li>
            <strong>Communication data:</strong> Messages sent through support channels and feedback
            submissions.
          </li>
        </ul>

        {/* 2. How We Use Data */}
        <h2>{t('sections.howWeUse')}</h2>
        <p>We use the collected data for the following purposes:</p>
        <ul>
          <li>
            <strong>Service operation:</strong> To provide, maintain, and improve the CauseFlow AI
            platform, including incident investigation, root cause analysis, and report generation.
          </li>
          <li>
            <strong>Communication:</strong> To send transactional emails (investigation reports,
            account notifications), and with your consent, marketing communications about new
            features and product updates.
          </li>
          <li>
            <strong>Analytics:</strong> To understand usage patterns and improve the user
            experience. We use Google Analytics 4 and Microsoft Clarity for anonymized behavioral
            analytics.
          </li>
          <li>
            <strong>Security:</strong> To detect, prevent, and respond to fraud, abuse, or security
            incidents.
          </li>
        </ul>

        {/* 3. Customer Data During Investigations */}
        <h2>{t('sections.customerData')}</h2>
        <p>
          During incident investigations, CauseFlow AI accesses customer data from connected
          integrations (Slack, GitHub, Jira, CloudWatch, HubSpot, databases). This data is handled
          under strict security protocols:
        </p>
        <ul>
          <li>
            <strong>Read on demand:</strong> The AI agent reads data only during active
            investigations. Data is accessed in real-time, analyzed in-memory, and discarded
            immediately after the investigation concludes.
          </li>
          <li>
            <strong>No persistence:</strong> Raw customer data from integrations is never stored on
            our servers. Only the investigation report (root cause, timeline, recommendations) is
            retained.
          </li>
          <li>
            <strong>Never used for training:</strong> Customer data is never used to train,
            fine-tune, or improve AI models for other customers or third parties. Each tenant&apos;s
            data is strictly isolated.
          </li>
          <li>
            <strong>PII redaction:</strong> Sensitive data such as emails, phone numbers, social
            security numbers, and payment card numbers are automatically detected and anonymized
            using a PII detection engine before AI processing.
          </li>
        </ul>

        {/* 4. Data Sharing */}
        <h2>{t('sections.sharing')}</h2>
        <p>
          CauseFlow AI does not sell, rent, or share your personal data with third parties for
          marketing purposes. We share data only in the following limited circumstances:
        </p>
        <ul>
          <li>
            <strong>AWS Bedrock (LLM provider):</strong> Investigation data is sent to AWS Bedrock
            for AI processing under strict contractual terms. AWS does not use customer data to
            train models, and model providers have zero access to prompts or completions. AWS
            Bedrock holds ISO/IEC 42001 certification.
          </li>
          <li>
            <strong>Service providers:</strong> We use essential infrastructure providers (AWS for
            hosting, Stripe for payments, Loops for email communications) under data processing
            agreements that prohibit use of data for any purpose other than providing their
            services.
          </li>
          <li>
            <strong>Legal obligations:</strong> We may disclose data when required by law,
            regulation, legal process, or governmental request.
          </li>
        </ul>

        {/* 5. Data Retention */}
        <h2>{t('sections.retention')}</h2>
        <ul>
          <li>
            <strong>Account data:</strong> Retained for the duration of your active account. Upon
            account deletion, all personal data is purged within 30 days, except where retention is
            required by law.
          </li>
          <li>
            <strong>Investigation audit trails:</strong> Retained according to your plan and
            contractual terms. Audit trails are stored in immutable S3 Object Lock (WORM) storage.
            Enterprise customers can configure custom retention periods.
          </li>
          <li>
            <strong>Analytics data:</strong> Anonymized usage data may be retained indefinitely for
            aggregate statistical analysis.
          </li>
        </ul>

        {/* 6. LGPD Rights */}
        <h2>{t('sections.lgpdRights')}</h2>
        <p>
          If you are located in Brazil, you are entitled to the following rights under the Lei Geral
          de Prote&ccedil;&atilde;o de Dados (LGPD):
        </p>
        <ul>
          <li>
            <strong>Right of access:</strong> Obtain confirmation of the existence of processing and
            access to your personal data.
          </li>
          <li>
            <strong>Right of correction:</strong> Request correction of incomplete, inaccurate, or
            outdated data.
          </li>
          <li>
            <strong>Right of deletion:</strong> Request deletion of personal data processed with
            your consent or in excess of the purpose.
          </li>
          <li>
            <strong>Right of portability:</strong> Request transfer of your personal data to another
            service provider in a structured, commonly used format.
          </li>
          <li>
            <strong>Right to information:</strong> Be informed about third parties with whom your
            data is shared.
          </li>
          <li>
            <strong>Right to revoke consent:</strong> Revoke your consent at any time, without
            affecting the lawfulness of processing performed prior to revocation.
          </li>
        </ul>
        <p>
          We will fulfill all LGPD data subject requests within <strong>15 calendar days</strong>.
          Breach notifications will be sent to the ANPD and affected data subjects within 72 hours
          of detection.
        </p>

        {/* 7. GDPR Rights */}
        <h2>{t('sections.gdprRights')}</h2>
        <p>
          If you are located in the European Economic Area (EEA) or the United Kingdom, you are
          entitled to the following rights under the General Data Protection Regulation (GDPR):
        </p>
        <ul>
          <li>
            <strong>Right of access:</strong> Request a copy of the personal data we hold about you.
          </li>
          <li>
            <strong>Right of rectification:</strong> Request correction of inaccurate or incomplete
            personal data.
          </li>
          <li>
            <strong>Right of erasure:</strong> Request deletion of your personal data where there is
            no compelling reason for continued processing.
          </li>
          <li>
            <strong>Right of portability:</strong> Receive your personal data in a structured,
            machine-readable format.
          </li>
          <li>
            <strong>Right to object:</strong> Object to processing of your personal data for direct
            marketing or based on legitimate interests.
          </li>
          <li>
            <strong>Right to restrict processing:</strong> Request restriction of processing while
            we verify accuracy or assess an objection.
          </li>
          <li>
            <strong>Right to automated decision review:</strong> Request human review of any
            decisions made solely through automated processing that significantly affect you.
          </li>
        </ul>
        <p>
          We will respond to all GDPR data subject requests within <strong>30 calendar days</strong>
          . Data breach notifications will be submitted to the relevant supervisory authority within
          72 hours of detection.
        </p>

        {/* 8. International Transfers */}
        <h2>{t('sections.internationalTransfers')}</h2>
        <p>
          CauseFlow AI processes data primarily on AWS infrastructure in the United States. For
          transfers of personal data from the EEA, UK, or Brazil to third countries, we rely on:
        </p>
        <ul>
          <li>
            <strong>Standard Contractual Clauses (SCCs):</strong> We use the European
            Commission&apos;s Standard Contractual Clauses as the legal mechanism for cross-border
            data transfers, ensuring adequate protection regardless of destination.
          </li>
          <li>
            <strong>Supplementary measures:</strong> Encryption in transit (TLS 1.3) and at rest
            (AES-256 via KMS per-tenant), access controls, and regular security assessments.
          </li>
        </ul>

        {/* 9. DPO Contact */}
        <h2>{t('sections.contact')}</h2>
        <p>
          For any privacy-related questions, data subject requests, or concerns, please contact our
          Data Protection Officer:
        </p>
        <ul>
          <li>
            <strong>Email:</strong> privacy@causeflow.ai
          </li>
          <li>
            <strong>Address:</strong> CauseFlow AI, Data Protection Officer
          </li>
        </ul>
        <p>
          We are committed to resolving any complaints about our collection or use of your personal
          data. If you believe we have not adequately addressed your concern, you have the right to
          lodge a complaint with your local data protection authority.
        </p>
      </LegalPageLayout>
    </PageLayout>
  );
}
