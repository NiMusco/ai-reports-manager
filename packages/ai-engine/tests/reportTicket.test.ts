import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import { extractContent } from '../src/utils/extractor.js';
import {
  REPORT_CATEGORIES,
  ReportTicketSchema,
} from '../src/schemas/reportTicketContract.js';

describe('Report Ticket Extractor Pipeline', () => {
  it('should extract category and priority from a security report', async () => {
    const input = 'Someone jumped the fence near gate B and is hiding behind the dumpsters';

    const result = await extractContent(input, ReportTicketSchema);

    expect(REPORT_CATEGORIES).toContain(result.output.category);
    expect(['LOW', 'MEDIUM', 'HIGH']).toContain(result.output.priority);
    expect(result.rawText.length).toBeGreaterThan(0);
    expect(result.output).not.toHaveProperty('userId');
    expect(result.output).not.toHaveProperty('status');
    expect(result.output).not.toHaveProperty('originalMessage');
  });

  it('should extract category and priority from an access report', async () => {
    const input = 'Let guest Maria Lopez into building C after verifying her ID at the front desk';

    const result = await extractContent(input, ReportTicketSchema);

    expect(REPORT_CATEGORIES).toContain(result.output.category);
    expect(['LOW', 'MEDIUM', 'HIGH']).toContain(result.output.priority);
    expect(result.rawText.length).toBeGreaterThan(0);
  });
});
