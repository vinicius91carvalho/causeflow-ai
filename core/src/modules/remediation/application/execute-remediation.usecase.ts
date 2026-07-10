import { NotFoundError } from '../../../shared/domain/errors.js';
import { RemediationNotApprovedError } from '../domain/remediation.errors.js';
import { logger } from '../../../shared/infra/logger.js';
import type { IRemediationRepository } from '../domain/remediation.repository.js';
import type { IIncidentRepository } from '../../ingestion/domain/incident.repository.js';
import type { Remediation } from '../domain/remediation.entity.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { CloudProvider } from '../../../shared/application/ports/cloud-provider.port.js';
import type { CredentialVendor } from '../../../shared/application/ports/credential-vendor.port.js';
import type { ICodeRepository } from '../../../shared/application/ports/code-repository.port.js';
import type { TenantId, RemediationId, IncidentId } from '../../../shared/domain/value-objects.js';
import type { RemediationStep, PullRequestInfo } from '../domain/remediation.entity.js';

interface ProposedFix {
    repoFullName: string;
    baseBranch?: string;
    summary: string;
    files: Array<{ path: string; content: string; changeDescription: string }>;
    testSuggestions: string[];
}

export interface ExecuteRemediationInput {
    tenantId: TenantId;
    remediationId: RemediationId;
    actorUserId?: string;
    actorEmail?: string;
}

