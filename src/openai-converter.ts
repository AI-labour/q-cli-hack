import type {
  ConversationState,
  ChatMessage,
  UserInputMessage,
  AssistantResponseMessage,
  Tool,
  ToolResult,
  GenerateAssistantResponseRequest,
  CodeWhispererEvent,
} from './types.js';

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
  name?: string;
}

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: any;
  };
}

export interface OpenAIChatCompletionRequest {
  model: string;
  messages: OpenAIMessage[];
  tools?: OpenAITool[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  [key: string]: any;
}

export interface OpenAIChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
}

export interface OpenAIChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAIToCodeWhispererConverter {
  private conversationId?: string;

  convertToCodeWhispererRequest(
    request: OpenAIChatCompletionRequest
  ): GenerateAssistantResponseRequest {
    const messages = request.messages;
    const tools = request.tools;

    const history: ChatMessage[] = [];
    let currentMessage: ChatMessage;

    let systemPrompt = '';
    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt += (systemPrompt ? '\n' : '') + (msg.content || '');
      }
    }

    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    const toolResults: ToolResult[] = [];
    const lastMessage = nonSystemMessages[nonSystemMessages.length - 1];

    for (let i = 0; i < nonSystemMessages.length - 1; i++) {
      const msg = nonSystemMessages[i];

      if (msg.role === 'user') {
        const userMsg: UserInputMessage = {
          content: msg.content || '',
          origin: 'CHAT',
        };
        history.push({ userInputMessage: userMsg });
      } else if (msg.role === 'assistant') {
        const assistantMsg: AssistantResponseMessage = {
          content: msg.content || '',
        };

        if (msg.tool_calls && msg.tool_calls.length > 0) {
          assistantMsg.tool_uses = msg.tool_calls.map((tc) => ({
            tool_use_id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments),
          }));
        }

        history.push({ assistantResponseMessage: assistantMsg });
      } else if (msg.role === 'tool') {
        toolResults.push({
          tool_use_id: msg.tool_call_id!,
          content: [{ text: msg.content || '' }],
          status: 'Success',
        });
      }
    }

    const cwTools: Tool[] | undefined = tools?.map((t) => ({
      toolSpecification: {
        name: t.function.name,
        description: t.function.description || '',
        input_schema: {
          json: t.function.parameters || {},
        },
      },
    }));

    let userContent = lastMessage.content || '';
    if (systemPrompt && lastMessage.role === 'user') {
      userContent = systemPrompt + '\n\n' + userContent;
    }

    if (lastMessage.role === 'tool') {
      toolResults.push({
        tool_use_id: lastMessage.tool_call_id!,
        content: [{ text: lastMessage.content || '' }],
        status: 'Success',
      });

      currentMessage = {
        userInputMessage: {
          content: '',
          origin: 'CHAT',
          user_input_message_context: {
            tool_results: toolResults,
            tools: cwTools,
          },
          model_id: request.model,
        },
      };
    } else {
      currentMessage = {
        userInputMessage: {
          content: userContent,
          origin: 'CHAT',
          user_input_message_context:
            cwTools || toolResults.length > 0
              ? {
                  tools: cwTools,
                  tool_results: toolResults.length > 0 ? toolResults : undefined,
                }
              : undefined,
          model_id: request.model,
        },
      };
    }

    const conversationState: ConversationState = {
      conversationId: this.conversationId,
      currentMessage,
      chatTriggerType: 'Manual',
      history: history.length > 0 ? history : undefined,
    };

    return {
      conversationState,
    };
  }

  async *convertToOpenAIStreamingResponse(
    events: AsyncGenerator<CodeWhispererEvent>,
    model: string,
    requestId: string
  ): AsyncGenerator<OpenAIChatCompletionChunk> {
    const created = Math.floor(Date.now() / 1000);
    let hasStarted = false;
    const toolCallBuffers = new Map<string, { name: string; arguments: string }>();
    const toolCallIndices = new Map<string, number>();
    let nextToolCallIndex = 0;

    for await (const event of events) {
      if ('messageMetadataEvent' in event) {
        if (event.messageMetadataEvent.conversation_id) {
          this.conversationId = event.messageMetadataEvent.conversation_id;
        }
        continue;
      }

      if ('assistantResponseEvent' in event || 'codeEvent' in event) {
        const content =
          'assistantResponseEvent' in event
            ? event.assistantResponseEvent.content
            : event.codeEvent.content;

        if (!hasStarted) {
          yield {
            id: requestId,
            object: 'chat.completion.chunk',
            created,
            model,
            choices: [
              {
                index: 0,
                delta: { role: 'assistant', content: '' },
                finish_reason: null,
              },
            ],
          };
          hasStarted = true;
        }

        yield {
          id: requestId,
          object: 'chat.completion.chunk',
          created,
          model,
          choices: [
            {
              index: 0,
              delta: { content },
              finish_reason: null,
            },
          ],
        };
      } else if ('toolUseEvent' in event) {
        const toolEvent = event.toolUseEvent;

        if (!toolCallIndices.has(toolEvent.tool_use_id)) {
          toolCallIndices.set(toolEvent.tool_use_id, nextToolCallIndex++);

          yield {
            id: requestId,
            object: 'chat.completion.chunk',
            created,
            model,
            choices: [
              {
                index: 0,
                delta: {
                  tool_calls: [
                    {
                      index: toolCallIndices.get(toolEvent.tool_use_id)!,
                      id: toolEvent.tool_use_id,
                      type: 'function',
                      function: {
                        name: toolEvent.name,
                        arguments: '',
                      },
                    },
                  ],
                },
                finish_reason: null,
              },
            ],
          };

          toolCallBuffers.set(toolEvent.tool_use_id, {
            name: toolEvent.name,
            arguments: '',
          });
        }

        if (toolEvent.input) {
          const buffer = toolCallBuffers.get(toolEvent.tool_use_id)!;
          buffer.arguments += toolEvent.input;

          yield {
            id: requestId,
            object: 'chat.completion.chunk',
            created,
            model,
            choices: [
              {
                index: 0,
                delta: {
                  tool_calls: [
                    {
                      index: toolCallIndices.get(toolEvent.tool_use_id)!,
                      function: {
                        arguments: toolEvent.input,
                      },
                    },
                  ],
                },
                finish_reason: null,
              },
            ],
          };
        }
      } else if ('invalidStateEvent' in event) {
        throw new Error(
          `Invalid state: ${event.invalidStateEvent.reason} - ${event.invalidStateEvent.message}`
        );
      }
    }

    yield {
      id: requestId,
      object: 'chat.completion.chunk',
      created,
      model,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: 'stop',
        },
      ],
    };
  }

  convertToOpenAINonStreamingResponse(
    result: {
      content: string;
      toolUses: Array<{ tool_use_id: string; name: string; input: any }>;
      conversationId?: string;
    },
    model: string,
    requestId: string
  ): OpenAIChatCompletionResponse {
    if (result.conversationId) {
      this.conversationId = result.conversationId;
    }

    const created = Math.floor(Date.now() / 1000);

    const message: OpenAIChatCompletionResponse['choices'][0]['message'] = {
      role: 'assistant',
      content: result.content || null,
    };

    if (result.toolUses.length > 0) {
      message.tool_calls = result.toolUses.map((tu) => ({
        id: tu.tool_use_id,
        type: 'function',
        function: {
          name: tu.name,
          arguments: JSON.stringify(tu.input),
        },
      }));
    }

    return {
      id: requestId,
      object: 'chat.completion',
      created,
      model,
      choices: [
        {
          index: 0,
          message,
          finish_reason: 'stop',
        },
      ],
    };
  }

  getConversationId(): string | undefined {
    return this.conversationId;
  }

  setConversationId(id: string | undefined): void {
    this.conversationId = id;
  }
}
