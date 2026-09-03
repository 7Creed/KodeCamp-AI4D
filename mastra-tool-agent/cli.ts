import 'dotenv/config';

import readline from 'node:readline';
import { randomUUID } from 'node:crypto';
import { mastra } from './src/mastra/index.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const resourceId = 'cli-user';
const threadId = `cli-thread-${randomUUID()}`;

const agent = mastra.getAgent('assistantAgent');

function promptUser(): Promise<string> {
  return new Promise((resolve) => {
    rl.question('\nYou: ', (answer) => {
      resolve(answer.trim());
    });
  });
}

async function streamResponse(prompt: string): Promise<void> {
  const stream = await agent.stream(prompt, {
    memory: {
      resource: resourceId,
      thread: threadId,
    },
  });

  process.stdout.write('\nAssistant: ');

  for await (const chunk of stream.textStream) {
    process.stdout.write(chunk);
  }

  process.stdout.write('\n');
}

async function main() {
  console.log('Mastra CLI Assistant');
  console.log('Type your message and press Enter.');
  console.log('Type "exit" or press Ctrl+C to quit.');

  while (true) {
    const input = await promptUser();

    if (!input) {
      continue;
    }

    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
      break;
    }

    try {
      await streamResponse(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      console.error(`\nError: ${message}`);
    }
  }

  rl.close();

  console.log('\nGoodbye.');
}

process.on('SIGINT', () => {
  console.log('\n\nGoodbye.');
  rl.close();
  process.exit(0);
});

main().catch((error) => {
  console.error('Fatal error:', error);
  rl.close();
  process.exit(1);
});
