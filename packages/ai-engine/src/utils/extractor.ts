import { groq } from '@ai-sdk/groq';
import { generateText, Output } from 'ai';
import { z } from 'zod';

export type ExtractionResult<T> = {
  output: T;
  rawText: string;
};

export async function extractContent<T extends z.ZodType>(
  text: string,
  schema: T
): Promise<ExtractionResult<z.infer<T>>> {
  const result = await generateText({
    model: groq('qwen/qwen3.8-27b'),
    output: Output.object({ schema }),
    prompt: text,
    temperature: 0,
  });

  if (result.output === undefined || result.output === null) {
    throw new Error('Extraction produced no output.');
  }

  return {
    output: result.output as z.infer<T>,
    rawText: result.text,
  };
}
