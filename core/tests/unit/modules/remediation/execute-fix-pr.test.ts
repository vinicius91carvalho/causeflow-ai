import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecuteRemediationUseCase } from '../../../../src/modules/remediation/application/execute-remediation.usecase.js';
import type { IRemediationRepository } from '../../../../src/modules/remediation/domain/remediation.repository.js';
import type { IIncidentRepository } from '../../../../src/modules/ingestion/domain/incident.repository.js';
import type { IEventBus } from '../../../../src/shared/domain/events.js';
import type { CloudProvider } from '../../../../src/shared/application/ports/cloud-provider.port.js';
import type { ICodeRepository } from '../../../../src/shared/application/ports/code-repository.port.js';
import type { Remediation } from '../../../../src/modules/remediation/domain/remediation.entity.js';
import type { RemediationId, TenantId, IncidentId } from '../../../../src/shared/domain/value-objects.js';
import type { ProposedFix } from '../../../../src/modules/investigation/domain/investigation.types.js';

const TENANT_ID = 'tenant-1' as TenantId;
const REMEDIATION_ID = 'rem-1' as RemediationId;
const INCIDENT_ID = 'inc-1' as IncidentId;

const proposedFix: ProposedFix = {
  repoFullName: 'acme/payment-service',
  files: [
    { path: 'src/payments.ts', content: 'fixed content', changeDescription: 'Added finally block to release connection' },
  ],
  summary: 'Fix connection pool leak',
  testSuggestions: ['Test that connections are released on error'],
};

