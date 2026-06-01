import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface OpenRouterResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

console.log('Starting application...');
console.log('API KEY EXISTS:', !!process.env.OPENROUTER_API_KEY);
console.log('MODEL:', process.env.MODEL_NAME);

const BASE_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL_NAME = process.env.MODEL_NAME;

if (!API_KEY || !MODEL_NAME) {
  throw new Error('API key and model name must be set in the .env file');
}

function loadPrompt(filePath: string) {
  return fs.readFileSync(filePath, 'utf-8');
}

async function callOpenRouterAPI(prompt: string): Promise<string> {
  const response = await fetch(BASE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`API call failed with status ${response.status}`);
  }

  const data = (await response.json()) as OpenRouterResponse;
  return data.choices[0].message.content;
}

async function promptChain() {
  try {
    const customerQuery = process.argv.slice(2).join(' ');
    if (!customerQuery) {
      console.error(
        'Please provide a customer query as a command-line argument.',
      );
      process.exit(1);
    }

    const prompt1 = loadPrompt(
      path.join(__dirname, 'prompts/1_intent.txt'),
    ).replace('{customer_query}', customerQuery);

    const intentOutput = await callOpenRouterAPI(prompt1);

    console.log('\n=== STEP 1: INTENT ===');
    console.log(intentOutput);

    const prompt2 = loadPrompt(
      path.join(__dirname, 'prompts/2_categories.txt'),
    ).replace('{intent_output}', intentOutput);

    const categoriesOutput = await callOpenRouterAPI(prompt2);
    console.log('\n=== STEP 2: CATEGORIES ===');
    console.log(categoriesOutput);

    console.log('Prompt chain started');
    console.log('Customer query:', customerQuery);

    const prompt3 = loadPrompt(
      path.join(__dirname, 'prompts/3_best_categories.txt'),
    )
      .replace('{intent_output}', intentOutput)
      .replace('{categoriesOutput}', categoriesOutput);

    const bestCategoriesOutput = await callOpenRouterAPI(prompt3);
    console.log('\n=== STEP 3: BEST CATEGORIES ===');
    console.log(bestCategoriesOutput);

    const prompt4 = loadPrompt(
      path.join(__dirname, 'prompts/4_extract_details.txt'),
    )
      .replace('{customer_query}', customerQuery)
      .replace('{best_categories_output}', bestCategoriesOutput);

    const detailsOutput = await callOpenRouterAPI(prompt4);
    console.log('\n=== STEP 4: EXTRACT DETAILS ===');
    console.log(detailsOutput);

    const prompt5 = loadPrompt(
      path.join(__dirname, 'prompts/5_generate_response.txt'),
    )
      .replace('{customer_query}', customerQuery)
      .replace('{best_categories_output}', bestCategoriesOutput)
      .replace('{details_output}', detailsOutput);

    const finalResponse = await callOpenRouterAPI(prompt5);
    console.log('\n=== FINAL RESPONSE ===');
    console.log(finalResponse);
  } catch (error) {
    console.error('Error:', error);
  }
}

promptChain();

// async function main() {
//   const customerQuery = process.argv.slice(2).join(' ');
//   if (!customerQuery) {
//     console.error(
//       'Please provide a customer query as a command-line argument.',
//     );
//     process.exit(1);
//   }

//   try {
//     const response = await callOpenRouterAPI(customerQuery);
//     console.log('Response from OpenRouter API:', response);
//   } catch (error) {
//     console.error('Error calling OpenRouter API:', error);
//   }
// }

// main();
