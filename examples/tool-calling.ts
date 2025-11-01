import { AuthManager, CodeWhispererClient } from '../src/index.js';
import type {
  ChatMessage,
  ToolUseEvent,
  ToolResult,
  Tool,
} from '@aws/codewhisperer-streaming-client';

// --- 模拟本地工具的执行 ---
async function executeTool(toolUseEvent: ToolUseEvent): Promise<any> {
  const toolName = toolUseEvent.name ?? '';
  const toolUseId = toolUseEvent.toolUseId ?? '';
  console.log(`\n[SYSTEM] Executing tool: ${toolName} with ID: ${toolUseId}`);
  const params = JSON.parse(toolUseEvent.input || '{}');
  console.log(`[SYSTEM] Parameters:`, params);

  switch (toolName) {
    case 'get_current_time':
      try {
        const timezone = params.timezone || 'UTC';
        const time = new Date().toLocaleTimeString('en-US', {
          timeZone: timezone,
        });
        return { time: time };
      } catch (e: any) {
        return { error: `Invalid timezone: ${e.message}` };
      }
    case 'calculate':
      try {
        // 注意：在生产环境中，使用 eval 是非常危险的！这里仅为示例。
        // 应该使用一个安全的数学表达式解析器。
        const result = new Function(`return ${params.expression}`)();
        return { result: result };
      } catch (e: any) {
        return { error: `Calculation failed: ${e.message}` };
      }
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

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
    endpoint: 'https://q.us-east-1.amazonaws.com',
  });

  const tools: Tool[] = [
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

  const chatHistory: ChatMessage[] = [];
  let conversationId: string | undefined = "130fa468-b813-4eef-8409-e3bea94412ea";

  const initialPrompt = 'What time is it in Tokyo and what is 15 * 23?';
  console.log(`User: ${initialPrompt}\n`);

  // 1. 初始请求
  const initialMessage: ChatMessage = {
    userInputMessage: {
      content: initialPrompt,
      userInputMessageContext: { tools: tools },
      origin: "CLI",
      modelId: "claude-sonnet-4.5",
    },
  };
  chatHistory.push({
    userInputMessage: {
      content: initialMessage.userInputMessage.content,
      origin: "CLI",
    }
  });

  let events = client.generateAssistantResponse({
    conversationState: {
      conversationId,
      chatTriggerType: 'MANUAL',
      currentMessage: initialMessage,
      history: [],
    },
  });

  const aggregatedToolUses = new Map<string, ToolUseEvent>();
  let assistantResponse = '';

  // 2. 处理事件流，聚合工具调用请求
  console.log('Assistant:');
  for await (const event of events) {
    if (event.assistantResponseEvent) {
      assistantResponse += event.assistantResponseEvent.content;
      process.stdout.write(event.assistantResponseEvent.content || '');
    } else if (event.toolUseEvent) {
      const { toolUseId, name, input } = event.toolUseEvent;
      if (toolUseId) {
        if (!aggregatedToolUses.has(toolUseId)) {
          aggregatedToolUses.set(toolUseId, { toolUseId, name: name ?? '', input: '' });
        }
        const existing = aggregatedToolUses.get(toolUseId)!;
        if (name) {
          existing.name = name;
        }
        if (input) {
          existing.input += input;
        }
      }
    } else if (event.messageMetadataEvent) {
      conversationId = event.messageMetadataEvent.conversationId;
    } else if (event.error) {
      console.error('\n[ERROR]', event.error);
      return;
    }
  }

  // 3. 如果有工具调用，执行它们并发送结果
  const toolUses = Array.from(aggregatedToolUses.values());
  if (toolUses.length > 0) {
    chatHistory.push({
      assistantResponseMessage: {
        messageId: '956dd41b-3180-4be9-9329-c2cd0738a178',
        content: assistantResponse || '',
        toolUses: toolUses.map((x) => ({
          toolUseId: x.toolUseId,
          name: x.name,
          input: x.input ? JSON.parse(x.input) : undefined,
        })),
      }
    });

    console.log(`\n\n[SYSTEM] Aggregated ${toolUses.length} tool call(s)`);
    const toolResults: ToolResult[] = [];
    for (const toolUseEvent of toolUses) {
      const result = await executeTool(toolUseEvent);
      toolResults.push({
        toolUseId: toolUseEvent.toolUseId ?? '',
        content: [{ text: JSON.stringify(result) }],
        status: result.error ? 'error' : 'success',
      });
    }

    console.log('\n\n[SYSTEM] Sending tool results back to the assistant...');
    const toolResultMessage: ChatMessage = {
      userInputMessage: {
        content: '',
        userInputMessageContext: {
          toolResults: toolResults,
          tools: tools,
        },
        origin: "CLI",
        modelId: "claude-sonnet-4.5",
      },
    };

    // 4. 发送工具结果并处理最终响应
    events = client.generateAssistantResponse({
      conversationState: {
        conversationId,
        history: chatHistory,
        currentMessage: toolResultMessage,
        chatTriggerType: 'MANUAL',
      },
    });

    assistantResponse = '';
    console.log('\nAssistant (final answer):');
    for await (const event of events) {
      if (event.assistantResponseEvent) {
        assistantResponse += event.assistantResponseEvent.content;
        process.stdout.write(event.assistantResponseEvent.content || '');
      }
    }
    chatHistory.push({ assistantResponseMessage: { content: assistantResponse } });
  } else if (assistantResponse) {
    chatHistory.push({ assistantResponseMessage: { content: assistantResponse } });
  }

  console.log(`\n\n[SYSTEM] Conversation finished. Conversation ID: ${conversationId}`);
}

main().catch(console.error);
