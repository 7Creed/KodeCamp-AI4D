import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { readRepositoryFile } from '../../review/repository.js';

export const readFileTool = createTool({
  id: 'read-repository-file',

  description: 'Read a file from the repository being reviewed.',

  inputSchema: z.object({
    repositoryPath: z.string(),
    filePath: z.string(),
  }),

  outputSchema: z.object({
    filePath: z.string(),
    content: z.string(),
  }),

  execute: async ({ repositoryPath, filePath }) => {
    const content = await readRepositoryFile(repositoryPath, filePath);

    return {
      filePath,
      content,
    };
  },
});
