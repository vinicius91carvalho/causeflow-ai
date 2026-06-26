import type { FixtureScenario } from './index.js';

export const unhandledPromise: FixtureScenario = {
  name: 'unhandled-promise',
  description: 'Unhandled promise rejection caused by missing await in async auth middleware',

  commits: [
    {
      sha: 'up01aaaa',
      message: 'feat: add token expiration validation to auth middleware',
      author: 'dev@acme.com',
      date: '2026-02-13T11:00:00Z',
      files: [{ filename: 'src/middleware/auth.ts', status: 'modified', additions: 8, deletions: 3 }],
    },
    {
      sha: 'up02bbbb',
      message: 'refactor: convert auth middleware to async for DB lookup',
      author: 'senior-dev@acme.com',
      date: '2026-02-14T15:00:00Z',
      files: [{ filename: 'src/middleware/auth.ts', status: 'modified', additions: 12, deletions: 6 }],
    },
    {
      sha: 'up03cccc',
      message: 'fix: update route registration order',
      author: 'dev@acme.com',
      date: '2026-02-14T16:00:00Z',
      files: [{ filename: 'src/index.ts', status: 'modified', additions: 2, deletions: 2 }],
    },
    {
      sha: 'up04dddd',
      message: 'ci: deploy v2.14.4 to production',
      author: 'ci-bot@acme.com',
      date: '2026-02-15T08:00:00Z',
      files: [{ filename: 'infra/task-definition.json', status: 'modified', additions: 1, deletions: 1 }],
    },
  ],

  diffs: {
    up02bbbb: {
      sha: 'up02bbbb',
      message: 'refactor: convert auth middleware to async for DB lookup',
      files: [
        {
          filename: 'src/middleware/auth.ts',
          status: 'modified',
          patch: `@@ -3,10 +3,16 @@ import { logger } from '../utils/logger.js';
-export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
+export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
   const token = req.headers.authorization?.replace('Bearer ', '');
   if (!token) { res.status(401).json({ error: 'Missing token' }); return; }

-  // Synchronous token validation
-  const payload = validateToken(token);
-  if (!payload) { res.status(401).json({ error: 'Invalid token' }); return; }
+  // BUG: validateTokenAsync returns Promise but not awaited
+  // Express doesn't catch unhandled rejections from non-async route handlers
+  validateTokenAsync(token).then(payload => {
+    if (!payload) { res.status(401).json({ error: 'Invalid token' }); return; }
+    (req as any).userId = payload.sub;
+    next();
+  });
+  // Missing: .catch(err => next(err)) or missing async/await
 }`,
        },
      ],
    },
  },

  files: {
    'src/middleware/auth.ts': {
      path: 'src/middleware/auth.ts',
      content: `import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

async function validateTokenAsync(token: string): Promise<{ sub: string; exp: number } | null> {
  // Simulates async DB/cache lookup for token validation
  const decoded = Buffer.from(token, 'base64').toString();
  const payload = JSON.parse(decoded);
  if (!payload.sub || !payload.exp) return null;
  if (Date.now() > payload.exp * 1000) return null;
  return payload;
}

// BUG: function is not async but calls async validateTokenAsync without await
// Express won't catch the unhandled rejection
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Missing token' }); return; }

  // Promise returned but not awaited — unhandled rejection on validation failure
  validateTokenAsync(token).then(payload => {
    if (!payload) { res.status(401).json({ error: 'Invalid token' }); return; }
    (req as any).userId = payload.sub;
    next();
  });
  // .catch() is missing — if validateTokenAsync throws, process crashes
}`,
      size: 820,
      sha: 'up_file1',
    },
  },

  deployments: [
    {
      id: 404,
      sha: 'up04dddd',
      environment: 'production',
      createdAt: '2026-02-15T08:15:00Z',
      status: 'success',
    },
  ],
};
