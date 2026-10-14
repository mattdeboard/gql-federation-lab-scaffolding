import type { IncomingHttpHeaders } from 'node:http';
import { authFromHeaders, type AuthContext } from '@lab/shared/context';

// Everything a users resolver receives as `context`. getContext runs once per
// request, so anything created here (e.g. loaders) is fresh for each request.
export type UsersContext = AuthContext;

export function getContext(headers: IncomingHttpHeaders): UsersContext {
  return {
    ...authFromHeaders(headers),
  };
}
