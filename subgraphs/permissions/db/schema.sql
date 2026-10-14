CREATE TABLE project_memberships (
  user_id    TEXT NOT NULL, -- a user owned by the users subgraph; no FK across databases
  project_id TEXT NOT NULL, -- a project owned by the daily-logs subgraph; no FK across databases
  role       TEXT NOT NULL CHECK (role IN ('SUPERINTENDENT', 'PROJECT_MANAGER', 'VIEWER')),
  PRIMARY KEY (user_id, project_id)
);

CREATE INDEX project_memberships_project_id ON project_memberships(project_id);
