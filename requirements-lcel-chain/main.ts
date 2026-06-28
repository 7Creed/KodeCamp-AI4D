import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
// import { RunnableSequence } from '@langchain/core/runnables';
import { ChatOpenRouter } from '@langchain/openrouter';

const projectDescription = process.argv.slice(2).join(' ');

if (!projectDescription) {
  console.error('Usage: npm start "client project description"');
  process.exit(1);
}

if (!process.env.OPENROUTER_API_KEY || !process.env.MODEL_NAME) {
  console.error('Missing OPENROUTER_API_KEY or MODEL_NAME in .env');
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const llm = new ChatOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  model: process.env.MODEL_NAME,
});

const parser = new StringOutputParser();

function loadPrompt(fileName: string) {
  const promptPath = path.join(__dirname, 'prompts', fileName);
  return fs.readFileSync(promptPath, 'utf-8');
}
// function loadPrompt(fileName: string) {
//   return fs.readFileSync(path.join("prompts", fileName), "utf-8");
// }

function createChain(promptFile: string) {
  const prompt = PromptTemplate.fromTemplate(loadPrompt(promptFile));
  return prompt.pipe(llm).pipe(parser);
}

async function printStage(title: string, output: string) {
  console.log(`\n========== ${title} ==========\n`);
  console.log(output);
}

async function main() {
  const interpretChain = createChain('1_interpret.txt');
  const categoryChain = createChain('2_categories.txt');
  const bestCategoryChain = createChain('3_select_category.txt');
  const missingRequirementsChain = createChain('4_missing_requirements.txt');
  const assessmentChain = createChain('5_assessment.txt');

  const interpretation = await interpretChain.invoke({
    project_description: projectDescription,
  });
  await printStage('Stage 1: Interpret Project Request', interpretation);

  const possibleCategories = await categoryChain.invoke({
    project_description: projectDescription,
    interpretation,
  });
  await printStage('Stage 2: Identify Possible Categories', possibleCategories);

  const selectedCategory = await bestCategoryChain.invoke({
    project_description: projectDescription,
    interpretation,
    possible_categories: possibleCategories,
  });
  await printStage('Stage 3: Select Best Category', selectedCategory);

  const missingRequirements = await missingRequirementsChain.invoke({
    project_description: projectDescription,
    interpretation,
    selected_category: selectedCategory,
  });
  await printStage(
    'Stage 4: Extract Missing Requirements',
    missingRequirements,
  );

  const finalAssessment = await assessmentChain.invoke({
    project_description: projectDescription,
    interpretation,
    selected_category: selectedCategory,
    missing_requirements: missingRequirements,
  });

  await printStage('Stage 5: Generate Initial Assessment', finalAssessment);

  console.log('\n========== FINAL PROJECT ASSESSMENT ==========\n');
  console.log(finalAssessment);
}

main().catch((error) => {
  console.error('Error running LCEL chain:', error);
  process.exit(1);
});
