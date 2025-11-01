#!/usr/bin/env node

import { AuthManager } from './auth.js';
import { CodeWhispererClient } from './codewhisperer-client.js';
import type { Reference } from '@aws/codewhisperer-streaming-client';

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
      endpoint: "https://q.us-east-1.amazonaws.com"
    });

    const question = args.slice(1).join(' ') || 'Hello, how are you?';
    console.log(`\nQuestion: ${question}\n`);

    console.log('Response:');
    let conversationId: string | undefined = "130fa468-b813-4eef-8409-e3bea94412ea";
    const events = client.generateAssistantResponse({
      conversationState: {
        conversationId: conversationId,
        currentMessage: {
          userInputMessage: {
            content: question,
            origin: "CLI",
            modelId: "claude-sonnet-4.5"
          },
        },
        chatTriggerType: 'MANUAL',
      },
    });

    for await (const event of events) {
      if (event.assistantResponseEvent) {
        process.stdout.write(event.assistantResponseEvent.content || '');
      } else if (event.codeEvent) {
        process.stdout.write(event.codeEvent.content || '');
      } else if (event.messageMetadataEvent) {
        conversationId = event.messageMetadataEvent.conversationId;
      } else if (event.followupPromptEvent) {
        console.log('\n\nSuggested follow-up:');
        console.log(`- ${event.followupPromptEvent.followupPrompt?.content}`);
      } else if (event.citationEvent) {
        console.log('\n\n[Citations]:');
        // @ts-ignore - The `references` property might not be in the generated type, but it is in the data
        event.citationEvent.references?.forEach((citation: Reference, index: number) => {
          console.log(`[${index + 1}] ${citation.url}`);
        });
      } else if (event.error) {
        console.error('\n\n[ERROR]', event.error.message);
        break;
      }
      // Basic tool use handling (non-interactive for this CLI example)
      else if (event.toolUseEvent) {
        console.log(`\n\n[TOOL USE DETECTED]`);
        // @ts-ignore
        console.log(`- Tool: ${event.toolUseEvent.toolName}`);
        // @ts-ignore
        console.log(`- Input: ${event.toolUseEvent.input}`);
        console.log(`(Tool execution and response not implemented in this basic CLI)`);
      }
    }
    console.log(`\n\nConversation finished. ID: ${conversationId}`);
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
