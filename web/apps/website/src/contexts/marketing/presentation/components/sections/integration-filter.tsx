'use client';

import type { Integration } from '@causeflow/shared/types';
import { cn } from '@causeflow/ui/lib';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@causeflow/ui/primitives';
import Image from 'next/image';
import { publicAsset } from '@/lib/public-asset';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { IntegrationCard } from './integration-card';

const INTEGRATION_ICONS: Record<string, ReactNode> = {
  slack: (
    <Image
      src={publicAsset('/icons/integrations/slack.svg')}
      alt="Slack"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  github: (
    <Image
      src={publicAsset('/icons/integrations/github.svg')}
      alt="GitHub"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  jira: (
    <Image
      src={publicAsset('/icons/integrations/jira.svg')}
      alt="Jira"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  'aws-cloudwatch': (
    <Image
      src={publicAsset('/icons/integrations/aws-cloudwatch.svg')}
      alt="AWS CloudWatch"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  hubspot: (
    <Image
      src={publicAsset('/icons/integrations/hubspot.svg')}
      alt="HubSpot"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  trello: (
    <Image
      src={publicAsset('/icons/integrations/trello.svg')}
      alt="Trello"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  'postgresql-mysql': (
    <Image
      src={publicAsset('/icons/integrations/postgresql.svg')}
      alt="PostgreSQL"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  linear: (
    <Image
      src={publicAsset('/icons/integrations/linear.svg')}
      alt="Linear"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  sentry: (
    <Image
      src={publicAsset('/icons/integrations/sentry.svg')}
      alt="Sentry"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  mongodb: (
    <Image
      src={publicAsset('/icons/integrations/mongodb.svg')}
      alt="MongoDB"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  datadog: (
    <Image
      src={publicAsset('/icons/integrations/datadog.svg')}
      alt="Datadog"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  pagerduty: (
    <Image
      src={publicAsset('/icons/integrations/pagerduty.svg')}
      alt="PagerDuty"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  grafana: (
    <Image
      src={publicAsset('/icons/integrations/grafana.svg')}
      alt="Grafana"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  confluence: (
    <Image
      src={publicAsset('/icons/integrations/confluence.svg')}
      alt="Confluence"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  notion: (
    <Image
      src={publicAsset('/icons/integrations/notion.svg')}
      alt="Notion"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  shortcut: (
    <Image
      src={publicAsset('/icons/integrations/shortcut.svg')}
      alt="Shortcut"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  gitlab: (
    <Image
      src={publicAsset('/icons/integrations/gitlab.svg')}
      alt="GitLab"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  bitbucket: (
    <Image
      src={publicAsset('/icons/integrations/bitbucket.svg')}
      alt="Bitbucket"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  'microsoft-teams': (
    <Image
      src={publicAsset('/icons/integrations/microsoft-teams.svg')}
      alt="Microsoft Teams"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  discord: (
    <Image
      src={publicAsset('/icons/integrations/discord.svg')}
      alt="Discord"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  'new-relic': (
    <Image
      src={publicAsset('/icons/integrations/new-relic.svg')}
      alt="New Relic"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  opsgenie: (
    <Image
      src={publicAsset('/icons/integrations/opsgenie.svg')}
      alt="Opsgenie"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  splunk: (
    <Image
      src={publicAsset('/icons/integrations/splunk.svg')}
      alt="Splunk"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  asana: (
    <Image
      src={publicAsset('/icons/integrations/asana.svg')}
      alt="Asana"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  servicenow: (
    <Image
      src={publicAsset('/icons/integrations/servicenow.svg')}
      alt="ServiceNow"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  'google-docs': (
    <Image
      src={publicAsset('/icons/integrations/google-docs.svg')}
      alt="Google Docs"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  salesforce: (
    <Image
      src={publicAsset('/icons/integrations/salesforce.svg')}
      alt="Salesforce"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  zendesk: (
    <Image
      src={publicAsset('/icons/integrations/zendesk.svg')}
      alt="Zendesk"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  intercom: (
    <Image
      src={publicAsset('/icons/integrations/intercom.svg')}
      alt="Intercom"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  postgresql: (
    <Image
      src={publicAsset('/icons/integrations/postgresql.svg')}
      alt="PostgreSQL"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  mysql: (
    <Image
      src={publicAsset('/icons/integrations/mysql.svg')}
      alt="MySQL"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  'google-cloud': (
    <Image
      src={publicAsset('/icons/integrations/google-cloud.svg')}
      alt="Google Cloud"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  azure: (
    <Image
      src={publicAsset('/icons/integrations/azure.svg')}
      alt="Azure"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  kubernetes: (
    <Image
      src={publicAsset('/icons/integrations/kubernetes.svg')}
      alt="Kubernetes"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  aws: (
    <Image src={publicAsset('/icons/integrations/aws.svg')} alt="AWS" className="h-7 w-7" width={28} height={28} />
  ),
  'github-actions': (
    <Image
      src={publicAsset('/icons/integrations/github-actions.svg')}
      alt="GitHub Actions"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  circleci: (
    <Image
      src={publicAsset('/icons/integrations/circleci.svg')}
      alt="CircleCI"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  jenkins: (
    <Image
      src={publicAsset('/icons/integrations/jenkins.svg')}
      alt="Jenkins"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  argocd: (
    <Image
      src={publicAsset('/icons/integrations/argocd.svg')}
      alt="Argo CD"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  'rest-api': (
    <Image
      src={publicAsset('/icons/integrations/rest-api.svg')}
      alt="REST API"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  'custom-webhooks': (
    <Image
      src={publicAsset('/icons/integrations/custom-webhooks.svg')}
      alt="Custom Webhooks"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
  graphql: (
    <Image
      src={publicAsset('/icons/integrations/graphql.svg')}
      alt="GraphQL"
      className="h-7 w-7"
      width={28}
      height={28}
    />
  ),
};

const CATEGORIES = [
  'all',
  'monitoring',
  'communication',
  'code',
  'management',
  'knowledge',
  'crm',
  'database',
  'cloud',
  'ci-cd',
  'api',
] as const;

interface IntegrationFilterProps {
  integrations: Integration[];
  categoryLabels?: Record<string, string>;
  andMoreLabel?: string;
  andMoreDescription?: string;
  className?: string;
}

export function IntegrationFilter({
  integrations,
  categoryLabels,
  andMoreLabel,
  andMoreDescription,
  className,
}: IntegrationFilterProps) {
  const [category, setCategory] = useState<string>('all');
  const [animKey, setAnimKey] = useState(0);

  function handleCategoryChange(value: string) {
    setCategory(value);
    setAnimKey((k) => k + 1);
  }

  const filtered =
    category === 'all' ? integrations : integrations.filter((i) => i.category === category);

  return (
    <div className={cn('relative z-0 space-y-8', className)}>
      <Tabs value={category} onValueChange={handleCategoryChange}>
        <TabsList className="h-auto flex flex-wrap gap-1">
          {CATEGORIES.map((cat) => (
            <TabsTrigger key={cat} value={cat} className="capitalize">
              {categoryLabels?.[cat] || cat}
            </TabsTrigger>
          ))}
        </TabsList>
        {CATEGORIES.map((cat) => (
          <TabsContent
            key={cat}
            value={cat}
            forceMount
            className={cn(cat !== category && 'hidden')}
          >
            <div key={animKey} className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((integration, i) => (
                <div
                  key={integration.id}
                  className="animate-fade-in-up opacity-0"
                  style={{
                    animationDelay: `${i * 60}ms`,
                    animationFillMode: 'forwards',
                  }}
                >
                  <IntegrationCard
                    name={integration.name}
                    category={integration.category}
                    description={integration.description}
                    differentiator={integration.differentiator}
                    agentConnection={integration.agentConnection}
                    icon={INTEGRATION_ICONS[integration.id]}
                  />
                </div>
              ))}
              {/* "And more" card */}
              {andMoreLabel && (
                <div
                  className="animate-fade-in-up opacity-0"
                  style={{
                    animationDelay: `${filtered.length * 60}ms`,
                    animationFillMode: 'forwards',
                  }}
                >
                  <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/30 p-6 text-center transition-all duration-300 hover:border-primary/40 hover:bg-muted/50">
                    <div>
                      <p className="text-lg font-semibold text-muted-foreground">{andMoreLabel}</p>
                      {andMoreDescription && (
                        <p className="mt-1 text-sm text-muted-foreground/70">
                          {andMoreDescription}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
