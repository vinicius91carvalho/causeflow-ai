'use client';

import { useTheme } from '@causeflow/ui/themes/provider';
import { ptBR } from '@clerk/localizations';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { useLocale } from 'next-intl';

/**
 * ClerkProvider wrapper with CauseFlow theme integration.
 *
 * Strategy: Uses Clerk's official `dark` base theme when the app is in dark
 * mode. This handles all internal Clerk CSS-in-JS styles (cards, popovers,
 * modals, footers) natively — no CSS `!important` overrides needed.
 *
 * Additional fine-tuning via clerk-overrides.css for CauseFlow-specific colors.
 */

const sharedVariables = {
  colorDanger: '#DC2626',
  colorSuccess: '#16A34A',
  borderRadius: '0.75rem',
  fontFamily: 'var(--font-jakarta), system-ui, sans-serif',
};

/** Shared element overrides applied in both light and dark modes */
const sharedElements: React.ComponentProps<typeof ClerkProvider>['appearance']['elements'] = {
  organizationSwitcherPopoverActionButton__createOrganization: { display: 'none' },
  /* Ensure org logo PNGs render with transparent backgrounds */
  avatarBox: { backgroundColor: 'transparent' },
  avatarImage: { backgroundColor: 'transparent', objectFit: 'contain' as const },
  organizationPreviewAvatarBox: { backgroundColor: 'transparent' },
  organizationPreviewAvatarImage: { backgroundColor: 'transparent', objectFit: 'contain' as const },
  /* OTP field centering — container must be full-width and centered */
  otpCodeField: {
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
  },
  otpCodeFieldInput: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center' as const,
    fontSize: '1.25rem',
    fontWeight: 600,
  },
};

const lightAppearance: React.ComponentProps<typeof ClerkProvider>['appearance'] = {
  variables: {
    ...sharedVariables,
    colorPrimary: 'hsl(232 50% 18%)',
    colorPrimaryForeground: 'hsl(0 0% 98%)',
    colorBackground: 'hsl(230 20% 97%)',
    colorInputBackground: 'hsl(230 18% 95%)',
    colorInputText: 'hsl(232 45% 10%)',
    colorText: 'hsl(232 45% 10%)',
    colorForeground: 'hsl(232 45% 10%)',
    colorTextSecondary: 'hsl(232 12% 44%)',
    colorMutedForeground: 'hsl(232 12% 44%)',
  },
  elements: {
    ...sharedElements,
  },
};

/**
 * Dark appearance aligned with CauseFlow's "original" dark theme tokens:
 *   --background:  232 35% 6%   (deep indigo near-black)
 *   --card:        232 30% 10%  (slightly lighter indigo)
 *   --foreground:  210 40% 96%  (light blue-white)
 *   --primary:     172 66% 50%  (electric teal)
 *   --muted-fg:    232 12% 68%  (medium gray)
 *   --border:      232 25% 18%  (dark blue-gray)
 *   --input:       232 25% 18%
 */
const darkAppearance: React.ComponentProps<typeof ClerkProvider>['appearance'] = {
  baseTheme: dark,
  variables: {
    ...sharedVariables,
    colorPrimary: 'hsl(172 66% 50%)',
    colorPrimaryForeground: 'hsl(232 35% 6%)',
    colorBackground: 'hsl(232 30% 10%)',
    colorInputBackground: 'hsl(232 25% 16%)',
    colorInputText: 'hsl(210 40% 96%)',
    colorText: 'hsl(210 40% 96%)',
    colorForeground: 'hsl(210 40% 96%)',
    colorTextSecondary: 'hsl(232 12% 68%)',
    colorMutedForeground: 'hsl(232 12% 68%)',
    colorNeutral: 'hsl(210 40% 96%)',
  },
  elements: {
    ...sharedElements,
    card: {
      backgroundColor: 'hsl(232 30% 10%)',
      borderColor: 'hsl(232 25% 18%)',
    },
    footer: {
      backgroundColor: 'hsl(232 30% 10%)',
    },
    formButtonPrimary: {
      backgroundColor: 'hsl(172 66% 50%)',
      color: 'hsl(232 35% 6%)',
    },
    socialButtonsBlockButton: {
      backgroundColor: 'hsl(232 25% 16%)',
      borderColor: 'hsl(232 25% 18%)',
    },
    navbarButton: {
      color: 'hsl(210 40% 96%)',
    },
    profileSectionContent: {
      borderColor: 'hsl(232 25% 18%)',
    },
    formFieldInput: {
      backgroundColor: 'hsl(232 25% 16%)',
      borderColor: 'hsl(232 25% 18%)',
      color: 'hsl(210 40% 96%)',
    },
    otpCodeFieldInput: {
      backgroundColor: 'hsl(232 25% 16%)',
      borderColor: 'hsl(232 25% 18%)',
      color: 'hsl(210 40% 96%)',
    },
  },
};

const CLERK_LOCALIZATIONS: Record<string, typeof ptBR | undefined> = {
  'pt-br': ptBR,
};

export function ClerkThemeProvider({ children }: { children: React.ReactNode }) {
  const { resolvedColorMode } = useTheme();
  const locale = useLocale();
  const appearance = resolvedColorMode === 'dark' ? darkAppearance : lightAppearance;
  const localization = CLERK_LOCALIZATIONS[locale];

  return (
    <ClerkProvider
      appearance={appearance}
      localization={localization}
      signInUrl="/auth/sign-in"
      signUpUrl="/auth/sign-up"
      afterSignOutUrl="/auth/sign-in"
    >
      {children}
    </ClerkProvider>
  );
}
