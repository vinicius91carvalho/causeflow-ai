import { HeroSection } from './hero-section';

interface SecurityHeroSectionProps {
  title: string;
  subtitle: string;
  primaryCta: { label: string; href: string; external?: boolean };
  secondaryCta: { label: string; href: string; external?: boolean };
}

export function SecurityHeroSection({
  title,
  subtitle,
  primaryCta,
  secondaryCta,
}: SecurityHeroSectionProps) {
  return (
    <HeroSection
      title={title}
      subtitle={subtitle}
      variant="dark"
      primaryCta={primaryCta}
      secondaryCta={secondaryCta}
    />
  );
}
