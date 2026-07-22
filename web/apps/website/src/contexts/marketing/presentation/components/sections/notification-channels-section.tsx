import Image from 'next/image';
import { publicAsset } from '@/lib/public-asset';

/**
 * NotificationChannelsSection — "NOTIFICAÇÃO" section.
 * Three notification card previews (Slack, PagerDuty, Linear).
 */

interface NotifCard {
  icon: string;
  channel: string;
  sender: string;
  senderMeta?: string;
  title: string;
  body: string;
  actions?: { primary: string; secondary: string };
}

interface NotificationChannelsSectionProps {
  eyebrow: string;
  headline: { p1: string; em: string };
  lead: string;
  cards: NotifCard[];
}

const ICON_SRCS: Record<string, string> = {
  slack: publicAsset('/icons/integrations/slack.svg'),
  pagerduty: publicAsset('/icons/integrations/pagerduty.svg'),
  linear: publicAsset('/icons/integrations/linear.svg'),
};

export function NotificationChannelsSection({
  eyebrow,
  headline,
  lead,
  cards,
}: NotificationChannelsSectionProps) {
  return (
    <section className="bg-muted/20 px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Left: copy */}
          <div>
            <p className="font-mono text-[11.5px] font-bold uppercase tracking-[0.15em] text-accent">
              {eyebrow}
            </p>
            <h2
              className="mt-4 text-balance font-display font-normal tracking-[-0.03em] text-foreground"
              style={{ fontSize: 'clamp(2rem, 3vw + 0.8rem, 3.2rem)', lineHeight: 1.02 }}
            >
              <span>{headline.p1}</span>
              <br />
              <em className="not-italic font-medium text-accent">{headline.em}</em>
            </h2>
            <p className="mt-5 max-w-md text-pretty text-[17px] leading-[1.55] text-muted-foreground">
              {lead}
            </p>
          </div>

          {/* Right: notification cards */}
          <div className="space-y-4">
            {cards.map((card) => (
              <NotifCardBlock key={card.channel} card={card} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function NotifCardBlock({ card }: { card: NotifCard }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <Image
          src={ICON_SRCS[card.icon] ?? ICON_SRCS.slack!}
          alt=""
          aria-hidden="true"
          width={18}
          height={18}
          className="h-4 w-4"
        />
        <span className="text-sm font-semibold text-foreground">{card.channel}</span>
        <span
          className={`ml-auto text-xs ${card.senderMeta ? 'font-medium text-green-600' : 'text-muted-foreground'}`}
        >
          {card.sender}
          {card.senderMeta && <span className="ml-1 text-green-600">{card.senderMeta}</span>}
        </span>
      </div>

      {/* Title */}
      <p className="mb-1 text-sm font-semibold text-foreground">{card.title}</p>

      {/* Body */}
      <p className="text-xs leading-relaxed text-muted-foreground">{card.body}</p>

      {/* Actions */}
      {card.actions && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            {card.actions.primary}
          </button>
          <button
            type="button"
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted/50"
          >
            {card.actions.secondary}
          </button>
        </div>
      )}
    </div>
  );
}
