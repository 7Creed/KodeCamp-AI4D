import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';

export const agentMemory = new Memory({
  storage: new LibSQLStore({
    id: 'assistant-memory',
    url: 'file:./assistant-memory.db',
  }),

  options: {
    lastMessages: 20,
  },
});
