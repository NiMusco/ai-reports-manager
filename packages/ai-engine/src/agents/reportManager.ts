import { extractContent } from '../utils/extractor.js';
import {
  REPORT_CATEGORIES,
  REPORT_CATEGORY_LABELS,
  REPORT_STATUS_PENDING,
  ReportTicketSchema,
  type ReportTicket,
} from '../schemas/reportTicketContract.js';

export const REPORT_MANAGER_AGENT = 'reportManager' as const;

export async function runReportManager(userId: number, text: string): Promise<ReportTicket> {
  const categoryGuide = REPORT_CATEGORIES.map(
    (category) => `- ${category}: ${REPORT_CATEGORY_LABELS[category]}`
  ).join('\n');

  const { output, rawText } = await extractContent(
    [
      'You are reportManager, an agent that files field security guard reports.',
      'Keep the user message as-is. Do not rewrite it.',
      'Choose the single best category for daily guard work:',
      categoryGuide,
      'Category guidance:',
      '- EMERGENCY: fire, smoke, medical, or any urgent life-safety situation',
      '- SECURITY: trespassing, theft, vandalism, assault, forced entry, perimeter issues',
      '- SAFETY_HAZARD: unsafe conditions found on site',
      '- STRUCTURAL: floods, leaks, broken elevators, damaged doors, facility or building issues',
      '- ACCESS: guest entry, visitor check-in, letting someone in, badge or entry authorization',
      '- UNKNOWN: anything that does not clearly fit the above',
      'Assign priority:',
      '- HIGH: immediate danger, injury risk, active crime, fire, or urgent emergency',
      '- MEDIUM: notable incident that needs follow-up soon but is contained',
      '- LOW: routine or informational report',
      'Status is always handled by the system as PENDING.',
      '',
      `Guard message:\n${text}`,
    ].join('\n'),
    ReportTicketSchema
  );

  return {
    userId,
    status: REPORT_STATUS_PENDING,
    originalMessage: text,
    modelOutputRaw: rawText,
    ...output,
  };
}
