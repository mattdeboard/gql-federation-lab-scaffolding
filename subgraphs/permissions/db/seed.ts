import type Database from 'better-sqlite3';
import type { World } from '../../../scripts/world.ts';

export function seed(db: Database.Database, world: World): void {
  const insertMembership = db.prepare(
    'INSERT INTO project_memberships (user_id, project_id, role) VALUES (@user_id, @project_id, @role)',
  );
  for (const membership of world.projectMemberships) insertMembership.run(membership);
}
