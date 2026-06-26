import { NextResponse } from 'next/server';
import { onboardingPatchSchema } from '../infrastructure/api-schema';
import { OnboardingRepository } from '../infrastructure/onboarding-repository';

/**
 * GET /api/onboarding/progress
 * Returns the current onboarding progress, or null if none exists.
 */
export async function GET(): Promise<NextResponse> {
  const repo = new OnboardingRepository();
  const progress = repo.getProgress();
  return NextResponse.json({ progress });
}

/**
 * PATCH /api/onboarding/progress
 * Updates onboarding progress based on the action.
 *
 * Actions:
 * - start: creates initial progress record
 * - complete: marks a specific step as completed
 * - skip: marks a specific step as skipped
 * - skip_all: marks entire onboarding as skipped
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  const body = await request.json();
  const parsed = onboardingPatchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { action, step } = parsed.data;
  const repo = new OnboardingRepository();

  if (action === 'start') {
    const existing = repo.getProgress();
    if (existing) {
      return NextResponse.json({ progress: existing });
    }
    const progress = repo.createProgress();
    return NextResponse.json({ progress }, { status: 201 });
  }

  if (action === 'skip_all') {
    try {
      const progress = repo.skipOnboarding();
      return NextResponse.json({ progress });
    } catch {
      return NextResponse.json({ error: 'No onboarding progress found' }, { status: 404 });
    }
  }

  if (action === 'complete' || action === 'skip') {
    if (!step) {
      return NextResponse.json(
        { error: 'Step is required for complete/skip actions' },
        { status: 400 },
      );
    }

    try {
      const status = action === 'complete' ? 'completed' : 'skipped';
      const progress = repo.updateStepStatus(step as any, status);

      // Auto-complete onboarding if all action steps are done
      const actionSteps = [
        'welcome',
        'integrations',
        'relay',
        'firstIncident',
        'receiveEvents',
        'billing',
      ] as const;
      const allDone = actionSteps.every(
        (s) => progress.steps[s] === 'completed' || progress.steps[s] === 'skipped',
      );
      if (allDone && !progress.completed) {
        const completed = repo.completeOnboarding();
        return NextResponse.json({ progress: completed });
      }

      return NextResponse.json({ progress });
    } catch {
      return NextResponse.json({ error: 'No onboarding progress found' }, { status: 404 });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
