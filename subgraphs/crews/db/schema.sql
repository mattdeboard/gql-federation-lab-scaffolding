CREATE TABLE crew_members (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL, -- a project owned by the daily-logs subgraph; no FK across databases
  user_id    TEXT NOT NULL, -- a user owned by the users subgraph; no FK across databases
  role       TEXT NOT NULL, -- free text: 'Foreman', 'Electrician', ...
  added_at   TEXT NOT NULL  -- ISO 8601, local time
);

CREATE INDEX crew_members_project_id ON crew_members(project_id);
CREATE INDEX crew_members_user_id ON crew_members(user_id);
