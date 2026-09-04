import 'dotenv/config';

import { Agent } from '@mastra/core/agent';

import { flightTool } from '../tools/flight-tool.js';
import { hotelTool } from '../tools/hotel-tool.js';
import { currencyTool } from '../tools/currency-tool.js';
import { ragTool } from '../tools/rag-tool.js';
import { agentMemory } from '../memory.js';

const MODEL_NAME =
  process.env.MODEL_NAME ?? 'nvidia/nemotron-3-super-120b-a12b:free';

const MODEL = `openrouter/${MODEL_NAME}`;

if (!process.env.OPENROUTER_API_KEY) {
  throw new Error('OPENROUTER_API_KEY is missing from the .env file.');
}

export const assistantAgent = new Agent({
  id: 'cli-assistant',

  name: 'CLI Assistant',

  instructions: `
You are a helpful command-line AI assistant.

You have four tools:

1. A flight schedule tool.
2. A hotel schedule tool.
3. A currency conversion tool.
4. An internal-information search tool.

Use tools whenever they are necessary to answer the user's question.

For questions about internal company or document information,
use the internal-information search tool before answering.

For travel calculations, use the flight and hotel tools rather than
inventing prices or schedules.

When converting monetary values, use the currency tool.

Keep responses clear, useful, and concise.
`,

  model: MODEL,

  tools: {
    flightTool,
    hotelTool,
    currencyTool,
    ragTool,
  },

  memory: agentMemory,
});
