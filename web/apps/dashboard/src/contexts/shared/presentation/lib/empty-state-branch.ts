export type EmptyStateBranch = 'A' | 'B' | 'C';

interface SelectEmptyStateBranchInput {
  hasAnalyses: boolean;
  hasIntegrations: boolean;
}

/**
 * Deterministic three-branch empty-state selector.
 *
 * Truth table:
 *   (false, false) → A  — nothing connected, nothing done yet
 *   (false, true)  → B  — integrations connected, no analyses yet
 *   (true,  false) → C  — analyses exist (degenerate: implies something happened)
 *   (true,  true)  → C  — active user with integrations and analyses
 */
export function selectEmptyStateBranch({
  hasAnalyses,
  hasIntegrations,
}: SelectEmptyStateBranchInput): EmptyStateBranch {
  if (hasAnalyses) {
    return 'C';
  }
  if (hasIntegrations) {
    return 'B';
  }
  return 'A';
}
