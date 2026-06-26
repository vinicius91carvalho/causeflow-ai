import { describe, it, expect } from 'vitest';
import { FixtureCodeRepository } from '../../fixtures/fixture-code-repository.js';
import { oomMemoryLeak, configRegression, nPlusOneQuery } from '../../fixtures/scenarios/index.js';

describe('FixtureCodeRepository', () => {
  describe('listRecentCommits', () => {
    it('should return all commits sorted by date descending', async () => {
      const repo = new FixtureCodeRepository(oomMemoryLeak);
      const commits = await repo.listRecentCommits('acme', 'payment-service');

      expect(commits.length).toBe(4);
      // Most recent first
      expect(commits[0]!.sha).toBe('m3n4o5p6');
      expect(commits[commits.length - 1]!.sha).toBe('a1b2c3d4');
    });

    it('should filter commits by since date', async () => {
      const repo = new FixtureCodeRepository(oomMemoryLeak);
      const commits = await repo.listRecentCommits('acme', 'payment-service', {
        since: '2026-02-16T00:00:00Z',
      });

      expect(commits.length).toBe(3);
      expect(commits.every((c) => new Date(c.date).getTime() >= new Date('2026-02-16T00:00:00Z').getTime())).toBe(true);
    });

    it('should filter commits by until date', async () => {
      const repo = new FixtureCodeRepository(oomMemoryLeak);
      const commits = await repo.listRecentCommits('acme', 'payment-service', {
        until: '2026-02-16T00:00:00Z',
      });

      expect(commits.length).toBe(1);
      expect(commits[0]!.sha).toBe('a1b2c3d4');
    });

    it('should respect limit parameter', async () => {
      const repo = new FixtureCodeRepository(oomMemoryLeak);
      const commits = await repo.listRecentCommits('acme', 'payment-service', { limit: 2 });

      expect(commits.length).toBe(2);
    });

    it('should combine since and limit filters', async () => {
      const repo = new FixtureCodeRepository(oomMemoryLeak);
      const commits = await repo.listRecentCommits('acme', 'payment-service', {
        since: '2026-02-16T00:00:00Z',
        limit: 1,
      });

      expect(commits.length).toBe(1);
      expect(commits[0]!.sha).toBe('m3n4o5p6');
    });
  });

  describe('getCommitDiff', () => {
    it('should return diff for existing SHA', async () => {
      const repo = new FixtureCodeRepository(oomMemoryLeak);
      const diff = await repo.getCommitDiff('acme', 'payment-service', 'e5f6g7h8');

      expect(diff.sha).toBe('e5f6g7h8');
      expect(diff.message).toContain('caching');
      expect(diff.files.length).toBeGreaterThan(0);
      expect(diff.files[0]!.patch).toBeDefined();
    });

    it('should throw for non-existent SHA', async () => {
      const repo = new FixtureCodeRepository(oomMemoryLeak);

      await expect(
        repo.getCommitDiff('acme', 'payment-service', 'nonexistent'),
      ).rejects.toThrow('Commit nonexistent not found');
    });
  });

  describe('getFileContent', () => {
    it('should return file for existing path', async () => {
      const repo = new FixtureCodeRepository(configRegression);
      const file = await repo.getFileContent('acme', 'payment-service', 'src/config.ts');

      expect(file.path).toBe('src/config.ts');
      expect(file.content).toContain('requestTimeoutMs');
      expect(file.content).toContain('3000');
      expect(file.size).toBeGreaterThan(0);
    });

    it('should throw for non-existent path', async () => {
      const repo = new FixtureCodeRepository(oomMemoryLeak);

      await expect(
        repo.getFileContent('acme', 'payment-service', 'nonexistent.ts'),
      ).rejects.toThrow("File 'nonexistent.ts' not found");
    });
  });

  describe('listDeployments', () => {
    it('should return deployments sorted by date descending', async () => {
      const repo = new FixtureCodeRepository(oomMemoryLeak);
      const deployments = await repo.listDeployments('acme', 'payment-service');

      expect(deployments.length).toBe(2);
      expect(deployments[0]!.environment).toBe('production');
      expect(deployments[0]!.sha).toBe('m3n4o5p6');
    });

    it('should filter deployments by environment', async () => {
      const repo = new FixtureCodeRepository(oomMemoryLeak);
      const deployments = await repo.listDeployments('acme', 'payment-service', {
        environment: 'staging',
      });

      expect(deployments.length).toBe(1);
      expect(deployments[0]!.environment).toBe('staging');
    });

    it('should respect limit parameter', async () => {
      const repo = new FixtureCodeRepository(oomMemoryLeak);
      const deployments = await repo.listDeployments('acme', 'payment-service', { limit: 1 });

      expect(deployments.length).toBe(1);
    });
  });

  describe('scenario independence', () => {
    it('should use scenario-specific data', async () => {
      const oomRepo = new FixtureCodeRepository(oomMemoryLeak);
      const nq1Repo = new FixtureCodeRepository(nPlusOneQuery);

      const oomCommits = await oomRepo.listRecentCommits('acme', 'payment-service');
      const nq1Commits = await nq1Repo.listRecentCommits('acme', 'payment-service');

      expect(oomCommits.length).toBe(4);
      expect(nq1Commits.length).toBe(3);
      expect(oomCommits[0]!.sha).not.toBe(nq1Commits[0]!.sha);
    });
  });
});
