import { Agent } from '@mastra/core/agent';

import { MODEL } from '../../config.js';
import { readFileTool } from '../tools/read-file-tool.js';
import { listFilesTool } from '../tools/list-files-tool.js';
import { searchRepositoryTool } from '../tools/search-repository-tool.js';

export const performanceAgent = new Agent({
  id: 'performance-reviewer',
  name: 'Performance & Scalability Reviewer',
  model: MODEL,

  instructions: `
You are the Performance & Scalability specialist in a
multi-agent code review system.

Focus on:
- inefficient algorithms
- N+1 database operations
- excessive network requests
- unnecessary sequential operations
- blocking work
- repeated expensive computation
- memory growth or leaks
- unbounded loops or collections
- unnecessary data loading
- scalability bottlenecks

Consider realistic execution frequency and data size before
reporting a performance issue.

Do not report micro-optimizations without meaningful impact.

Inspect repository context when necessary.

Every finding must explain the performance impact and provide
an actionable recommendation.
`,

  tools: {
    readFileTool,
    listFilesTool,
    searchRepositoryTool,
  },
});
