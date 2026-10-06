import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  REPORT_CATEGORIES,
  REPORT_CATEGORY_LABELS,
  type ReportCategory,
  type ReportTicket,
} from '@repo/ai-engine';

const dataDir = join(process.cwd(), 'data');
mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(join(dataDir, 'playground.db'));

export type UserRecord = {
  id: number;
  name: string;
  picture: string;
};

export type ReportCategoryRecord = {
  id: string;
  label: string;
};

export type ReportRecord = {
  id: number;
  userId: number;
  userPicture: string;
  originalMessage: string;
  category: ReportCategory;
  status: string;
  priority: string;
  /** Exact raw model text from Groq. */
  modelOutput: string;
  createdAt: string;
};

const SEED_USERS: Array<Omit<UserRecord, 'id'> & { id: number }> = [
  {
    id: 1,
    name: 'Alex Rivera',
    picture: 'https://i.pravatar.cc/96?img=12',
  },
  {
    id: 2,
    name: 'Sam Ortiz',
    picture: 'https://i.pravatar.cc/96?img=32',
  },
  {
    id: 3,
    name: 'Jordan Lee',
    picture: 'https://i.pravatar.cc/96?img=47',
  },
  {
    id: 4,
    name: 'Casey Morgan',
    picture: 'https://i.pravatar.cc/96?img=15',
  },
];

migrateSchema();
seedUsers();
seedReportCategories();

function nowIso(): string {
  return new Date().toISOString();
}

function tableColumns(table: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return new Set(rows.map((row) => row.name));
}

function createReportsTable(): void {
  db.exec(`
    CREATE TABLE reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      original_message TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      model_output TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
  `);
}

function migrateSchema(): void {
  db.exec(`DROP TABLE IF EXISTS incidents`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      picture TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS report_categories (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `);

  const categoryColumns = tableColumns('report_categories');
  if (!categoryColumns.has('sort_order')) {
    db.exec(`ALTER TABLE report_categories ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`);
  }

  const tables = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'reports'`)
    .get() as { name: string } | undefined;

  if (!tables) {
    createReportsTable();
    return;
  }

  const columns = tableColumns('reports');
  if (
    columns.has('issue_summary') ||
    !columns.has('original_message') ||
    !columns.has('category')
  ) {
    db.exec(`DROP TABLE reports`);
    createReportsTable();
    return;
  }

  if (!columns.has('model_output')) {
    db.exec(`ALTER TABLE reports ADD COLUMN model_output TEXT NOT NULL DEFAULT '{}'`);
    db.exec(`
      UPDATE reports
      SET model_output = json_object('category', category, 'priority', priority)
      WHERE model_output = '{}' OR model_output IS NULL OR model_output = ''
    `);
  }
}

function seedUsers(): void {
  const upsert = db.prepare(
    `INSERT INTO users (id, name, picture) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, picture = excluded.picture`
  );

  for (const user of SEED_USERS) {
    upsert.run(user.id, user.name, user.picture);
  }
}

function seedReportCategories(): void {
  const upsert = db.prepare(
    `INSERT INTO report_categories (id, label, sort_order) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET label = excluded.label, sort_order = excluded.sort_order`
  );

  REPORT_CATEGORIES.forEach((id, index) => {
    upsert.run(id, REPORT_CATEGORY_LABELS[id], index);
  });

  const placeholders = REPORT_CATEGORIES.map(() => '?').join(', ');
  db.prepare(`DELETE FROM report_categories WHERE id NOT IN (${placeholders})`).run(
    ...REPORT_CATEGORIES
  );

  const remap = db.prepare(`UPDATE reports SET category = ? WHERE category = ?`);
  remap.run('SECURITY', 'SECURITY_BREACH');
  remap.run('UNKNOWN', 'OTHER');
  remap.run('UNKNOWN', 'PATROL');
  remap.run('SECURITY', 'SUSPICIOUS_ACTIVITY');
}

const SELECT_REPORT = `
  reports.id AS id,
  reports.user_id AS userId,
  COALESCE(users.picture, '') AS userPicture,
  reports.original_message AS originalMessage,
  reports.category AS category,
  reports.status AS status,
  reports.priority AS priority,
  reports.model_output AS modelOutput,
  reports.created_at AS createdAt
`;

type ReportRow = ReportRecord;

function mapReport(row: ReportRow): ReportRecord {
  return row;
}

export function listUsers(): UserRecord[] {
  return db
    .prepare(`SELECT id, name, picture FROM users ORDER BY id ASC`)
    .all() as UserRecord[];
}

export function getUserById(userId: number): UserRecord | undefined {
  return db
    .prepare(`SELECT id, name, picture FROM users WHERE id = ?`)
    .get(userId) as UserRecord | undefined;
}

export function listReportCategories(): ReportCategoryRecord[] {
  return db
    .prepare(`SELECT id, label FROM report_categories ORDER BY sort_order ASC, label ASC`)
    .all() as ReportCategoryRecord[];
}

export function insertReport(ticket: ReportTicket): ReportRecord {
  const createdAt = nowIso();
  const modelOutput = ticket.modelOutputRaw;

  const inserted = db
    .prepare(
      `INSERT INTO reports (
         user_id, original_message, category, status, priority, model_output, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING id`
    )
    .get(
      ticket.userId,
      ticket.originalMessage,
      ticket.category,
      ticket.status,
      ticket.priority,
      modelOutput,
      createdAt
    ) as { id: number };

  return getReportById(inserted.id)!;
}

export function getReportById(id: number): ReportRecord | undefined {
  const row = db
    .prepare(
      `SELECT ${SELECT_REPORT}
       FROM reports
       LEFT JOIN users ON users.id = reports.user_id
       WHERE reports.id = ?`
    )
    .get(id) as ReportRow | undefined;

  return row ? mapReport(row) : undefined;
}

export function listReports(): ReportRecord[] {
  const rows = db
    .prepare(
      `SELECT ${SELECT_REPORT}
       FROM reports
       LEFT JOIN users ON users.id = reports.user_id
       ORDER BY reports.id DESC
       LIMIT 100`
    )
    .all() as ReportRow[];

  return rows.map(mapReport);
}

export function listReportsByUserId(userId: number): ReportRecord[] {
  const rows = db
    .prepare(
      `SELECT ${SELECT_REPORT}
       FROM reports
       LEFT JOIN users ON users.id = reports.user_id
       WHERE reports.user_id = ?
       ORDER BY reports.id DESC
       LIMIT 100`
    )
    .all(userId) as ReportRow[];

  return rows.map(mapReport);
}
