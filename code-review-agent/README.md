# Code Review Agent

An agentic multi-specialist code review system built with
TypeScript and Mastra.

The application analyzes Git changes, dynamically selects relevant
review specialists, consolidates findings, and produces a merge
recommendation.

## Features

- Supervisor-driven specialist selection
- Correctness & Logic reviewer
- Security reviewer
- Architecture & Design reviewer
- Performance & Scalability reviewer
- Code Quality & Maintainability reviewer
- Testing reviewer
- Repository-wide inspection tools
- Structured severity and confidence
- Finding deduplication
- High-severity cross-validation
- Deterministic merge recommendations
- Working-tree review
- Commit review
- Raw Git diff review
- Public GitHub pull-request review
- Persistent review history
- Filtering by severity, category, and file
- Web dashboard

## Architecture

```text
Review Target
     |
     v
Target Resolver
     |
     v
Code Review Supervisor
     |
     +---- Correctness Agent
     +---- Security Agent
     +---- Architecture Agent
     +---- Performance Agent
     +---- Quality Agent
     +---- Testing Agent
     |
     v
Finding Consolidation
     |
     v
Cross-validation
     |
     v
Merge Recommendation
```

The supervisor selects only specialists relevant to the submitted
change. Specialists can use repository tools to inspect files beyond
the modified diff when additional context is required.

### Recommendation Rules

| Finding | Recommendation |
| --- | --- |
| Critical | BLOCK MERGE |
| High | REQUEST CHANGES |
| Medium/Low/Suggestion | APPROVE WITH COMMENTS |
| No findings | APPROVE |

## Requirements

- Node.js 20+
- npm
- Git
- OpenRouter API key

## Installation

```bash
git clone <repository-url>
cd code-review-agent
npm install
cp .env.example .env
```

Configure `.env`:

```env
OPENROUTER_API_KEY=your_openrouter_api_key
MODEL_NAME=nvidia/nemotron-3-super-120b-a12b:free
```

Do not include `openrouter/` in `MODEL_NAME`. The application adds
the provider prefix internally.

### Run the Web Application

```bash
npm run ui
```

Open:

```text
http://localhost:3000
```

### Mastra Development Environment

```bash
npm run dev
```

### CLI Review

```bash
npm run review
```

### Type Checking

```bash
npm run typecheck
```

## Review Targets

### Working Changes

Provide the path to a local or cloned Git repository. The application
reviews its uncommitted working-tree diff.

### Commit

Provide a repository path and Git commit SHA/reference.

### Raw Diff

Provide a repository path for contextual inspection and paste a Git
diff directly into the interface.

### Pull Request

Provide the local/cloned repository path and a public GitHub pull
request URL. The PR diff is retrieved from GitHub while specialists
can inspect the local repository for additional context.

## Finding Format

Each finding contains:

- Title
- Category
- Severity
- Confidence
- File/location where available
- Explanation
- Impact
- Recommended fix
- Producing specialist
- Cross-validation information

## Review History

Completed reviews are stored locally under `data/reviews/`.
This directory is ignored by Git.

## Evaluation

Five known-issue repositories are available under `evaluation/`:

1. Correctness regression
2. SQL injection
3. Sequential/N+1 database access
4. Architecture boundary violation
5. Missing/stale test coverage

See `evaluation/README.md` for expected outcomes.

## Environment Variables

See `.env.example`.

Never commit `.env` or API credentials.

## Limitations

- Pull-request fetching currently supports public GitHub PR URLs.
- LLM availability and rate limits depend on the configured
  OpenRouter model/provider.
- Findings should be treated as review assistance rather than a
  substitute for automated tests, static analysis, or human review.
