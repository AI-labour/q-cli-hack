import { AuthManager, CodeWhispererClient } from '../src/index.js';
import type { ConversationState, ChatMessage } from '../src/types.js';

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
        input_schema: {
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
        input_schema: {
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

  const result1 = await client.generateAssistantResponseNonStreaming({
    conversationState: {
      currentMessage: {
        userInputMessage: {
          content: 'What time is it in Tokyo and what is 15 * 23?',
          origin: 'CLI',
          user_input_message_context: {
            tools: tools,
          },
        },
      },
      chatTriggerType: 'Manual',
    },
  });

  console.log('Assistant response:', result1.content);
  console.log('\nTool calls requested:');
  result1.toolUses.forEach((tu) => {
    console.log(`  - ${tu.name}(${JSON.stringify(tu.input)})`);
  });

  if (result1.toolUses.length > 0) {
    console.log('\nExecuting tools...');

    const toolResults = result1.toolUses.map((tu) => {
      let resultContent;

      if (tu.name === 'get_current_time') {
        const currentTime = new Date().toLocaleString('en-US', {
          timeZone: tu.input.timezone || 'UTC',
        });
        resultContent = { time: currentTime, timezone: tu.input.timezone };
      } else if (tu.name === 'calculate') {
        try {
          const result = eval(tu.input.expression);
          resultContent = { result: result };
        } catch (error: any) {
          resultContent = { error: error.message };
        }
      }

      return {
        tool_use_id: tu.tool_use_id,
        content: [{ json: resultContent }],
        status: 'Success' as const,
      };
    });

    console.log('Tool results:', JSON.stringify(toolResults, null, 2));

    console.log('\nSending tool results back...\n');

    const history: ChatMessage[] = [
      {
        userInputMessage: {
          content: 'What time is it in Tokyo and what is 15 * 23?',
          origin: 'CLI',
        },
      },
      {
        assistantResponseMessage: {
          content: result1.content,
          tool_uses: result1.toolUses.map((tu) => ({
            tool_use_id: tu.tool_use_id,
            name: tu.name,
            input: tu.input,
          })),
        },
      },
    ];

    const result2 = await client.generateAssistantResponseNonStreaming({
      conversationState: {
        conversationId: result1.conversationId,
        currentMessage: {
          userInputMessage: {
            content: '',
            origin: 'CLI',
            user_input_message_context: {
              tool_results: toolResults,
              tools: tools,
            },
          },
        },
        chatTriggerType: 'Manual',
        history: history,
      },
    });

    console.log('Final response:');
    console.log(result2.content);
  }
}

main().catch(console.error);
