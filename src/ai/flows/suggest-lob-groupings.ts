// The directive tells Next.js it's a server-side module.
'use server';

/**
 * @fileOverview This file defines a Genkit flow for suggesting optimal groupings of Lines of Business (LoBs)
 * based on historical capacity usage patterns.
 *
 * - suggestLoBGroupings - The main function to trigger the grouping suggestion flow.
 * - SuggestLoBGroupingsInput - The input type for the suggestLoBGroupings function.
 * - SuggestLoBGroupingsOutput - The output type for the suggestLoBGroupings function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Define the input schema for the flow.
const SuggestLoBGroupingsInputSchema = z.object({
  historicalCapacityData: z
    .string()
    .describe(
      'Historical capacity usage data for different Lines of Business, as a CSV string.'
    ),
  currentBusinessUnits: z
    .array(z.string())
    .describe('The list of current business units.'),
});
export type SuggestLoBGroupingsInput = z.infer<typeof SuggestLoBGroupingsInputSchema>;

// Define the output schema for the flow.
const SuggestLoBGroupingsOutputSchema = z.object({
  suggestedGroupings: z
    .array(z.array(z.string()))
    .describe(
      'Suggested groupings of Lines of Business based on historical capacity usage patterns.'
    ),
  reasoning: z
    .string()
    .describe(
      'The reasoning behind the suggested groupings, explaining the synergies and potential benefits.'
    ),
});
export type SuggestLoBGroupingsOutput = z.infer<typeof SuggestLoBGroupingsOutputSchema>;

// Exported function to trigger the flow
export async function suggestLoBGroupings(
  input: SuggestLoBGroupingsInput
): Promise<SuggestLoBGroupingsOutput> {
  return suggestLoBGroupingsFlow(input);
}

// Define the prompt
const suggestLoBGroupingsPrompt = ai.definePrompt({
  name: 'suggestLoBGroupingsPrompt',
  input: {
    schema: SuggestLoBGroupingsInputSchema,
  },
  output: {
    schema: SuggestLoBGroupingsOutputSchema,
  },
  prompt: `You are an expert capacity planner. Given the historical capacity usage data for different Lines of Business (LoBs), suggest optimal groupings of LoBs to streamline resource allocation and identify potential synergies.

Consider the current business units: {{{currentBusinessUnits}}}.

Analyze the following historical capacity data:

{{{historicalCapacityData}}}

Provide the suggested groupings of LoBs and explain the reasoning behind these groupings. Focus on groupings that maximize resource utilization and minimize redundancy. Group similar business units together.

Format your response as a JSON object matching this schema:
{
  "suggestedGroupings": [["LoB1", "LoB2"], ["LoB3", "LoB4"]],
  "reasoning": "Explanation of why these groupings are optimal."
}
`,
});

// Define the Genkit flow
const suggestLoBGroupingsFlow = ai.defineFlow(
  {
    name: 'suggestLoBGroupingsFlow',
    inputSchema: SuggestLoBGroupingsInputSchema,
    outputSchema: SuggestLoBGroupingsOutputSchema,
  },
  async input => {
    const {output} = await suggestLoBGroupingsPrompt(input);
    return output!;
  }
);
