import { AuthManager, CodeWhispererClient } from '../src/index.js';
import type { ChatMessage } from '@aws/codewhisperer-streaming-client';

async function main() {
  console.log('=== Tool Calling Example ===\n');

  const authManager = new AuthManager();
  const token = await authManager.getValidToken();

  if (!token) {
    console.log('Not authenticated. Run: npm run cli login');
    process.exit(1);
  }

  const client = new CodeWhispererClient({
    tokenProvider: async () => token.access_token,
  });

  const tools = [
    {
      toolSpecification: {
        name: 'get_current_time',
        description: 'Get the current time in a specific timezone',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              timezone: {
                type: 'string',
                description: 'Timezone (e.g., America/New_York, Asia/Tokyo)',
              },
            },
            required: ['timezone'],
          },
        },
      },
    },
    {
      toolSpecification: {
        name: 'calculate',
        description: 'Perform a mathematical calculation',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              expression: {
                type: 'string',
                description: 'Mathematical expression to evaluate',
              },
            },
            required: ['expression'],
          },
        },
      },
    },
  ];

  console.log('Asking: "What time is it in Tokyo and what is 15 * 23?"\n');

  // Note: Tool calling support would need to be implemented
  // This is a placeholder showing the structure
  console.log('Tool calling is not yet fully implemented in this version.');
  console.log('The official AWS client supports it, but the converter needs updates.');
  console.log('\nExample structure:');
  console.log(JSON.stringify(tools, null, 2));

  // Basic message without tools
  const result = await client.sendMessageNonStreaming({
    conversationState: {
      currentMessage: {
        userInputMessage: {
          content: 'Calculate 15 times 23 for me.',
          userInputMessageContext: {
            tools: tools,
          },
        },
      },
      chatTriggerType: 'MANUAL',
    },
  });

  console.log('\nResponse:');
  console.log(result.content);
  console.log('\nConversation ID:', result.conversationId);

  console.log('\n--- Note ---');
  console.log('Full tool calling support requires:');
  console.log('1. Handling tool use events in the response');
  console.log('2. Executing the requested tools');
  console.log('3. Sending tool results back in a follow-up message');
  console.log('4. Processing the final response');
  console.log('\nThis is planned for a future version.');
}

main().catch(console.error);
