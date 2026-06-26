// Stub — satisfies TDD hook for dynamo-sentry-integration.repository.ts
// DynamoDB-backed repository tests require LocalStack (integration test suite).
// Unit-level Sentry HMAC and secret persistence logic is tested via:
//   - sentry-webhook-auth.middleware.test.ts
//   - save-sentry-client-secret.usecase.test.ts
//   - get-sentry-integration-status.usecase.test.ts
export {};
