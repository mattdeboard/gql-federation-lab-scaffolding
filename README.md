# GraphQL Federation Lab (scaffolding)

A hands-on Apollo Federation 2 lab that simulates the **Daily Log** feature of a construction-management platform. One supergraph, nine subgraphs, each owning its own SQLite database. The goal is learning by doing: entities, `@key`, `@external` / `@requires`, header propagation, cross-subgraph auth, query plans, and the N+1 problem as it actually appears in a federated graph.

**This repo is the scaffolding only.** Everything that isn't GraphQL is already built: the monorepo, every subgraph's server bootstrap, database schema, deterministic seed data, plain data-access functions, the router config, logging, and the run scripts. Every `schema.graphql` and `src/resolvers.ts` is an empty stub. Writing those is the exercise.

---

## Who writes what

**You write all the GraphQL:**

- every `schema.graphql` (all SDL, all federation directives)
- every `src/resolvers.ts`, including `__resolveReference`
- dataloaders (`dataloader` is installed; add per-request loaders in each `src/context.ts`)
- permission enforcement logic
- the operations in `queries/`

**Already done for you:** workspaces, `tsconfig`, lint rules, run scripts, per-subgraph SQLite schemas and seeds, `shared/` utilities (SQL logging, `_entities` logging, auth header parsing), a server bootstrap per subgraph, router config, and a `src/data.ts` per subgraph with plain query functions like `getNotesByDailyLogId(id)`. Those functions do no batching and no caching, so N+1 shows up exactly as it would in real code.

If you work with an AI coding assistant, [`CLAUDE.md`](CLAUDE.md) tells it this division of labor: it maintains the scaffolding and tutors you on the GraphQL, but doesn't write it for you.

---

## The scenario

A superintendent ("supe") opens a single **Daily Log** for one of their projects on a tablet at the jobsite. One GraphQL operation should hydrate the whole view:

- the log itself (date, status, project, who created it)
- observed weather for that day
- the project's crew
- notes written on the log
- photos taken that day, each with its comments and comment authors

### Functional requirements

1. Fetch a single Daily Log in one operation to hydrate the view.
2. Support low/no-connectivity, high-latency environments.
3. Respect permissions: a supe sees their projects and only their projects.

### Non-functional requirements

- End-of-day burstiness (everyone submits logs ~4–6pm local)
- Steady all-day traffic otherwise

### Personas (the seed data covers all three)

- **Author**: the supe; has project permissions.
- **Crew**: users just added to a project's crew; they exist as users but have **no** project permissions.
- **Comment author**: any user who commented on a photo; each has their own permissions (some have lost access since commenting).

---

## Architecture

```
                 ┌────────────────┐
  client ──────▶ │  Apollo Router │  :4000   (the BFF / gateway)
                 └───────┬────────┘
     ┌──────────┬────────┼─────────┬──────────┬──────────┬──────────┬──────────┐
     ▼          ▼        ▼         ▼          ▼          ▼          ▼          ▼
  users       auth   permissions daily-logs  weather    crews      notes     photos    comments
  :4001      :4002     :4003      :4004      :4005      :4006      :4007     :4008      :4009
```

One subgraph per domain. **Each subgraph owns its own SQLite file.** No subgraph reads another's database or imports another subgraph's code. A lint rule enforces this: `subgraphs/*` may import from `shared/` but never from another `subgraphs/*`.

### Stack

