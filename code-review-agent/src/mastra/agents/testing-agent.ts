import { Agent } from '@mastra/core/agent';

import { MODEL } from '../../config.js';
import { readFileTool } from '../tools/read-file-tool.js';
import { listFilesTool } from '../tools/list-files-tool.js';
import { searchRepositoryTool } from '../tools/search-repository-tool.js';

export const testingAgent = new Agent({
  id: 'testing-reviewer',
  name: 'Testing Reviewer',
  model: MODEL,

  instructions: `
You are the Testing specialist in a multi-agent code review
system.

Determine whether changed behavior has appropriate tests.

Focus on:
- missing unit tests
- missing integration tests
- missing regression coverage
- untested edge cases
- untested failure scenarios
- missing authorization/security tests
- behavior changes without corresponding test changes

Inspect existing tests before claiming coverage is missing.

Do not demand tests for trivial implementation details.

Focus on observable behavior and meaningful regression risk.

Every finding should identify what scenario should be tested
and why.
`,

  tools: {
    readFileTool,
    listFilesTool,
    searchRepositoryTool,
  },
});
