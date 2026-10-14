# CLAUDE.md

Instructions for Claude Code in this repo. The project itself (scenario, architecture, domains, Levels) is described in `README.md`.

## Division of labor

The user is writing the GraphQL themselves. That's the point of this project.

**Claude owns the scaffolding**, all of which already exists. Maintain it, and extend it only when asked:

- monorepo, workspaces, `tsconfig`, lint rules, run scripts
- per-subgraph SQLite schemas (`db/schema.sql`) and deterministic seed scripts
- `shared/` utilities (SQL logging, entity-call logging, auth context parsing)
- a minimal server bootstrap per subgraph (`src/index.ts`) that loads `schema.graphql` and imports resolvers from `src/resolvers.ts`, and nothing else
- router config (`router/router.yaml`, the supergraph config generator) and composition scripts
- a data-access module per subgraph (`src/data.ts`) with plain query functions like `getNotesByDailyLogId(id)`. No batching, no caching.
- the `permissions` internal REST API (`src/internalRoutes.ts`), the `weather` artificial delay and `src/fakeForecast.ts`
- if asked, the stretch-goal `k6` script. The user writes the operations it sends.

**The user writes, and Claude does not:**

- every `schema.graphql` (all SDL, all federation directives)
- every `src/resolvers.ts`, including `__resolveReference`
- dataloaders (added to each subgraph's `src/context.ts`)
- permission enforcement logic, including how subgraphs call the permissions REST API
- the operations in `queries/`

Don't pre-write type names, fields, or directives anywhere, including comments and stubs. If a new subgraph is ever added, leave `schema.graphql` as `# TODO(you)` and `src/resolvers.ts` as `// TODO(you)` plus `export const resolvers = {};`, give it the same minimal `src/context.ts` the others have, and add the stub schema to `.prettierignore` (a comment-only file isn't valid GraphQL).

**When the user asks for help on their GraphQL code, act as a tutor, not an author.** Explain the error, explain the federation concept behind it, point at the line. Only write the fix if they explicitly ask. If composition fails, show the `rover` error verbatim first.

Optimize everything for legibility over cleverness. Don't add abstractions nobody asked for.

## How this repo works

- **Node 24 is required** (`.nvmrc`). Node runs `.ts` files directly via type stripping, with no build step and no `tsx`. That means no `enum`, `namespace`, or parameter properties (`erasableSyntaxOnly`), and relative imports spell out `.ts`. If a command fails with `Unknown file extension ".ts"`, the shell is on the wrong Node: `nvm use`.
- **Levels:** `scripts/subgraphs.ts` is the single list of subgraphs (name, port, Level). `LEVEL=n npm run dev` starts Levels 0..n and generates `router/supergraph.yaml` (gitignored). A stub subgraph exits cleanly and restarts when `schema.graphql` changes. `permissions` is the exception: while its schema is a stub it still serves `/internal`.
- **Servers:** `permissions` uses Express (`@as-integrations/express5`) so it can also serve REST; all others use `startStandaloneServer`. `weather` adds an Apollo plugin that sleeps `WEATHER_DELAY_MS` (default 800) per request.
- **Seed:** `scripts/world.ts` builds one deterministic world; each `subgraphs/*/db/seed.ts` writes only its own tables. `npm run seed` wipes and reseeds all of them and prints the persona table; `npm run seed -- notes photos` reseeds only the named subgraphs. Seeds use `better-sqlite3` directly (they need multi-statement `schema.sql`). The `.sqlite` files are gitignored.
- **Data access:** `shared/db.ts` returns a knex connection. Table getters are `connection<Entity>('table')` (not `.table<Entity>()`, which types results as `any`), with `.where()` before `.first()`. knex maps names both ways: code uses camelCase (`projectId`), the database uses snake_case (`project_id`). Entity interfaces in `data.ts` are camelCase.
- **IDs:** seeded rows have readable IDs (`user-1`, `log-3`); runtime-created rows use `generateId('log')` from `shared/ids.ts` (prefixed UUID).
- **Resolver types:** `shared/resolvers.ts` exports `Resolvers<{ Entity: { keyFields } }, TContext>`. The entity map mirrors each `@key` by hand. Each bootstrap casts `resolvers as GraphQLResolverMap` for `buildSubgraphSchema`.
- **Boundaries:** a subgraph may import `@lab/shared/*` but never another subgraph (enforced by ESLint). Only `scripts/` knows about every domain.
- **Logging:** every line is `time [subgraph] kind message`, where kind is `op`, `entities`, `sql` or `info`. Recipes are in `docs/log-parsing.md`. Keep that doc in sync if the format changes.
- **Running saved operations:** `npm run op -- queries/<name>.graphql [--as user-9|none] [--vars <json>]` (`scripts/op.ts`) sends the operation with its sibling `<name>.variables.json`, then prints the plan, the response, and the subgraph log lines and counts it produced (when `logs/dev.log` exists).
- **Install scripts:** `package.json` `allowScripts` approves `better-sqlite3` (native binary) and `@apollo/protobufjs`. If either is upgraded, re-approve with `npm install-scripts approve <pkg>`.
- **Before committing:** `npm run check` (typecheck, type-aware lint, Prettier).
