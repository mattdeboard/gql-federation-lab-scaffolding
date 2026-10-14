import type { IncomingHttpHeaders } from 'node:http';
import { authFromHeaders, type AuthContext } from '@lab/shared/context';

// Everything a crews resolver receives as `context`. getContext runs once per
// request, so anything created here (e.g. loaders) is fresh for each request.
export type CrewsContext = AuthContext;

export function getContext(headers: IncomingHttpHeaders): CrewsContext {
  return {
    ...authFromHeaders(headers),
  };
}
