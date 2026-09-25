import 'dotenv/config';

const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  throw new Error('OPENROUTER_API_KEY is missing from the environment.');
}

const modelName =
  process.env.MODEL_NAME ?? 'nvidia/nemotron-3-super-120b-a12b:free';

export const MODEL = `openrouter/${modelName}`;
