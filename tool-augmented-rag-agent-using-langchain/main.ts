import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { CSVLoader } from '@langchain/community/document_loaders/fs/csv';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { HuggingFaceInferenceEmbeddings } from '@langchain/community/embeddings/hf';
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { BM25Retriever } from '@langchain/community/retrievers/bm25';
import { EnsembleRetriever } from 'langchain/retrievers/ensemble';
import type { BaseRetriever } from '@langchain/core/retrievers';

import { tool } from '@langchain/core/tools';
import { z } from 'zod';

import { ChatOpenAI } from '@langchain/openai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { MemorySaver } from '@langchain/langgraph';
import { HumanMessage, type BaseMessage } from '@langchain/core/messages';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');

const EMBEDDING_MODEL =
  process.env.HF_EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2';
const CHUNK_SIZE = Number(process.env.RAG_CHUNK_SIZE || 500);
const CHUNK_OVERLAP = Number(process.env.RAG_CHUNK_OVERLAP || 50);
const DEFAULT_K = Number(process.env.RAG_TOP_K || 4);

type LoaderFactory = (filePath: string) => { load(): Promise<Document[]> };

const LOADER_MAP: Record<string, LoaderFactory> = {
  '.txt': (p) => new TextLoader(p),
  '.md': (p) => new TextLoader(p),
  '.pdf': (p) => new PDFLoader(p),
  '.csv': (p) => new CSVLoader(p),
  '.docx': (p) => new DocxLoader(p),
};

class RAGManager {
  private embeddings: HuggingFaceInferenceEmbeddings;
  private textSplitter: RecursiveCharacterTextSplitter;
  private vectorStore: Chroma;
  private documents: Document[] = [];
  private bm25Retriever: BM25Retriever | null = null;
  private initPromise: Promise<void>;

  constructor() {
    this.embeddings = new HuggingFaceInferenceEmbeddings({
      apiKey: process.env.HF_API_KEY,
      model: EMBEDDING_MODEL,
    });

    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: CHUNK_SIZE,
      chunkOverlap: CHUNK_OVERLAP,
    });

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    this.vectorStore = new Chroma(this.embeddings, {
      collectionName: 'rag-collection',
      url: process.env.CHROMA_URL || 'http://localhost:8000',
    });

    this.initPromise = this.loadDataDir();
  }

  private async ensureReady(): Promise<void> {
    await this.initPromise;
  }

  private async loadFile(filePath: string): Promise<Document[]> {
    const ext = path.extname(filePath).toLowerCase();
    const loaderFactory = LOADER_MAP[ext];
    if (!loaderFactory) {
      console.warn(`⚠ Skipping unsupported file type: ${filePath}`);
      return [];
    }
    try {
      const loader = loaderFactory(filePath);
      const docs = await loader.load();
      docs.forEach((d) => {
        d.metadata.source = path.basename(filePath);
        d.metadata.type = 'document';
      });
      const chunks = await this.textSplitter.splitDocuments(docs);
      console.log(
        `✓ Loaded ${path.basename(filePath)}: ${chunks.length} chunks`,
      );
      return chunks;
    } catch (err: any) {
      console.error(`✗ Error loading ${filePath}: ${err.message}`);
      return [];
    }
  }

  private async loadDataDir(): Promise<void> {
    const entries = fs.existsSync(DATA_DIR) ? fs.readdirSync(DATA_DIR) : [];
    let allDocs: Document[] = [];
    for (const entry of entries) {
      if (entry === '.gitkeep') continue;
      const fullPath = path.join(DATA_DIR, entry);
      if (fs.statSync(fullPath).isFile()) {
        const docs = await this.loadFile(fullPath);
        allDocs = allDocs.concat(docs);
      }
    }
    if (allDocs.length > 0) {
      await this.addDocuments(allDocs);
    }
  }

  async addDocuments(docs: Document[]): Promise<void> {
    if (docs.length === 0) return;
    this.documents.push(...docs);
    await this.vectorStore.addDocuments(docs);
    this.rebuildBM25();
  }

  private rebuildBM25(): void {
    if (this.documents.length > 0) {
      this.bm25Retriever = BM25Retriever.fromDocuments(this.documents, {
        k: DEFAULT_K,
      });
    }
  }

  private getHybridRetriever(
    k: number = DEFAULT_K,
    weights: [number, number] = [0.5, 0.5],
  ): BaseRetriever {
    const vectorRetriever = this.vectorStore.asRetriever(k);
    if (this.bm25Retriever) {
      this.bm25Retriever.k = k;
      return new EnsembleRetriever({
        retrievers: [this.bm25Retriever, vectorRetriever],
        weights,
      });
    }
    return vectorRetriever;
  }

  async query(queryText: string, k: number = DEFAULT_K): Promise<string> {
    await this.ensureReady();
    const retriever = this.getHybridRetriever(k);
    const results = await retriever.invoke(queryText);
    if (!results || results.length === 0) {
      return 'No relevant internal information found.';
    }
    return results
      .map(
        (d: Document) =>
          `[Source: ${d.metadata.source || d.metadata.type || 'unknown'}]\n${d.pageContent}`,
      )
      .join('\n\n');
  }

  async saveConversationTurn(
    role: string,
    content: string,
    sessionId: string = 'default',
  ): Promise<void> {
    await this.ensureReady();
    if (!content) return;
    const doc = new Document({
      pageContent: `${role}: ${content}`,
      metadata: { type: 'conversation_history', role, session_id: sessionId },
    });
    await this.addDocuments([doc]);
  }
}

