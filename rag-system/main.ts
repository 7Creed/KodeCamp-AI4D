import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import { InferenceClient } from '@huggingface/inference';
import { GoogleGenAI } from '@google/genai';
import { ChromaClient, CloudClient } from 'chromadb';

const {
  HF_API_KEY,
  EMBED_MODEL_NAME,
  GEMINI_API_KEY,
  LLM_MODEL_NAME,
  CHROMA_DB_HOST,
  CHROMA_DB_PORT,
  CHROMA_API_KEY,
  CHROMA_TENANT,
  CHROMA_DATABASE,
  RAG_DATA_DIR,
  RAG_CHUNK_LENGTH,
  SERVER_PORT,
} = process.env;

if (!HF_API_KEY || !EMBED_MODEL_NAME || !GEMINI_API_KEY || !LLM_MODEL_NAME) {
  throw new Error('Missing required API/model environment variables.');
}

const dataDir = RAG_DATA_DIR || './data';
const chunkLength = Number(RAG_CHUNK_LENGTH || 500);
const serverPort = Number(SERVER_PORT || 3000);

fs.mkdirSync(dataDir, { recursive: true });

const app = express();
app.use(express.json());

const upload = multer({ dest: dataDir });

const hf = new InferenceClient(HF_API_KEY);
const gemini = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

function createChromaClient() {
  const host = CHROMA_DB_HOST;
  const port = CHROMA_DB_PORT;

  if (host && port) {
    console.log(`Using Chroma server at ${host}:${port}`);

    return new ChromaClient({
      host,
      port: Number(port),
    });
  }

  if (CHROMA_API_KEY) {
    console.log('Using Chroma Cloud');

    return new CloudClient({
      apiKey: CHROMA_API_KEY,
      tenant: CHROMA_TENANT,
      database: CHROMA_DATABASE,
    });
  }

  return new ChromaClient({
    host: CHROMA_DB_HOST || 'localhost',
    port: Number(CHROMA_DB_PORT || 8000),
  });
}

const chroma = createChromaClient();

const collection = await chroma.getOrCreateCollection({
  name: 'rag_documents',
  embeddingFunction: null,
});

function chunkText(text: string, size: number) {
  const cleanText = text.replace(/\s+/g, ' ').trim();
  const chunks: string[] = [];

  for (let i = 0; i < cleanText.length; i += size) {
    const chunk = cleanText.slice(i, i + size).trim();
    if (chunk) chunks.push(chunk);
  }

  return chunks;
}

async function createEmbedding(text: string): Promise<number[]> {
  const result = await hf.featureExtraction({
    model: EMBED_MODEL_NAME!,
    inputs: text,
  });

  if (Array.isArray(result[0])) {
    return result[0] as number[];
  }

  return result as number[];
}

async function askGemini(query: string, context: string) {
  const prompt = `
          You are a helpful RAG assistant.
          Answer the user's question using only the provided context.
          If the answer is not in the context, say you do not know.

          Context:
          ${context}

          Question:
          ${query}
`;

  const response = await gemini.models.generateContent({
    model: LLM_MODEL_NAME!,
    contents: prompt,
  });

  return response.text;
}

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.post('/upload', upload.array('files'), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded.' });
    }

    let totalChunks = 0;

    for (const file of files) {
      const content = fs.readFileSync(file.path, 'utf-8');
      const chunks = chunkText(content, chunkLength);

      for (let index = 0; index < chunks.length; index++) {
        const chunk = chunks[index];
        const embedding = await createEmbedding(chunk);

        await collection.add({
          ids: [`${file.filename}-${index}`],
          documents: [chunk],
          embeddings: [embedding],
          metadatas: [
            {
              originalName: file.originalname,
              chunkIndex: index,
            },
          ],
        });

        totalChunks++;
      }
    }

    res.json({
      message: 'Files uploaded and indexed successfully.',
      chunks: totalChunks,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Upload failed.' });
  }
});

app.post('/prompt', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'query is required.' });
    }

    const queryEmbedding = await createEmbedding(query);

    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: 5,
    });

    const documents = results.documents?.[0] || [];
    const context = documents.join('\n\n');

    const answer = await askGemini(query, context);

    res.json({
      query,
      answer,
      sources: documents,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Prompt failed.' });
  }
});

app.listen(serverPort, () => {
  console.log(`RAG server running on port ${serverPort}`);
});