function createMockRemediation(steps: Remediation['steps']): Remediation {
  return {
    remediationId: REMEDIATION_ID,
    tenantId: TENANT_ID,
    incidentId: INCIDENT_ID,
    status: 'approved',
    description: 'test',
    rootCause: 'connection pool leak',
    steps,
    proposedBy: 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('ExecuteRemediationUseCase — create_fix_pr', () => {
  let remediationRepo: IRemediationRepository;
  let incidentRepo: IIncidentRepository;
  let eventBus: IEventBus;
  let cloudProvider: CloudProvider;
  let codeRepo: ICodeRepository;
  let useCase: ExecuteRemediationUseCase;

  beforeEach(() => {
    remediationRepo = {
      findById: vi.fn(),
      findByIncident: vi.fn(),
      create: vi.fn(),
      update: vi.fn().mockImplementation((_t, _id, data) => Promise.resolve({ ...createMockRemediation([]), ...data })),
    };

    incidentRepo = {
      findById: vi.fn(),
      updateStatus: vi.fn(),
    } as unknown as IIncidentRepository;

    eventBus = {
      publish: vi.fn(),
      subscribe: vi.fn(),
    } as unknown as IEventBus;

    cloudProvider = {
      name: 'stub',
      executeAction: vi.fn().mockResolvedValue({ success: true, output: 'ok' }),
    } as unknown as CloudProvider;

    codeRepo = {
      listRecentCommits: vi.fn().mockResolvedValue([{ sha: 'base-sha-123', message: 'initial', author: 'dev', date: '2026-01-01' }]),
      createBranch: vi.fn().mockResolvedValue({ ref: 'refs/heads/fix/incident-inc-1', sha: 'base-sha-123' }),
      getFileContent: vi.fn().mockResolvedValue({ path: 'src/payments.ts', content: 'old', size: 3, sha: 'old-sha' }),
      createOrUpdateFile: vi.fn().mockResolvedValue({ path: 'src/payments.ts', sha: 'new-sha' }),
      createPullRequest: vi.fn().mockResolvedValue({ number: 42, url: 'https://api.github.com/pulls/42', htmlUrl: 'https://github.com/acme/payment-service/pull/42' }),
    } as unknown as ICodeRepository;

    const codeRepoFactory = vi.fn().mockReturnValue(codeRepo);

    useCase = new ExecuteRemediationUseCase(
      remediationRepo,
      incidentRepo,
      eventBus,
      cloudProvider,
      undefined,
      codeRepoFactory,
    );
  });

  it('should create branch with correct name fix/incident-{id}', async () => {
    const remediation = createMockRemediation([
      { stepIndex: 0, action: 'create_fix_pr', label: 'Create fix PR', description: 'Creates a pull request with the proposed fix', riskLevel: 'low', automated: true, params: { repoFullName: 'acme/payment-service', proposedFix }, status: 'pending' },
    ]);
    (remediationRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(remediation);

    await useCase.execute({ tenantId: TENANT_ID, remediationId: REMEDIATION_ID });

    expect(codeRepo.createBranch).toHaveBeenCalledWith('acme', 'payment-service', 'fix/incident-inc-1', 'base-sha-123');
  });

  it('should commit each file with existing SHA', async () => {
    const remediation = createMockRemediation([
      { stepIndex: 0, action: 'create_fix_pr', label: 'Create fix PR', description: 'Creates a pull request with the proposed fix', riskLevel: 'low', automated: true, params: { repoFullName: 'acme/payment-service', proposedFix }, status: 'pending' },
    ]);
    (remediationRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(remediation);

    await useCase.execute({ tenantId: TENANT_ID, remediationId: REMEDIATION_ID });

    expect(codeRepo.createOrUpdateFile).toHaveBeenCalledWith(
      'acme', 'payment-service', 'src/payments.ts', 'fixed content',
      expect.stringContaining('fix(incident-inc-1)'),
      'fix/incident-inc-1', 'old-sha',
    );
  });

  it('should create draft PR', async () => {
    const remediation = createMockRemediation([
      { stepIndex: 0, action: 'create_fix_pr', label: 'Create fix PR', description: 'Creates a pull request with the proposed fix', riskLevel: 'low', automated: true, params: { repoFullName: 'acme/payment-service', proposedFix }, status: 'pending' },
    ]);
    (remediationRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(remediation);

    await useCase.execute({ tenantId: TENANT_ID, remediationId: REMEDIATION_ID });

    expect(codeRepo.createPullRequest).toHaveBeenCalledWith('acme', 'payment-service', expect.objectContaining({
      head: 'fix/incident-inc-1',
      base: 'main',
      draft: true,
    }));
  });

  it('should save PR info in remediation entity', async () => {
    const remediation = createMockRemediation([
      { stepIndex: 0, action: 'create_fix_pr', label: 'Create fix PR', description: 'Creates a pull request with the proposed fix', riskLevel: 'low', automated: true, params: { repoFullName: 'acme/payment-service', proposedFix }, status: 'pending' },
    ]);
    (remediationRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(remediation);

    await useCase.execute({ tenantId: TENANT_ID, remediationId: REMEDIATION_ID });

    expect(remediationRepo.update).toHaveBeenCalledWith(
      TENANT_ID, REMEDIATION_ID,
      expect.objectContaining({
        pullRequests: [expect.objectContaining({
          repoFullName: 'acme/payment-service',
          prNumber: 42,
          prUrl: 'https://github.com/acme/payment-service/pull/42',
          branch: 'fix/incident-inc-1',
          status: 'open',
        })],
      }),
    );
  });

  it('should skip gracefully when no proposedFix', async () => {
    const remediation = createMockRemediation([
      { stepIndex: 0, action: 'create_fix_pr', label: 'Create fix PR', description: 'Creates a pull request with the proposed fix', riskLevel: 'low', automated: true, params: {}, status: 'pending' },
    ]);
    (remediationRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(remediation);

    await useCase.execute({ tenantId: TENANT_ID, remediationId: REMEDIATION_ID });

    expect(codeRepo.createBranch).not.toHaveBeenCalled();

    // Should still complete — step marked as skipped
    expect(remediationRepo.update).toHaveBeenCalledWith(
      TENANT_ID, REMEDIATION_ID,
      expect.objectContaining({
        status: 'completed',
        steps: [expect.objectContaining({ status: 'skipped' })],
      }),
    );
  });

  it('should skip gracefully when GitHub not configured', async () => {
    const useCaseNoGithub = new ExecuteRemediationUseCase(
      remediationRepo, incidentRepo, eventBus, cloudProvider, undefined, undefined,
    );

    const remediation = createMockRemediation([
      { stepIndex: 0, action: 'create_fix_pr', label: 'Create fix PR', description: 'Creates a pull request with the proposed fix', riskLevel: 'low', automated: true, params: { repoFullName: 'acme/service', proposedFix }, status: 'pending' },
    ]);
    (remediationRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(remediation);

    await useCaseNoGithub.execute({ tenantId: TENANT_ID, remediationId: REMEDIATION_ID });

    expect(remediationRepo.update).toHaveBeenCalledWith(
      TENANT_ID, REMEDIATION_ID,
      expect.objectContaining({
        status: 'completed',
        steps: [expect.objectContaining({ status: 'skipped' })],
      }),
    );
  });

  it('should execute mixed steps (infra + PR) in sequence', async () => {
    const remediation = createMockRemediation([
      { stepIndex: 0, action: 'restart_service', label: 'Restart service', description: 'Restarts the affected service pod', riskLevel: 'low', automated: true, params: { service: 'payment' }, status: 'pending' },
      { stepIndex: 1, action: 'create_fix_pr', label: 'Create fix PR', description: 'Creates a pull request with the proposed fix', riskLevel: 'low', automated: true, params: { repoFullName: 'acme/payment-service', proposedFix }, status: 'pending' },
    ]);
    (remediationRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(remediation);

    await useCase.execute({ tenantId: TENANT_ID, remediationId: REMEDIATION_ID });

    expect(cloudProvider.executeAction).toHaveBeenCalledTimes(1);
    expect(codeRepo.createPullRequest).toHaveBeenCalledTimes(1);
  });
});
