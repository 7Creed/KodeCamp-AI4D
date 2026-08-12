# Tool-Augmented RAG Agent (LangChain + LangGraph, TypeScript)

A LangChain/LangGraph agent that combines tool use with hybrid
(BM25 + vector) retrieval-augmented generation and persistent
conversation memory.

## Features

- **4 tools available to the agent:**
  1. `getUserProfile(user_id)`
  2. `searchDocuments(query)`
  3. `getCurrentTemperature(city)`
  4. `queryInternalKnowledge(query)` — hybrid RAG over `data/` and past conversation turns
- **Embeddings:** HuggingFace `sentence-transformers/all-MiniLM-L6-v2` (via the HF Inference API)
- **Reasoning model:** OpenRouter `nvidia/nemotron-3-nano-30b-a3b:free`
- **Vector store:** ChromaDB (via a local/remote Chroma server)
- **Hybrid retrieval:** BM25 keyword search + Chroma vector search, combined via LangChain's `EnsembleRetriever`
- **Memory:**
  - Short-term / per-thread agent memory via LangGraph's `MemorySaver` checkpointer
  - Long-term memory: every **conversation turn** (user + assistant messages — not the agent's internal tool-call trace) is embedded and stored in the same Chroma collection, retrievable later through `queryInternalKnowledge`
- Auto-indexes any `.txt`, `.md`, `.pdf`, `.csv`, or `.docx` file placed in `data/`
- No web server (no Express/Fastify) — everything prints straight to stdout

## Setup

```bash
git clone <this-repo-url>
cd rag-agent-tools-memory
npm install
cp .env-example .env
# then edit .env and fill in OPENROUTER_API_KEY and HF_API_KEY
```

This project uses Chroma's client/server mode, so a Chroma server needs
to be running before you invoke the agent:

```bash
# easiest option — Docker
docker run -p 8000:8000 chromadb/chroma

# or, if you have the Python chromadb CLI installed
chroma run --path ./chroma_db
```

`CHROMA_URL` in `.env` defaults to `http://localhost:8000`.

Drop any reference documents you want the agent to know about into the
`data/` folder (created automatically if missing) — they're loaded and
indexed automatically on startup.

## Usage

```bash
npx tsx main.ts "What is the weather in Jos?"
```

or, after building:

```bash
npm run build
node dist/main.js "What is the weather in Jos?"
```

This prints the full conversation history (including tool calls/results
made along the way) followed by the final response.

## Environment Variables

| Variable | Required | Default |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | — |
| `HF_API_KEY` | Yes | — |
| `OPENROUTER_MODEL` | No | `nvidia/nemotron-3-nano-30b-a3b:free` |
| `OPENROUTER_BASE_URL` | No | `https://openrouter.ai/api/v1` |
| `HF_EMBEDDING_MODEL` | No | `sentence-transformers/all-MiniLM-L6-v2` |
| `RAG_CHUNK_SIZE` | No | `500` |
| `RAG_CHUNK_OVERLAP` | No | `50` |
| `RAG_TOP_K` | No | `4` |
| `AGENT_SESSION_ID` | No | `default-session` |
| `CHROMA_URL` | No | `http://localhost:8000` |

## Project Layout

```
.
├── main.ts       # CLI entry point
├── agent.ts      # Agent construction + invocation + memory wiring
├── tools.ts      # The 4 tool definitions
├── rag.ts        # Document loading/indexing + hybrid retriever + conversation persistence
├── data/         # Drop documents here to be indexed
├── package.json
├── tsconfig.json
├── .env-example
└── .gitignore
```

## Notes

- Because every conversation turn is written into the vector store as a
  `conversation_history`-typed document, asking the agent something like
  *"what did I ask you earlier?"* will surface past turns via the RAG tool.
- The Chroma collection persists between invocations (as long as the
  server itself persists data), so indexed documents and conversation
  history survive across process runs.
