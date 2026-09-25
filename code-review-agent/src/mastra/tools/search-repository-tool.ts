import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { searchRepository } from '../../review/repository.js';

export const searchRepositoryTool = createTool({
  id: 'search-repository',

  description:
    'Search repository files for code, symbols, names, or text relevant to the current review.',

  inputSchema: z.object({
    repositoryPath: z.string(),
    query: z.string(),
    maxResults: z.number().int().min(1).max(50).default(20),
  }),

  outputSchema: z.object({
    results: z.array(
      z.object({
        file: z.string(),
        line: z.number(),
        content: z.string(),
      }),
    ),
  }),

  execute: async ({ repositoryPath, query, maxResults }) => {
    const results = await searchRepository(repositoryPath, query, maxResults);

    return { results };
  },
});
