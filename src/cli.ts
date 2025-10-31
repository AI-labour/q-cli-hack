#!/usr/bin/env node

import { AuthManager } from './auth.js';
import { CodeWhispererClient } from './codewhisperer-client.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const authManager = new AuthManager();

  if (command === 'login') {
    console.log('Starting authentication...');
    await authManager.authenticate();
    console.log('Authentication complete!');
  } else if (command === 'test') {
    console.log('Testing CodeWhisperer API...');

    const token = await authManager.getValidToken();
    if (!token) {
      console.error('Not authenticated. Run: npm run cli login');
      process.exit(1);
    }

    const client = new CodeWhispererClient({
      tokenProvider: async () => token.access_token,
    });

    const question = args.slice(1).join(' ') || 'Hello, how are you?';
    console.log(`\nQuestion: ${question}\n`);

    console.log('Response:');
    for await (const event of client.generateAssistantResponse({
      conversationState: {
        currentMessage: {
          userInputMessage: {
            content: question,
            origin: 'CLI',
          },
        },
        chatTriggerType: 'Manual',
      },
    })) {
      if ('assistantResponseEvent' in event) {
        process.stdout.write(event.assistantResponseEvent.content);
      } else if ('codeEvent' in event) {
        process.stdout.write(event.codeEvent.content);
      } else if ('messageMetadataEvent' in event) {
        console.log(
          '\n\n[Metadata]',
          JSON.stringify(event.messageMetadataEvent, null, 2)
        );
      }
    }
    console.log('\n');
  } else {
    console.log('Usage:');
    console.log('  npm run cli login    - Authenticate with AWS Builder ID');
    console.log('  npm run cli test [question] - Test the API');
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
