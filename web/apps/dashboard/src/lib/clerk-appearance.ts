/**
 * Clerk appearance configuration — Cleric Design System theme.
 *
 * Maps CauseFlow cleric theme tokens to Clerk's `appearance` prop so that
 * hosted Clerk UI surfaces (sign-in, sign-up, user-profile) inherit the
 * same color palette as the dashboard.
 *
 * HSL values sourced from:
 *   packages/ui/src/themes/cleric/tokens/light.css  (light mode)
 *   packages/ui/src/themes/cleric/tokens/dark.css   (dark mode)
 *
 * Clerk requires hex or hsl() strings — not bare channel values.
 * Light-mode values are used as baseline; Clerk adapts its own dark variant.
 *
 * @see https://clerk.com/docs/customization/overview
 */

import type { ClerkProvider } from '@clerk/nextjs';

type ClerkAppearance = React.ComponentProps<typeof ClerkProvider>['appearance'];

/** Light-mode cleric token values as hsl() strings. */
const CLERIC_LIGHT = {
  /** Primary — Deep Indigo: hsl(232 50% 18%) */
  primary: 'hsl(232, 50%, 18%)',
  /** Background: hsl(230 18% 95%) */
  background: 'hsl(230, 18%, 95%)',
  /** Card surface: hsl(230 20% 97%) */
  card: 'hsl(230, 20%, 97%)',
  /** Foreground text: hsl(232 45% 10%) */
  text: 'hsl(232, 45%, 10%)',
  /** Muted foreground: hsl(232 12% 44%) */
  textSecondary: 'hsl(232, 12%, 44%)',
  /** Destructive: hsl(0 72% 51%) */
  danger: 'hsl(0, 72%, 51%)',
  /** Success: hsl(160 84% 39%) */
  success: 'hsl(160, 84%, 39%)',
  /** Warning: hsl(23 90% 52%) */
  warning: 'hsl(23, 90%, 52%)',
  /** Border: hsl(230 15% 87%) */
  border: 'hsl(230, 15%, 87%)',
  /** Ring / Accent — Electric Teal: hsl(172 66% 30%) */
  ring: 'hsl(172, 66%, 30%)',
};

/**
 * Clerk `appearance` object for ClerkProvider.
 * Apply via: <ClerkProvider appearance={clerkAppearance}>
 */
export const clerkAppearance: ClerkAppearance = {
  variables: {
    colorPrimary: CLERIC_LIGHT.primary,
    colorBackground: CLERIC_LIGHT.background,
    colorText: CLERIC_LIGHT.text,
    colorTextSecondary: CLERIC_LIGHT.textSecondary,
    colorDanger: CLERIC_LIGHT.danger,
    colorSuccess: CLERIC_LIGHT.success,
    colorWarning: CLERIC_LIGHT.warning,
    colorInputBackground: CLERIC_LIGHT.card,
    colorInputText: CLERIC_LIGHT.text,
    borderRadius: '0.625rem',
    fontFamily: 'Space Grotesk, Inter, system-ui, sans-serif',
  },
  elements: {
    card: {
      boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
    },
    formButtonPrimary: {
      backgroundColor: CLERIC_LIGHT.primary,
      '&:hover': {
        backgroundColor: CLERIC_LIGHT.primary,
        opacity: 0.9,
      },
    },
    footerActionLink: {
      color: CLERIC_LIGHT.ring,
    },
    identityPreviewEditButton: {
      color: CLERIC_LIGHT.ring,
    },
  },
};
