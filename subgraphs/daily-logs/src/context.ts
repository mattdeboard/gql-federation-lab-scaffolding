import type { IncomingHttpHeaders } from 'node:http';
import { authFromHeaders, type AuthContext } from '@lab/shared/context';

// Everything a daily-logs resolver receives as `context`. getContext runs once per
// request, so anything created here (e.g. loaders) is fresh for each request.
export type DailyLogsContext = AuthContext;

export function getContext(headers: IncomingHttpHeaders): DailyLogsContext {
  return {
    ...authFromHeaders(headers),
  };
}
