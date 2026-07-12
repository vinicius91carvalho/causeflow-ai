import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';
export const TenantEntity = new Entity(
  {
    model: { entity: 'tenant', version: '1', service: 'causeflow' },
    attributes: {
      tenantId: { type: 'string', required: true },
      name: { type: 'string', required: true },
      slug: { type: 'string', required: true },
      ownerEmail: { type: 'string', required: true },
      plan: {
        type: ['free', 'starter', 'pro', 'business', 'enterprise'],
        required: true,
        default: 'starter',
      },
      status: {
        type: ['active', 'suspended', 'trial', 'cancelled'],
        required: true,
        default: 'active',
      },
      // Billing / Stripe
      renewDate: { type: 'string' },
      stripeCustomerId: { type: 'string' },
      stripeSubscriptionId: { type: 'string' },
      subscriptionStatus: { type: ['active', 'trialing', 'past_due', 'canceling', 'canceled'] },
      currentPeriodEnd: { type: 'string' },
      cancelAtPeriodEnd: { type: 'boolean', default: false },
      // Profile
      websiteUrl: { type: 'string' },
      teamSize: { type: ['1_5', '6_20', '21_50', '50plus'] },
      // Operational settings
      settings: {
        type: 'map',
        properties: {
          maxIncidentsPerMonth: { type: 'number' },
          autoRemediation: { type: 'boolean' },
          notificationChannels: { type: 'list', items: { type: 'string' } },
          chatProvider: { type: ['web_portal', 'slack', 'teams'] },
          widgetConfig: {
            type: 'map',
            properties: {
              enabled: { type: 'boolean' },
              allowedOrigins: { type: 'list', items: { type: 'string' } },
              customDomain: { type: 'string' },
              branding: {
                type: 'map',
                properties: {
                  primaryColor: { type: 'string' },
                  logoUrl: { type: 'string' },
                  headerText: { type: 'string' },
                  welcomeMessage: { type: 'string' },
                },
              },
              dataMasking: {
                type: 'map',
                properties: {
                  enabled: { type: 'boolean' },
                  rules: { type: 'any' },
                },
              },
              rateLimit: { type: 'number' },
              maxSessionMessages: { type: 'number' },
            },
          },
          slackConfig: {
            type: 'map',
            properties: {
              webhookUrl: { type: 'string' },
              channel: { type: 'string' },
              channelId: { type: 'string' },
              workspaceId: { type: 'string' },
              workspaceName: { type: 'string' },
              accessToken: { type: 'string' },
              installedAt: { type: 'string' },
              configurationUrl: { type: 'string' },
            },
          },
        },
      },
      // Denormalized from settings.widgetConfig.customDomain for GSI lookup
      customDomain: { type: 'string' },
      createdAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        readOnly: true,
      },
      updatedAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        watch: '*',
        set: () => new Date().toISOString(),
      },
    },
    indexes: {
      primary: { pk: { field: 'pk', composite: ['tenantId'] }, sk: { field: 'sk', composite: [] } },
      bySlug: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['slug'] },
        sk: { field: 'gsi1sk', composite: [] },
      },
      byOwner: {
        index: 'gsi2',
        pk: { field: 'gsi2pk', composite: ['ownerEmail'] },
        sk: { field: 'gsi2sk', composite: ['createdAt'] },
      },
      byCustomDomain: {
        index: 'gsi3',
        pk: { field: 'gsi3pk', composite: ['customDomain'] },
        sk: { field: 'gsi3sk', composite: [] },
      },
    },
  },
  { client: getDynamoClient(), table: TABLE_NAME },
);
