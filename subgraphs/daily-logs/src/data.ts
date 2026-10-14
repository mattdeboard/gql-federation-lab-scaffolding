import { fileURLToPath } from 'node:url';
import { openDb } from '@lab/shared/db';
import { generateId } from '@lab/shared/ids';

const connection = openDb('daily-logs', fileURLToPath(new URL('../db/daily-logs.sqlite', import.meta.url)));

export type DailyLogStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED';

export interface ProjectEntity {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface DailyLogEntity {
  id: string;
  projectId: string;
  date: string; // YYYY-MM-DD
  status: DailyLogStatus;
  createdBy: string; // a user owned by the users subgraph
}

const getProjectTable = () => connection<ProjectEntity>('projects');
const getDailyLogTable = () => connection<DailyLogEntity>('daily_logs');

// ---------- projects ----------

export async function getProjectById(id: string) {
  return await getProjectTable().where({ id }).first();
}

// Rows come back in whatever order SQLite returns them, not the order of `ids`,
// and missing ids are simply absent.
export async function getProjectsByIds(ids: readonly string[]) {
  return await getProjectTable().select().whereIn('id', ids);
}

export async function listProjects() {
  return await getProjectTable().select().orderBy('id');
}

// ---------- daily logs ----------

export async function getDailyLogById(id: string) {
  return await getDailyLogTable().where({ id }).first();
}

// Rows come back in whatever order SQLite returns them, not the order of `ids`,
// and missing ids are simply absent.
export async function getDailyLogsByIds(ids: readonly string[]) {
  return await getDailyLogTable().select().whereIn('id', ids);
}

export async function getDailyLogsByProjectId(projectId: string) {
  return await getDailyLogTable().select().where({ projectId }).orderBy('date');
}

// Any combination of filters; an empty object returns every log.
export async function getDailyLogsBy(filters: {
  projectId?: string;
  date?: string;
  status?: DailyLogStatus;
}) {
  return await getDailyLogTable().select().where(filters).orderBy('date');
}

export async function createDailyLog(log: Omit<DailyLogEntity, 'id'>) {
  const row: DailyLogEntity = { id: generateId('log'), ...log };
  await getDailyLogTable().insert(row);
  return row;
}

// Returns the updated log, or undefined if there's no log with that id.
export async function updateDailyLogStatus(id: string, status: DailyLogStatus) {
  await getDailyLogTable().where({ id }).update({ status });
  return await getDailyLogById(id);
}
