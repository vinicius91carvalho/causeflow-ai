/**
 * True only when the app is deployed to the staging environment.
 * NEXT_PUBLIC_DEPLOYMENT_STAGE is injected by SST at deploy time.
 * In local dev this var is unset, so this evaluates to false.
 */
export const isStaging = process.env.NEXT_PUBLIC_DEPLOYMENT_STAGE === 'staging';
