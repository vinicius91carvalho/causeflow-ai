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
  const t = await getTranslations({ locale, namespace: 'terms' });

  return generatePageMetadata({
    title: t('title'),
    description: t('subtitle'),
    path: '/terms',
    locale,
  });
}

export default function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);

  const t = useTranslations('terms');

  return (
    <PageLayout header={<Header />} footer={<Footer />}>
      <LegalPageLayout title={t('title')} lastUpdated={t('lastUpdated')}>
        <p className="text-sm text-muted-foreground">
          {t('version', { version: 'v2026.03.06' })} &mdash;{' '}
          {t('effectiveDate', { date: 'March 6, 2026' })}
        </p>

        <p>
          Welcome to CauseFlow AI. By accessing or using our platform, you agree to be bound by
          these Terms of Service. If you do not agree with any part of these terms, you may not use
          the service.
        </p>

        {/* 1. Service Definition and Limitations */}
        <h2>{t('sections.serviceDefinition')}</h2>
        <p>
          CauseFlow AI is an AI-powered incident investigation platform that connects to your
          engineering and business tools to perform automated root cause analysis, generate
          investigation reports, and recommend remediation actions.
        </p>
        <ul>
          <li>
            <strong>Service scope:</strong> CauseFlow AI provides automated investigation and
            analysis. Results are probabilistic and should be reviewed by qualified engineers before
            taking action. CauseFlow AI does not replace human judgment.
          </li>
          <li>
            <strong>Availability:</strong> We aim to maintain high availability but do not guarantee
            uninterrupted access. Planned maintenance windows will be communicated in advance.
            Unplanned outages will be addressed promptly and communicated via our status page.
          </li>
          <li>
            <strong>AI limitations:</strong> Investigation results include a confidence score
            (0-100%). Results with lower confidence scores should be treated as hypotheses requiring
            manual verification. The AI agent operates in read-only mode by default and will never
            execute remediation actions without explicit human approval.
          </li>
        </ul>

        {/* 2. Plans, Pricing and Billing */}
        <h2>{t('sections.plansAndBilling')}</h2>
        <ul>
          <li>
            <strong>Starter plan ($99/month):</strong> 15 investigations included per month. All
            integrations included. Overage investigations billed at $8.99 each.
          </li>
          <li>
            <strong>Pro plan ($349/month):</strong> 60 investigations included per month. All
            integrations included. Overage investigations billed at $8.99 each.
          </li>
          <li>
            <strong>Business plan ($899/month):</strong> 200 investigations included per month. All
            integrations included. 99.5% uptime SLA. Overage investigations billed at $8.99 each.
          </li>
          <li>
            <strong>Enterprise plan (custom):</strong> Custom investigation volume and pricing.
            Custom SLA terms. Contact us at sales@causeflow.ai.
          </li>
          <li>
            <strong>All paid plans:</strong> Billed monthly or annually. Upgrades take effect
            immediately; downgrades take effect at the start of the next billing cycle.
          </li>
          <li>
            <strong>Billing cycle:</strong> Paid plans are billed at the beginning of each billing
            period. Upgrades take effect immediately; downgrades take effect at the start of the
            next billing cycle.
          </li>
          <li>
            <strong>Pre-paid credits:</strong> Available with progressive discounts of 10-20%
            depending on volume. Credits expire 12 months from date of purchase.
          </li>
          <li>
            <strong>Price changes:</strong> We will provide at least 30 days&apos; notice before any
            price increase. Existing prepaid credits are honored at the original rate.
          </li>
          <li>
            <strong>Taxes:</strong> All prices are exclusive of applicable taxes. You are
            responsible for all taxes associated with your use of the service.
          </li>
        </ul>

        {/* 3. Intellectual Property */}
        <h2>{t('sections.intellectualProperty')}</h2>
        <ul>
          <li>
            <strong>CauseFlow AI platform:</strong> All rights, title, and interest in the CauseFlow
            AI platform, including its software, algorithms, user interface, documentation, and
            trademarks, are owned exclusively by CauseFlow AI. No license or right is granted except
            as expressly stated in these terms.
          </li>
          <li>
            <strong>Customer data:</strong> You retain all ownership rights to your data. CauseFlow
            AI does not claim any intellectual property rights over the data you provide or that is
            accessed through your connected integrations. Investigation reports generated by
            CauseFlow AI based on your data are considered derivative works and are owned by you.
          </li>
          <li>
            <strong>Feedback:</strong> If you provide suggestions, feature requests, or other
            feedback about the service, we may use this feedback without obligation to you.
          </li>
        </ul>

        {/* 4. Service Level Agreement */}
        <h2>{t('sections.sla')}</h2>
        <p>Service Level Agreements are available for Business and Enterprise plan customers:</p>
        <ul>
          <li>
            <strong>Business plan:</strong> 99.5% monthly uptime guarantee. Service credits of 10%
            of monthly fee for each 0.1% below the SLA target, up to a maximum of 30% of monthly
            fees.
          </li>
          <li>
            <strong>Enterprise plan:</strong> Custom SLA terms negotiated individually. Includes
            dedicated support channels, guaranteed response times, and custom service credit
            structures.
          </li>
          <li>
            <strong>Exclusions:</strong> SLA does not apply during scheduled maintenance, force
            majeure events, or outages caused by third-party services (AWS, integration providers).
          </li>
          <li>
            <strong>Claims:</strong> SLA credit claims must be submitted within 30 days of the
            incident. Claims require the incident date, duration, and affected investigation IDs.
          </li>
        </ul>

        {/* 5. Limitation of Liability */}
        <h2>{t('sections.liability')}</h2>
        <ul>
          <li>
            <strong>No warranty:</strong> CauseFlow AI is provided &quot;as is&quot; and &quot;as
            available&quot; without warranties of any kind, whether express or implied, including
            implied warranties of merchantability, fitness for a particular purpose, and
            non-infringement.
          </li>
          <li>
            <strong>Investigation results:</strong> CauseFlow AI does not guarantee the accuracy,
            completeness, or reliability of investigation results. Root cause analysis is
            probabilistic and should be independently verified before taking remediation actions.
          </li>
          <li>
            <strong>Liability cap:</strong> In no event shall CauseFlow AI&apos;s total aggregate
            liability exceed the amount paid by you for the service during the twelve (12) months
            preceding the event giving rise to the claim.
          </li>
          <li>
            <strong>Exclusion of damages:</strong> CauseFlow AI shall not be liable for any
            indirect, incidental, special, consequential, or punitive damages, including but not
            limited to loss of profits, data, business opportunities, or goodwill, regardless of the
            theory of liability.
          </li>
        </ul>

        {/* 6. Cancellation and Refund Policy */}
        <h2>{t('sections.cancellation')}</h2>
        <ul>
          <li>
            <strong>Cancellation:</strong> You may cancel your subscription at any time through your
            account settings. Cancellation takes effect at the end of the current billing period. No
            prorated refunds are provided for partial billing periods. Your account and data will be
            retained for 90 days after cancellation, after which they may be deleted.
          </li>
          <li>
            <strong>Annual subscriptions:</strong> Cancellation of annual plans is effective at the
            end of the annual term. Refunds for unused months are not provided unless required by
            applicable law.
          </li>
          <li>
            <strong>Data export:</strong> Upon cancellation, you may export your investigation
            reports and audit trails for up to 30 days. After this period, data will be permanently
            deleted in accordance with our Privacy Policy.
          </li>
          <li>
            <strong>Refund exceptions:</strong> Refunds may be issued at our discretion in cases of
            significant service disruption or billing errors. Contact support@causeflow.ai for
            refund requests.
          </li>
        </ul>

        {/* 7. Acceptable Use */}
        <h2>{t('sections.acceptableUse')}</h2>
        <p>You agree not to use CauseFlow AI for any of the following purposes:</p>
        <ul>
          <li>
            Attempting to gain unauthorized access to other customers&apos; data, accounts, or
            connected systems.
          </li>
          <li>
            Using the service to investigate, monitor, or surveil individuals without proper
            authorization and legal basis.
          </li>
          <li>
            Submitting malicious, fraudulent, or deliberately misleading investigation requests
            designed to extract information from connected systems beyond legitimate incident
            investigation purposes.
          </li>
          <li>
            Reverse engineering, decompiling, or attempting to extract the source code or algorithms
            of the CauseFlow AI platform.
          </li>
          <li>
            Using the service in a manner that violates any applicable law, regulation, or
            third-party rights.
          </li>
          <li>
            Reselling, sublicensing, or providing access to the service to third parties without
            written authorization.
          </li>
          <li>
            Interfering with or disrupting the integrity or performance of the service, including
            attempting to overwhelm the system with excessive API requests.
          </li>
        </ul>
        <p>
          Violation of these acceptable use terms may result in immediate suspension or termination
          of your account without prior notice or refund.
        </p>

        {/* 8. Data Collection & Usage */}
        <h2>{t('sections.dataCollection')}</h2>
        <p>
          CauseFlow AI&apos;s investigation agent connects to your engineering and business tools to
          collect data necessary for incident investigation and root cause analysis. This section
          explains what data is collected, how it is used, and the commitments we make regarding
          your data.
        </p>
        <ul>
          <li>
            <strong>Data collected:</strong> During incident investigations, CauseFlow AI may access
            and collect logs, metrics, traces, and configuration data from your connected
            integrations (e.g., AWS CloudWatch, Slack, GitHub, Jira, and other supported services).
            The specific data accessed depends on the integrations you have connected and the
            permissions you have granted.
          </li>
          <li>
            <strong>Purpose:</strong> All data collected is used exclusively for incident
            investigation and resolution. CauseFlow AI analyzes this data to identify root causes,
            generate investigation reports, and recommend remediation actions.
          </li>
          <li>
            <strong>Data handling:</strong> All data is encrypted in transit (TLS 1.2+) and at rest
            (AES-256 via AWS KMS). Data is retained according to your configured retention policy
            and is permanently deleted upon request or account termination.
          </li>
          <li>
            <strong>Our commitment:</strong> CauseFlow AI will not sell, share, or disclose your
            data to third parties. We will not use your data for training AI models, benchmarking,
            or any purpose beyond the contracted incident investigation service. Your data remains
            yours at all times.
          </li>
        </ul>

        {/* 9. Jurisdiction and Venue */}
        <h2>{t('sections.jurisdiction')}</h2>
        <ul>
          <li>
            <strong>Governing law:</strong> These Terms of Service shall be governed by and
            construed in accordance with the laws of the Federative Republic of Brazil, without
            regard to its conflict of law provisions.
          </li>
          <li>
            <strong>Dispute resolution:</strong> Any disputes arising out of or relating to these
            terms shall first be attempted to be resolved through good-faith negotiation between the
            parties for a period of 30 days.
          </li>
          <li>
            <strong>Arbitration:</strong> If negotiation fails, disputes shall be submitted to
            binding arbitration in accordance with the rules of the Brazilian Arbitration Chamber
            (CBMA). The arbitration shall be conducted in Portuguese or English, as agreed by the
            parties.
          </li>
          <li>
            <strong>Forum:</strong> For matters not subject to arbitration, the courts of S&atilde;o
            Paulo, Brazil, shall have exclusive jurisdiction.
          </li>
          <li>
            <strong>International customers:</strong> For customers located in the European Economic
            Area, you retain the right to bring claims in your local courts as required by
            applicable consumer protection law.
          </li>
        </ul>

        <hr />

        <p>
          If you have any questions about these Terms of Service, please contact us at{' '}
          <strong>legal@causeflow.ai</strong>.
        </p>
      </LegalPageLayout>
    </PageLayout>
  );
}
