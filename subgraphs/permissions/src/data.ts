import { fileURLToPath } from 'node:url';
import { openDb } from '@lab/shared/db';

const connection = openDb('permissions', fileURLToPath(new URL('../db/permissions.sqlite', import.meta.url)));

export type Role = 'SUPERINTENDENT' | 'PROJECT_MANAGER' | 'VIEWER';

export interface ProjectMembershipEntity {
  userId: string; // a user owned by the users subgraph
  projectId: string; // a project owned by the daily-logs subgraph
  role: Role;
}

const getMembershipTable = () => connection<ProjectMembershipEntity>('project_memberships');

// undefined when the user has no membership on the project.
export async function getMembership(userId: string, projectId: string) {
  return await getMembershipTable().where({ userId, projectId }).first();
}

export async function getMembershipsByUserId(userId: string) {
  return await getMembershipTable().select().where({ userId }).orderBy('projectId');
}

export async function getMembershipsByProjectId(projectId: string) {
  return await getMembershipTable().select().where({ projectId }).orderBy('userId');
}

// Every membership for any of these users, in one query. Matching rows back
// to specific (userId, projectId) pairs is up to the caller.
export async function getMembershipsByUserIds(userIds: readonly string[]) {
  return await getMembershipTable().select().whereIn('userId', userIds);
}
