import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import fs from 'fs';
import path from 'path';

type SearchResult = {
  source: string;
  content: string;
  score: number;
};

const DATA_DIR = path.resolve(process.cwd(), 'data');

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function scoreText(query: string, text: string): number {
  const queryTokens = tokenize(query);
  const documentTokens = new Set(tokenize(text));

  if (queryTokens.length === 0) {
    return 0;
  }

  let matches = 0;

  for (const token of queryTokens) {
    if (documentTokens.has(token)) {
      matches++;
    }
  }

  return matches / queryTokens.length;
}

function loadDocuments(): Array<{
  source: string;
  content: string;
}> {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const files = fs
    .readdirSync(DATA_DIR)
    .filter((file) => file.endsWith('.txt') || file.endsWith('.md'));

  return files.map((file) => {
    const fullPath = path.join(DATA_DIR, file);

    return {
      source: file,
      content: fs.readFileSync(fullPath, 'utf-8'),
    };
  });
}

function searchDocuments(query: string): SearchResult[] {
  const documents = loadDocuments();

  return documents
    .map((document) => ({
      ...document,
      score: scoreText(query, document.content),
    }))
    .filter((document) => document.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export const ragTool = createTool({
  id: 'search-internal-information',

  description:
    'Searches internal documents in the local data directory for information relevant to a user question.',

  inputSchema: z.object({
    query: z.string(),
  }),

  outputSchema: z.object({
    query: z.string(),
    results: z.array(
      z.object({
        source: z.string(),
        content: z.string(),
        score: z.number(),
      }),
    ),
  }),

  execute: async ({ query }) => {
    const results = searchDocuments(query);

    return {
      query,
      results,
    };
  },
});
