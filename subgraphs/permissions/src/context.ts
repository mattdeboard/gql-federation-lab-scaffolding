import type { IncomingHttpHeaders } from 'node:http';
import { authFromHeaders, type AuthContext } from '@lab/shared/context';

// Everything a permissions resolver receives as `context`. getContext runs once per
// request, so anything created here (e.g. loaders) is fresh for each request.
export type PermissionsContext = AuthContext;

export function getContext(headers: IncomingHttpHeaders): PermissionsContext {
  return {
    ...authFromHeaders(headers),
  };
}
