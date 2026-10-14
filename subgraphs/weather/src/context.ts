import type { IncomingHttpHeaders } from 'node:http';
import { authFromHeaders, type AuthContext } from '@lab/shared/context';

// Everything a weather resolver receives as `context`. getContext runs once per
// request, so anything created here (e.g. loaders) is fresh for each request.
export type WeatherContext = AuthContext;

export function getContext(headers: IncomingHttpHeaders): WeatherContext {
  return {
    ...authFromHeaders(headers),
  };
}
