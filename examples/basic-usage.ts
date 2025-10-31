import { AuthManager, CodeWhispererClient } from '../src/index.js';

async function main() {
  console.log('=== Basic CodeWhisperer Client Usage ===\n');

  const authManager = new AuthManager();
  const token = await authManager.getValidToken();

  if (!token) {
    console.log('Not authenticated. Run: npm run cli login');
    process.exit(1);
  }

  const client = new CodeWhispererClient({
    tokenProvider: async () => token.access_token,
  });

  console.log('Streaming example:');
  console.log('Question: What is TypeScript?\n');
  console.log('Response:');

  for await (const event of client.generateAssistantResponse({
    conversationState: {
      currentMessage: {
        userInputMessage: {
          content: 'What is TypeScript? Give me a brief explanation.',
          origin: 'CLI',
        },
      },
      chatTriggerType: 'MANUAL',
    },
  })) {
    if ('assistantResponseEvent' in event) {
      process.stdout.write(event.assistantResponseEvent.content);
    } else if ('codeEvent' in event) {
      process.stdout.write(event.codeEvent.content);
    }
  }

  console.log('\n\n' + '='.repeat(50) + '\n');

  console.log('Non-streaming example:');
  console.log('Question: Write a bubble sort in Python\n');

  const result = await client.generateAssistantResponseNonStreaming({
    conversationState: {
      currentMessage: {
        userInputMessage: {
          content: 'Write a bubble sort algorithm in Python',
          origin: 'CLI',
        },
      },
      chatTriggerType: 'MANUAL',
    },
  });

  console.log('Response:');
  console.log(result.content);
  console.log('\nConversation ID:', result.conversationId);
}

main().catch(console.error);
