import { Router } from 'express';
import { log } from '@lab/shared/log';
import { getMembership, getMembershipsByUserIds } from './data.ts';

// An internal REST API, outside the graph. Any service may call it to ask
// "can this user see this project, and as what?" How (and whether) the other
// subgraphs use it is up to you.
//
//   GET  /internal/access?userId=user-1&projectId=project-1
//     -> { "allowed": true, "role": "SUPERINTENDENT" }
//     -> { "allowed": false, "role": null }
//
//   POST /internal/access/batch
//     body: { "pairs": [{ "userId": "user-1", "projectId": "project-1" }, ...] }
//     -> { "results": [{ "userId": "user-1", "projectId": "project-1", "allowed": true, "role": "SUPERINTENDENT" }, ...] }
//     Results are in the same order as `pairs`.
//
// Requests are logged as `op` lines ("GET /internal/access ..."), so they show
// up next to GraphQL operations in the logs.

type Pair = { userId: string; projectId: string };

export function internalRoutes(subgraph: string): Router {
  const router = Router();

  router.get('/access', async (req, res) => {
    const { userId, projectId } = req.query;
    if (typeof userId !== 'string' || typeof projectId !== 'string') {
      res.status(400).json({ error: 'userId and projectId query parameters are required' });
      return;
    }
    log(subgraph, 'op', `GET /internal/access userId=${userId} projectId=${projectId}`);

    const membership = await getMembership(userId, projectId);
    res.json({ allowed: membership !== undefined, role: membership?.role ?? null });
  });

  router.post('/access/batch', async (req, res) => {
    const pairs = (req.body as { pairs?: unknown } | undefined)?.pairs;
    if (!Array.isArray(pairs) || !pairs.every(isPair)) {
      res
        .status(400)
        .json({ error: 'body must be { "pairs": [{ "userId": string, "projectId": string }, ...] }' });
      return;
    }
    log(subgraph, 'op', `POST /internal/access/batch ${pairs.length} pairs`);

    // One query for every user involved, then match each pair in memory.
    const memberships = await getMembershipsByUserIds([...new Set(pairs.map((pair) => pair.userId))]);
    const results = pairs.map(({ userId, projectId }) => {
      const membership = memberships.find((m) => m.userId === userId && m.projectId === projectId);
      return { userId, projectId, allowed: membership !== undefined, role: membership?.role ?? null };
    });
    res.json({ results });
  });

  return router;
}

function isPair(value: unknown): value is Pair {
  const pair = value as Partial<Record<keyof Pair, unknown>> | null;
  return typeof pair?.userId === 'string' && typeof pair.projectId === 'string';
}