export class ExecuteRemediationUseCase {
    remediationRepo;
    incidentRepo;
    eventBus;
    cloudProvider;
    credentialVendor;
    codeRepoFactory;
    constructor(remediationRepo: IRemediationRepository, incidentRepo: IIncidentRepository, eventBus: IEventBus, cloudProvider: CloudProvider, credentialVendor?: CredentialVendor, codeRepoFactory?: (tenantId: TenantId) => ICodeRepository | undefined) {
        this.remediationRepo = remediationRepo;
        this.incidentRepo = incidentRepo;
        this.eventBus = eventBus;
        this.cloudProvider = cloudProvider;
        this.credentialVendor = credentialVendor;
        this.codeRepoFactory = codeRepoFactory;
    }
    async execute(input: ExecuteRemediationInput): Promise<Remediation> {
        const { tenantId, remediationId } = input;
        // 1. Fetch remediation
        const remediation = await this.remediationRepo.findById(tenantId, remediationId);
        if (!remediation) {
            throw new NotFoundError('Remediation', remediationId);
        }
        // 2. Validate status
        if (remediation.status !== 'approved') {
            throw new RemediationNotApprovedError(remediationId, remediation.status);
        }
        // 3. Transition to executing, incident to remediating
        await this.remediationRepo.update(tenantId, remediationId, { status: 'executing' });
        await this.incidentRepo.updateStatus(tenantId, remediation.incidentId, 'remediating');
        // 4. Execute steps sequentially — vend scoped credentials for remediator
        let cloudCredentials;
        if (this.credentialVendor) {
            cloudCredentials = await this.credentialVendor.vend({
                tenantId,
                incidentId: remediation.incidentId,
                agentRole: 'remediator',
                provider: this.cloudProvider.name,
                requestedPermissions: [],
            });
        }
        else {
            cloudCredentials = { provider: 'stub', credentials: {}, region: 'sa-east-1' };
        }
        const updatedSteps: RemediationStep[] = [...remediation.steps];
        let allSucceeded = true;
        const pullRequests: PullRequestInfo[] = [];
        for (let i = 0; i < updatedSteps.length; i++) {
            const step = updatedSteps[i]!;
            // Skip manual actions — they require human intervention
            if (step.automated === false) {
                updatedSteps[i] = {
                    ...step,
                    status: 'skipped' as const,
                    output: 'Manual action — requires human intervention',
                    completedAt: new Date().toISOString(),
                };
                continue;
            }
            // create_fix_pr runs independently — infra failures should not block code fixes
            if (!allSucceeded && step.action !== 'create_fix_pr') {
                updatedSteps[i] = { ...step, status: 'skipped' as const };
                continue;
            }
            const stepStartMs = Date.now();
            updatedSteps[i] = { ...step, status: 'running' as const, startedAt: new Date().toISOString() };
            try {
                if (step.action === 'create_fix_pr') {
                    const prResult = await this.executeCreateFixPR(tenantId, remediation.incidentId, step.params);
                    const stepDurationMs = Date.now() - stepStartMs;
                    if (prResult) {
                        pullRequests.push(prResult);
                        updatedSteps[i] = {
                            ...updatedSteps[i]!,
                            status: 'succeeded' as const,
                            output: `PR #${prResult.prNumber} created: ${prResult.prUrl}`,
                            durationMs: stepDurationMs,
                            completedAt: new Date().toISOString(),
                        };
                    }
                    else {
                        updatedSteps[i] = {
                            ...updatedSteps[i]!,
                            status: 'skipped' as const,
                            output: 'No proposed fix available or GitHub not configured',
                            durationMs: stepDurationMs,
                            completedAt: new Date().toISOString(),
                        };
                    }
                    continue;
                }
                const result = await this.cloudProvider.executeAction(cloudCredentials, {
                    resourceId: `incident-${remediation.incidentId}`,
                    action: step.action,
                    params: step.params,
                });
                const stepDurationMs = Date.now() - stepStartMs;
                updatedSteps[i] = {
                    ...updatedSteps[i]!,
                    status: (result.success ? 'succeeded' : 'failed') as RemediationStep['status'],
                    output: result.output,
                    beforeState: result.beforeState,
                    afterState: result.afterState,
                    durationMs: stepDurationMs,
                    completedAt: new Date().toISOString(),
                };
                if (!result.success) {
                    allSucceeded = false;
                }
            }
            catch (err) {
                const stepDurationMs = Date.now() - stepStartMs;
                updatedSteps[i] = {
                    ...updatedSteps[i]!,
                    status: 'failed' as const,
                    output: err instanceof Error ? err.message : 'Unknown error',
                    durationMs: stepDurationMs,
                    completedAt: new Date().toISOString(),
                };
                allSucceeded = false;
            }
        }
        // 5. Final status + cost/duration tracking
        const now = new Date().toISOString();
        // Manual-skipped steps don't count as failures
        const executedSteps = updatedSteps.filter((s) => s.automated !== false);
        const hasFailures = executedSteps.some((s) => s.status === 'failed');
        const finalStatus = hasFailures ? 'failed' : 'completed';
        const totalDurationMs = updatedSteps.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
        const totalCostUsd = updatedSteps.reduce((sum, s) => sum + (s.costUsd ?? 0), 0);
        const updateData: Partial<Remediation> = {
            status: finalStatus as Remediation['status'],
            steps: updatedSteps,
            totalCostUsd: totalCostUsd > 0 ? totalCostUsd : undefined,
            totalDurationMs,
            completedAt: now,
        };
        if (pullRequests.length > 0) {
            updateData.pullRequests = pullRequests;
        }
        const updated = await this.remediationRepo.update(tenantId, remediationId, updateData);
        // 6. Update incident status
        if (allSucceeded) {
            await this.incidentRepo.updateStatus(tenantId, remediation.incidentId, 'resolved', now);
        }
        // 7. Publish event
        const isRollback = Boolean(remediation.rollbackOf) || remediation.description.toLowerCase().includes('rollback');
        await this.eventBus.publish({
            eventType: 'remediation.executed',
            occurredAt: now,
            tenantId,
            payload: {
                incidentId: remediation.incidentId,
                remediationId,
                status: finalStatus,
                stepsCompleted: updatedSteps.filter((s) => s.status === 'succeeded').length,
                totalSteps: updatedSteps.length,
                actorUserId: input.actorUserId,
                actorEmail: input.actorEmail,
                ...(isRollback ? { isRollback: true, rollbackOf: remediation.rollbackOf } : {}),
            },
        });
        return updated;
    }
    async executeCreateFixPR(tenantId: TenantId, incidentId: IncidentId, params: Record<string, unknown>): Promise<PullRequestInfo | undefined> {
        const proposedFix = params.proposedFix as ProposedFix | undefined;
        if (!proposedFix || proposedFix.files.length === 0)
            return undefined;
        const codeRepo = this.codeRepoFactory?.(tenantId);
        if (!codeRepo) {
            logger.warn({ tenantId, incidentId }, 'Cannot create fix PR: GitHub not configured');
            return undefined;
        }
        const [owner, repo] = proposedFix.repoFullName.split('/');
        if (!owner || !repo)
            return undefined;
        const baseBranch = proposedFix.baseBranch ?? 'main';
        const branchName = `fix/incident-${incidentId}`;
        // 1. Get base branch HEAD SHA
        const commits = await codeRepo.listRecentCommits(owner, repo, { branch: baseBranch, limit: 1 });
        if (!commits || commits.length === 0) {
            logger.warn({ owner, repo, baseBranch }, 'No commits found on base branch');
            return undefined;
        }
        const baseSha = commits[0]!.sha;
        // 2. Create branch
        await codeRepo.createBranch(owner, repo, branchName, baseSha);
        // 3. Commit files
        for (const file of proposedFix.files) {
            let existingSha;
            try {
                const existing = await codeRepo.getFileContent(owner, repo, file.path, branchName);
                existingSha = existing.sha;
            }
            catch { /* file may not exist yet */ }
            await codeRepo.createOrUpdateFile(owner, repo, file.path, file.content, `fix(incident-${incidentId}): ${file.changeDescription}`, branchName, existingSha);
        }
        // 4. Create draft PR
        const prBody = this.buildPRBody(incidentId, proposedFix);
        const pr = await codeRepo.createPullRequest(owner, repo, {
            title: `fix: ${proposedFix.summary}`,
            body: prBody,
            head: branchName,
            base: baseBranch,
            draft: true,
        });
        return {
            repoFullName: proposedFix.repoFullName,
            prNumber: pr.number,
            prUrl: pr.htmlUrl,
            branch: branchName,
            status: 'open',
        };
    }
    buildPRBody(incidentId: IncidentId, fix: ProposedFix): string {
        const fileList = fix.files.map((f: { path: string; changeDescription: string }) => `- \`${f.path}\`: ${f.changeDescription}`).join('\n');
        const tests = fix.testSuggestions.length > 0
            ? fix.testSuggestions.map((t: string) => `- [ ] ${t}`).join('\n')
            : '- [ ] Manual verification';
        return `## Automated Fix — Incident ${incidentId}

**Root cause fix**: ${fix.summary}

### Changed files
${fileList}

### Test checklist
${tests}

---
> This PR was automatically generated by CauseFlow AI SRE.
> Please review carefully before merging.`;
    }
}
