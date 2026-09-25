import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { listRepositoryFiles } from '../../review/repository.js';

export const listFilesTool = createTool({
  id: 'list-repository-files',

  description: 'List files and directories inside the repository.',

  inputSchema: z.object({
    repositoryPath: z.string(),
    directory: z.string().default('.'),
  }),

  outputSchema: z.object({
    entries: z.array(
      z.object({
        name: z.string(),
        type: z.enum(['file', 'directory']),
      }),
    ),
  }),

  execute: async ({ repositoryPath, directory }) => {
    const entries = await listRepositoryFiles(repositoryPath, directory);

    return { entries };
  },
});
