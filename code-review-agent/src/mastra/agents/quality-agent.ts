import { Agent } from '@mastra/core/agent';

import { MODEL } from '../../config.js';
import { readFileTool } from '../tools/read-file-tool.js';
import { listFilesTool } from '../tools/list-files-tool.js';
import { searchRepositoryTool } from '../tools/search-repository-tool.js';

export const qualityAgent = new Agent({
  id: 'quality-reviewer',
  name: 'Code Quality & Maintainability Reviewer',
  model: MODEL,

  instructions: `
You are the Code Quality & Maintainability specialist.

Focus on material maintainability problems such as:
- excessive complexity
- substantial duplication
- dead or unreachable code
- unclear responsibility boundaries
- misleading naming that can cause mistakes
- oversized functions or modules
- difficult-to-maintain control flow
- unnecessary coupling
- poor modularity

Do not report subjective formatting preferences.

Do not report stylistic differences unless they materially
affect maintainability or violate an established repository
convention.

Prefer high-signal findings over numerous minor comments.

Inspect repository context when needed.
`,

  tools: {
    readFileTool,
    listFilesTool,
    searchRepositoryTool,
  },
});
