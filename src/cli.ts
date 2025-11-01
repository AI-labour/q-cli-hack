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
    console.log('[DEBUG] Starting to iterate over events...');
    let eventCounter = 0;
    for await (const event of client.sendMessage({
      conversationState: {
        currentMessage: {
          userInputMessage: {
            content: question,
          },
        },
        chatTriggerType: 'MANUAL',
      },
    })) {
      eventCounter++;
      console.log(`[DEBUG] CLI received event ${eventCounter}:`, JSON.stringify(event, null, 2));
      
      if ('assistantResponseEvent' in event && event.assistantResponseEvent) {
        console.log('[DEBUG] Processing assistantResponseEvent');
        process.stdout.write(event.assistantResponseEvent.content || '');
      } else if ('codeEvent' in event && event.codeEvent) {
        console.log('[DEBUG] Processing codeEvent');
        process.stdout.write(event.codeEvent.content || '');
      } else if ('messageMetadataEvent' in event) {
        console.log('[DEBUG] Processing messageMetadataEvent');
        console.log(
          '\n\n[Metadata]',
          JSON.stringify(event.messageMetadataEvent, null, 2)
        );
      } else {
        console.log('[DEBUG] Unknown event type:', Object.keys(event));
      }
    }
    console.log(`[DEBUG] Iteration complete. Received ${eventCounter} events total`);
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
