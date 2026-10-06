import 'dotenv/config';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import {
  REPORT_CATEGORIES,
  REPORT_MANAGER_AGENT,
  REPORT_PRIORITIES,
  REPORT_STATUS_PENDING,
  runReportManager,
  type ReportTicket,
} from '@repo/ai-engine';
import { z } from 'zod';
import {
  getReportById,
  insertReport,
  listReportCategories,
  listReports,
  listUsers,
  type ReportRecord,
} from './db.js';

const app = new Hono();

app.use('/*', serveStatic({ root: './public' }));

const RequestSchema = z.object({
  userId: z.number().int().positive({ message: 'userId must be a positive integer' }),
  text: z.string().trim().min(1, { message: 'text is required' }),
});

const ReportAuditSchema = z.object({
  userId: z.number().int().positive({ message: 'userId missing' }),
  originalMessage: z.string().min(1, { message: 'originalMessage missing' }),
  modelOutputRaw: z.string().min(1, { message: 'modelOutputRaw missing' }),
  category: z.enum(REPORT_CATEGORIES),
  status: z.literal(REPORT_STATUS_PENDING),
  priority: z.enum(REPORT_PRIORITIES),
});

type ReportManagerResponse = {
  agent: typeof REPORT_MANAGER_AGENT;
  action: string;
  data?: ReportTicket;
  record?: ReportRecord;
  records?: ReportRecord[];
  error?: string;
};

app.get('/api/categories', (c) => {
  return c.json({ categories: listReportCategories() });
});

app.get('/api/users', (c) => {
  return c.json({ users: listUsers() });
});

app.get('/api/records', (c) => {
  return c.json({ records: listReports() });
});

app.get('/api/records/:id', (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Invalid report id' }, 400);
  }

  const record = getReportById(id);
  if (!record) {
    return c.json({ error: 'Report not found' }, 404);
  }

  return c.json({ record });
});

app.post('/api/reportManager', async (c) => {
  try {
    const payload = RequestSchema.safeParse(await c.req.json());

    if (!payload.success) {
      const message = payload.error.issues.map((issue) => issue.message).join(', ');
      return c.json({ error: message }, 400);
    }

    const { userId, text } = payload.data;
    const ticket = await runReportManager(userId, text);
    const audit = ReportAuditSchema.safeParse(ticket);

    if (!audit.success) {
      const missingFields = audit.error.issues.map((issue) => issue.message).join(', ');
      const body: ReportManagerResponse = {
        agent: REPORT_MANAGER_AGENT,
        action: 'rejected',
        error: `Report rejected. Insufficient data: ${missingFields}`,
      };
      return c.json(body, 422);
    }

    const record = insertReport(ticket);
    const body: ReportManagerResponse = {
      agent: REPORT_MANAGER_AGENT,
      action: 'created',
      data: ticket,
      record,
      records: listReports(),
    };
    return c.json(body, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Request failed';
    return c.json({ error: message }, 500);
  }
});

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(`\n🚀 AI Reports Manager live at http://localhost:${info.port}\n`);
});
