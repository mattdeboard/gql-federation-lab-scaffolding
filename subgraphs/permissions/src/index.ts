import { readFileSync } from 'node:fs';
import express from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { buildSubgraphSchema, type GraphQLResolverMap } from '@apollo/subgraph';
import { parse } from 'graphql';
import { log, operationLogger } from '@lab/shared/log';
import { getContext, type PermissionsContext } from './context.ts';
import { internalRoutes } from './internalRoutes.ts';
import { resolvers } from './resolvers.ts';

const SUBGRAPH = 'permissions';
const PORT = 4003;

// Unlike the other subgraphs, this one runs on Express, because it also serves
// a small REST API outside the graph (see internalRoutes.ts).
const app = express();
app.use(express.json());
app.use('/internal', internalRoutes(SUBGRAPH));

const sdl = readFileSync(new URL('../schema.graphql', import.meta.url), 'utf8');

// Until schema.graphql has real SDL in it, only the REST API is served.
// `npm run dev` watches the file and restarts this process when it changes.
if (sdl.replace(/#.*$/gm, '').trim() === '') {
  log(SUBGRAPH, 'info', 'schema.graphql is still a stub; serving /internal only');
} else {
  const server = new ApolloServer<PermissionsContext>({
    // The cast bridges our Resolvers type (shared/resolvers.ts), which types
    // __resolveReference correctly, to Apollo's looser GraphQLResolverMap.
    schema: buildSubgraphSchema([{ typeDefs: parse(sdl), resolvers: resolvers as GraphQLResolverMap }]),
    plugins: [operationLogger(SUBGRAPH)],
  });
  await server.start();

  // The router's routing_url is http://localhost:4003, so GraphQL lives at the root.
  app.use(
    '/',
    expressMiddleware(server, {
      context: async ({ req }) => getContext(req.headers),
    }),
  );
}

app.listen(PORT, () => {
  log(SUBGRAPH, 'info', `ready at http://localhost:${PORT}/ (REST under /internal)`);
});