- Node 24 + TypeScript (strict), npm workspaces monorepo. Node runs the `.ts` files directly (type stripping), so there's no build step.
- `@apollo/server` + `@apollo/subgraph` per subgraph
- Apollo Router via `rover dev` locally; `rover supergraph compose` + `router` binary as the "production-like" path
- SQLite per subgraph, through knex on the `better-sqlite3` driver (camelCase in code, snake_case in the database)
- `dataloader` installed but unused (you'll wire it up)
- `concurrently` to run everything with one command
- ESLint (type-aware) + Prettier
- No GraphQL codegen

### Repo layout

```
router/
  router.yaml              # header propagation, query-plan exposure
  supergraph.yaml          # generated per LEVEL (gitignored)
subgraphs/
  users/  auth/  permissions/  daily-logs/  weather/  crews/  notes/  photos/  comments/
    schema.graphql         # yours (stub)
    src/resolvers.ts       # yours (stub)
    src/context.ts         # per-request context: the caller's userId; add your loaders here
    src/index.ts           # server bootstrap only
    src/data.ts            # plain query functions, no batching or caching (not in auth)
    db/schema.sql          # this subgraph's tables (not in auth)
    db/seed.ts             # writes this subgraph's slice of scripts/world.ts (not in auth)
  permissions/src/internalRoutes.ts   # the internal REST API (see below)
  weather/src/fakeForecast.ts         # deterministic stand-in for a forecast API
shared/
  db.ts                    # knex connection; logs every SQL statement; camelCase <-> snake_case
  context.ts               # parses the propagated Authorization header into { userId }
  log.ts                   # logs each incoming operation; for `_entities`, the representation count
  resolvers.ts             # Resolvers type for resolver maps
  ids.ts                   # generateId('log') for rows created at runtime
queries/                   # yours: named operations, one per .graphql file
scripts/
  subgraphs.ts             # the list of subgraphs: name, port, Level
  world.ts                 # the deterministic seed dataset
  seed-all.ts  dev.ts  op.ts  write-supergraph-config.ts  compose.sh
docs/
  log-parsing.md           # grep/awk recipes for the logs
```

### Observability is the whole point

Every subgraph logs to stdout, prefixed with its name:

- each incoming operation, and specifically each `_entities` call with **how many representations** it received
- each SQL statement executed

This is how you see the query plan fan out and see N+1 happen before you fix it. The logging is wired in at the server/plugin level, so it works no matter what's in the resolvers. The router also exposes query plans: send `Apollo-Expose-Query-Plan: true` (or `dry-run`) with any operation. See [`docs/log-parsing.md`](docs/log-parsing.md) for how to read all of it.

---

## Domains → subgraphs

What each subgraph owns, as **tables only**. The GraphQL shape is yours to design.

| Subgraph      | Port | Scope                                  | Tables                                                                                                 |
| ------------- | ---- | -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `users`       | 4001 | global                                 | `users(id, name, email, trade)`                                                                        |
| `auth`        | 4002 | current user                           | none; reads `userId` from the propagated `Authorization` header (fake tokens: `Bearer user-1`)         |
| `permissions` | 4003 | project                                | `project_memberships(user_id, project_id, role)`; role ∈ `SUPERINTENDENT`, `PROJECT_MANAGER`, `VIEWER` |
| `daily-logs`  | 4004 | project                                | `projects(id, name, latitude, longitude)`, `daily_logs(id, project_id, date, status, created_by)`      |
| `weather`     | 4005 | daily log                              | `weather_observations(id, daily_log_id, observed_at, sky, temp_f, precipitation, wind_mph, is_delay)`  |
| `crews`       | 4006 | project                                | `crew_members(id, project_id, user_id, role, added_at)`                                                |
| `notes`       | 4007 | daily log                              | `notes(id, daily_log_id, author_id, body, created_at)`                                                 |
| `photos`      | 4008 | project (optionally attached to a log) | `photos(id, project_id, daily_log_id NULL, url, caption, taken_at, uploaded_by)`                       |
| `comments`    | 4009 | photo                                  | `comments(id, photo_id, author_id, body, created_at)`                                                  |

Notes:

- `permissions` runs on Express and also serves a small **internal REST API** outside the graph, available even while its schema is a stub. How the other subgraphs use it is part of Level 4.
  - `GET /internal/access?userId=&projectId=` → `{ allowed, role }`
  - `POST /internal/access/batch` with `{ "pairs": [{ "userId", "projectId" }, ...] }` → `{ results: [...] }` in the same order
- `weather` has a deterministic `src/fakeForecast.ts` (`forecastFor(projectId, date)`) and is **artificially slow**: every request waits `WEATHER_DELAY_MS` (default 800ms; set it in `.env`).
- `photos` are jobsite progress photos, not profile pictures, with placeholder image URLs.
- `daily-logs` holds `projects` because there's no separate Projects service.

---

## The target view

Eventually one operation should return, for a given Daily Log ID: the current user; the log's date, status, and creator; the project name, my role on it, and its crew; weather observations plus a forecast summary; notes with authors; photos with uploaders, each with comments and comment authors.

---

## Seed data

Deterministic (fixed IDs; any randomness uses a fixed seed):

- 2 projects in different locations (Portland and Phoenix)
- 10 users: 2 supes (one per project), 1 PM on both projects, a viewer, crew members, and users with no memberships at all
- 7 daily logs per project (one week)
- per log: 1–3 weather observations, 2–5 notes, 15–25 photos
- per photo: 0–6 comments by a mix of users, **including a comment author who has since lost project access**
- crew members are users with **no** `project_memberships` rows (the "just added" persona)

The databases aren't checked in. `npm run seed` creates them and prints which `Bearer` token is which persona.

---

## Levels

Work through these in order. `LEVEL=n npm run dev` runs Levels 0 through n. Each subgraph starts as a stub (it logs `schema.graphql is still a stub` and exits), and composition fails until you've written the schemas for that Level.

- **Level 0:** `users` + `daily-logs`. Composition, `@key`, `__resolveReference`, reading the query plan.
- **Level 1:** `notes`. Extending an entity another subgraph owns; watching `_entities` in the logs.
- **Level 2:** `photos` + `comments`. Run the view naively, count SQL statements, then fix N+1 with dataloaders. Write up before/after counts.
- **Level 3:** `auth`. Header propagation (already configured in `router/router.yaml`), `Query.me`.
- **Level 4:** `permissions`. Where authorization belongs in a federated graph. Compare approaches.
- **Level 5:** `weather`. `@external` / `@requires`, and the extra sequential plan step it causes.
- **Level 6:** `crews`. Repetition to confirm the patterns stuck.

### Stretch goals (tie back to the NFRs)

- `@defer` the slow weather block (high-latency jobsite tablets)
- Persisted queries
- Write-up of a client-side offline story (cached log, queued mutations)
- `k6` load test: steady traffic plus an end-of-day burst of note writes (the operations it sends come from `queries/`)
- Split one subgraph into its own repo and compose from a GraphOS registry instead of local files

---

## Running

Prerequisites: Node 24 (`.nvmrc`) and [rover](https://www.apollographql.com/docs/rover/getting-started).

```bash
nvm use               # Node 24 (from .nvmrc)
npm install
npm run rover:install # once per machine: rover's router + composition plugins
npm run seed          # create and seed every database; prints which Bearer token is which persona
npm run seed -- notes # reseed only the named subgraph(s); the rest keep their data
npm run dev           # subgraphs for LEVEL=0 + rover dev (router on :4000)
LEVEL=2 npm run dev   # Levels 0 through 2
npm run dev:log       # same as dev, also writes logs/dev.log
```

Local `rover` composition requires accepting Apollo's ELv2 license: put `APOLLO_ELV2_LICENSE=accept` in `.env`.

Manual testing in Apollo Sandbox at `http://localhost:4000` with:

```json
{
  "Authorization": "Bearer user-1",
  "Apollo-Expose-Query-Plan": "true"
}
```

Run a saved operation from `queries/` and see its plan, response, and the SQL/`_entities` lines it caused:

```bash
npm run op -- queries/<name>.graphql --as user-2 --vars '{"id": "log-1"}'
```

Variables default to a sibling `<name>.variables.json`; `--as none` sends no `Authorization` header. The log section needs `npm run dev:log` running.

Each subgraph is independently startable: `npm run dev -w subgraphs/notes`.

The production-like path: `LEVEL=n npm run compose` composes `router/supergraph.graphql` with rover (LEVEL defaults to 6); `LEVEL=n npm run compose -- run` also starts the standalone router against it.

Before committing: `npm run check` (typecheck, lint, format check). When you write a subgraph's schema, delete its line from `.prettierignore` so Prettier formats it.