const ragManager = new RAGManager();

const getUserProfile = tool(
  async ({ user_id }: { user_id: string }) => {
    return JSON.stringify({
      user_id,
      name: 'John Doe',
      age: 30,
      city: 'New York',
    });
  },
  {
    name: 'get_user_profile',
    description: 'Get the profile of a user.',
    schema: z.object({
      user_id: z.string().describe('The ID of the user.'),
    }),
  },
);

const searchDocuments = tool(
  async ({ query }: { query: string }) => {
    return JSON.stringify([
      { document_id: 1, title: 'Document 1', content: 'This is document 1.' },
      { document_id: 2, title: 'Document 2', content: 'This is document 2.' },
    ]);
  },
  {
    name: 'search_documents',
    description: 'Search for documents based on a query.',
    schema: z.object({
      query: z.string().describe('The search query.'),
    }),
  },
);

const getCurrentTemperature = tool(
  async ({ city }: { city: string }) => {
    return '25.5';
  },
  {
    name: 'get_current_temperature',
    description: 'Get the current temperature in a given city.',
    schema: z.object({
      city: z.string().describe('The name of the city.'),
    }),
  },
);

const queryInternalKnowledge = tool(
  async ({ query }: { query: string }) => {
    return ragManager.query(query);
  },
  {
    name: 'query_internal_knowledge',
    description:
      'Query the internal knowledge base for information from documents placed ' +
      'in the data/ folder, as well as prior conversation history, using hybrid ' +
      '(BM25 + vector) retrieval. Use this for anything not covered by the other tools.',
    schema: z.object({
      query: z
        .string()
        .describe('A description of the internal information needed.'),
    }),
  },
);

const ALL_TOOLS = [
  getUserProfile,
  searchDocuments,
  getCurrentTemperature,
  queryInternalKnowledge,
];

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-nano-30b-a3b:free';
const OPENROUTER_BASE_URL =
  process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const DEFAULT_THREAD_ID = process.env.AGENT_SESSION_ID || 'default-session';

const checkpointer = new MemorySaver();

function buildLLM(): ChatOpenAI {
  return new ChatOpenAI({
    model: OPENROUTER_MODEL,
    apiKey: OPENROUTER_API_KEY,
    temperature: 0,
    configuration: {
      baseURL: OPENROUTER_BASE_URL,
    },
  });
}

function buildAgent() {
  const llm = buildLLM();
  return createReactAgent({
    llm,
    tools: ALL_TOOLS,
    checkpointSaver: checkpointer,
  });
}

function formatMessage(m: BaseMessage): string {
  const role =
    typeof m.getType === 'function' ? m.getType() : m.constructor.name;
  const content =
    typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
  return content ? `[${role}] ${content}` : `[${role}] <tool/empty content>`;
}

async function runAgent(
  prompt: string,
  threadId: string = DEFAULT_THREAD_ID,
): Promise<string> {
  const agent = buildAgent();
  const config = { configurable: { thread_id: threadId } };

  await ragManager.saveConversationTurn('user', prompt, threadId);

  const result = await agent.invoke(
    { messages: [new HumanMessage(prompt)] },
    config,
  );
  const messages: BaseMessage[] = result.messages;

  console.log('=== Full Conversation History ===');
  for (const m of messages) {
    console.log(formatMessage(m));
  }
  console.log();

  const finalMessage = messages[messages.length - 1];
  const finalContent =
    typeof finalMessage.content === 'string'
      ? finalMessage.content
      : JSON.stringify(finalMessage.content);

  await ragManager.saveConversationTurn('assistant', finalContent, threadId);

  console.log('=== Final Response ===');
  console.log(finalContent);

  return finalContent;
}

async function main() {
  const prompt = process.argv[2];
  if (!prompt) {
    console.log('Usage: npx tsx main.ts "<your prompt>"');
    process.exit(1);
  }
  await runAgent(prompt);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
