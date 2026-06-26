import { HeroSection } from './hero-section';

interface SecurityHeroSectionProps {
  title: string;
  subtitle: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
}

export function SecurityHeroSection({
  title,
  subtitle,
  primaryCtaLabel,
  primaryCtaHref,
  secondaryCtaLabel,
  secondaryCtaHref,
}: SecurityHeroSectionProps) {
  return (
    <HeroSection
      title={title}
      subtitle={subtitle}
      variant="dark"
      primaryCta={{ label: primaryCtaLabel, href: primaryCtaHref }}
      secondaryCta={{ label: secondaryCtaLabel, href: secondaryCtaHref }}
    />
  );
}
