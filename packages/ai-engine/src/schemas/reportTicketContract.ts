import { z } from 'zod';

export const REPORT_STATUS_PENDING = 'PENDING' as const;

export const REPORT_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;

export type ReportPriority = (typeof REPORT_PRIORITIES)[number];

export const REPORT_CATEGORIES = [
  'EMERGENCY',
  'SECURITY',
  'SAFETY_HAZARD',
  'STRUCTURAL',
  'ACCESS',
  'UNKNOWN',
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  EMERGENCY: 'Emergency',
  SECURITY: 'Security',
  SAFETY_HAZARD: 'Safety Hazard',
  STRUCTURAL: 'Structural',
  ACCESS: 'Access',
  UNKNOWN: 'Unknown',
};

export const ReportTicketSchema = z.object({
  category: z
    .enum(REPORT_CATEGORIES)
    .describe('Best matching security report category for the guard message'),
  priority: z
    .enum(REPORT_PRIORITIES)
    .describe(
      'Severity. HIGH for immediate danger, injury risk, active crime, or fire. MEDIUM for important but contained incidents. LOW for minor or informational reports.'
    ),
});

export type ReportFields = z.infer<typeof ReportTicketSchema>;

export type ReportTicket = ReportFields & {
  userId: number;
  status: typeof REPORT_STATUS_PENDING;
  originalMessage: string;
  /** Exact text returned by the model (raw Groq JSON string). */
  modelOutputRaw: string;
};
