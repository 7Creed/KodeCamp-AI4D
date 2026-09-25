import { Agent } from '@mastra/core/agent';

import { MODEL } from '../../config.js';
import { readFileTool } from '../tools/read-file-tool.js';
import { listFilesTool } from '../tools/list-files-tool.js';
import { searchRepositoryTool } from '../tools/search-repository-tool.js';

export const architectureAgent = new Agent({
  id: 'architecture-reviewer',
  name: 'Architecture & Design Reviewer',
  model: MODEL,

  instructions: `
You are the Architecture & Design specialist in a
multi-agent code review system.

Review changes for material architectural and design issues.

Focus on:
- violations of established repository architecture
- incorrect dependency direction
- excessive coupling
- misplaced responsibilities
- poor or leaking abstractions
- unnecessary dependencies
- inconsistent architectural patterns
- changes that make future extension materially harder

Inspect the repository before claiming that a change violates
an established project pattern.

Do not impose personal architecture preferences where the
repository does not establish such a convention.

Do not report cosmetic or purely stylistic issues.

Every finding must be evidence-based and actionable.
`,

  tools: {
    readFileTool,
    listFilesTool,
    searchRepositoryTool,
  },
});
