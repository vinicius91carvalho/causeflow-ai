# Voice and Tone

Guidance for the copy that ships inside primitives, patterns, and feature components. This document describes the CauseFlow voice (who we are) and adjusts it by surface (how we speak in context).

Inferred from shipping product copy in `apps/website/src/contexts/marketing/infrastructure/i18n/en.json` and `apps/dashboard/src/contexts/onboarding/infrastructure/i18n/en.json`.

## Who We Write For

Engineering teams of 2–50 engineers: SREs, platform engineers, backend leads, support engineers who handle L2/L3 escalations. Our readers are technical, time-poor, and skeptical of marketing language. They trust concrete numbers and exact commands; they disengage at vague superlatives.

## Overall Voice

**Direct, pragmatic, grounded in specifics. No hype.**

Five voice traits the copy must embody:

1. **Specific over superlative.** "Root cause identified in ~3 minutes" — not "blazingly fast investigation."
2. **Honest about trade-offs.** "Lower confidence: contradicting signals — CauseFlow flags the uncertainty." We surface when we're not sure.
3. **Technical but not jargon-heavy.** Name the real systems (`max_connections`, `connection pool exhaustion`) but explain the *consequence*, not just the mechanism.
4. **Calm, not alarmist.** Incidents are already stressful. Our copy reduces the stress level, not raises it.
5. **Action over narration.** "Tap Approve — and the fix executes." Short verbs, active voice, next step obvious.

The voice never changes. The tone adjusts by surface.

## Tone by Surface

### Marketing (website)

Confident but measured. Leads with outcomes and numbers. Uses short, declarative headlines. Pairs every strong claim with a timestamp, percentage, or source citation.

Headline pattern we use: one benefit-led sentence + one proof sentence.

> "Investigate production incidents in minutes, not hours. Most incident resolution time is investigation, not fixing. CauseFlow deploys 6 specialized AI agents in parallel — root cause identified in ~3 minutes, end-to-end resolution in ~35 minutes vs. 2–4 hours manual."

Avoid: "revolutionary", "best-in-class", "cutting-edge", "leverage", "unlock", "empower", "supercharge", emoji, exclamation marks.

### Dashboard (authenticated product)

Direct and functional. Assumes the user knows what they came to do. Uses imperative verbs on buttons and task-oriented microcopy. Shares state, not motivation.

Onboarding example — welcoming but gets straight to the work:

> "Welcome, Detective. Your AI-powered command center is fully operational. This quick tour will walk you through the key systems — from connecting your evidence sources to opening your first investigation. It only takes a minute."

Button labels are short and verbs-first: `Connect`, `Authorize`, `Continue`, `Skip for now`, `Let's Go`, `Get Started`.

### Empty states

Explain *what this surface is for*, *why it's empty right now*, and *the one action that changes it*. Never just "No data".

> "No investigations yet. Create an investigation from an incident in Slack, a Jira card, or click **Start Investigation** above."

### Error states

State the problem in plain language, what it means for the user, and the next step. Do not blame the user. Never expose stack traces to end users.

Shipping examples:

> "Failed to load the business profile form. Please try again."
> "Failed to save your profile. Please try again."
> "Profile saved, but AI memory sync failed. You can resync from Settings."

The third example is the template: *what succeeded, what failed, recovery path*. Prefer that structure whenever a partial failure is possible.

### Status / streaming

When the UI reflects a live process (investigation in progress, integrations syncing), use progress-oriented language with a sense of motion.

> "Investigating..." · "Cross-referencing data..." · "{count} of {total} connected"

### Legal, security, billing

Neutral, precise, boring — in a good way. This is the one place superlatives are banned entirely. State the commitment, state the boundary.

> "The agent reads data only during investigation, then discards it."
> "Each tenant has individual KMS encryption via AWS."
> "The agent never writes without explicit approval (human-in-the-loop)."

## Copy Mechanics

- **Sentence case** for all UI (buttons, headings, labels, menu items). Title Case is reserved for proper nouns and page titles on the marketing site.
- **Oxford comma.** Always. "logs, metrics, and events."
- **Numerals over words** for quantities ≥ 2. "6 agents", "2–4 hours", "~35 minutes". Spell out zero and one in prose ("no external training").
- **Time formats:** relative when recency matters ("2 minutes ago"), absolute when auditability matters ("2026-02-12 04:07 AM").
- **Approximations** use the tilde (`~3 minutes`), not "around" or "about".
- **No exclamation marks** outside explicit celebration moments (first investigation completed). None in marketing headlines.
- **No emoji in UI.** Reserve for Slack surfaces where the tone norm is different.
- **Never "please"** on primary CTAs. It weakens the verb. OK inside secondary messaging ("Please try again").

## Do / Don't — 5 Pairs

Based on real product copy.

1. **Do** lead with the outcome, then the mechanism.
   > "Root cause identified in ~3 minutes."

   **Don't** front-load the mechanism.
   > "Using a 6-agent parallel investigation architecture with specialized sub-agents..."

2. **Do** quantify everything that is quantifiable, with a source.
   > "Incidents per PR are up 23.5% year-over-year. (CodeRabbit, Dec 2025)"

   **Don't** make unquantified claims.
   > "Incidents are rising rapidly across the industry."

3. **Do** describe failure modes honestly.
   > "No GitHub? Code analysis is skipped — not broken."

   **Don't** hand-wave around missing integrations.
   > "CauseFlow works seamlessly with any setup."

4. **Do** describe what the agent *will* do and ask for approval before it happens.
   > "CauseFlow proposes: 'Revert config max_connections from 50 to 200. This will restart 3 service tasks.' Tap Approve — and the fix executes. Nothing runs without your explicit approval."

   **Don't** narrate the agent's autonomy as a flex.
   > "Our AI autonomously remediates issues without human intervention."

5. **Do** write error messages as if the user is busy and stressed.
   > "Failed to save your profile. Please try again."

   **Don't** leak internals or blame the user.
   > "Error 500: UpdateProfileCommand handler threw an uncaught exception. Invalid input: please check your fields and ensure they are correctly formatted before retrying."

## When in Doubt

Open the marketing `en.json` or the onboarding `en.json` and match the tone of the nearest existing string. Those files are the living style guide — if a new string feels out of place next to its neighbours, rewrite it.
