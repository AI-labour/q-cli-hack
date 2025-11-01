import type {
  SendMessageCommandInput,
  ConversationState,
  ChatMessage,
  ChatResponseStream,
  Tool,
  ToolResult,
} from '@aws/codewhisperer-streaming-client';

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
  ): SendMessageCommandInput {
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
        history.push({
          userInputMessage: {
            content: msg.content || '',
          },
        });
      } else if (msg.role === 'assistant') {
        const assistantMsg: ChatMessage['assistantResponseMessage'] = {
          content: msg.content || '',
        };

        if (msg.tool_calls && msg.tool_calls.length > 0) {
          assistantMsg.toolUses = msg.tool_calls.map((tc) => ({
            toolUseId: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments),
          }));
        }

        history.push({ assistantResponseMessage: assistantMsg });
      } else if (msg.role === 'tool') {
        toolResults.push({
          toolUseId: msg.tool_call_id!,
          content: [{ text: msg.content || '' }],
          status: 'success',
        });
      }
    }

    const cwTools: Tool[] | undefined = tools?.map((t) => ({
      toolSpecification: {
        name: t.function.name,
        description: t.function.description || '',
        inputSchema: {
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
        toolUseId: lastMessage.tool_call_id!,
        content: [{ text: lastMessage.content || '' }],
        status: 'success',
      });

      currentMessage = {
        userInputMessage: {
          content: '',
          userInputMessageContext: {
            toolResults,
            tools: cwTools,
          },
          modelId: request.model,
        },
      };
    } else {
      currentMessage = {
        userInputMessage: {
          content: userContent,
          userInputMessageContext:
            cwTools || toolResults.length > 0
              ? {
                  tools: cwTools,
                  toolResults: toolResults.length > 0 ? toolResults : undefined,
                }
              : undefined,
          modelId: request.model,
        },
      };
    }

    const conversationState: ConversationState = {
      conversationId: this.conversationId,
      currentMessage,
      chatTriggerType: 'MANUAL',
      history: history.length > 0 ? history : undefined,
    };

    return {
      conversationState,
    };
  }

  async *convertToOpenAIStreamingResponse(
    events: AsyncGenerator<ChatResponseStream>,
    model: string,
    requestId: string
  ): AsyncGenerator<OpenAIChatCompletionChunk> {
    const created = Math.floor(Date.now() / 1000);
    let hasStarted = false;

    for await (const event of events) {
      if ('messageMetadataEvent' in event && event.messageMetadataEvent) {
        if (event.messageMetadataEvent.conversationId) {
          this.conversationId = event.messageMetadataEvent.conversationId;
        }
        continue;
      }

      if ('assistantResponseEvent' in event || 'codeEvent' in event) {
        const content =
          'assistantResponseEvent' in event && event.assistantResponseEvent
            ? event.assistantResponseEvent.content
            : 'codeEvent' in event && event.codeEvent
            ? event.codeEvent.content
            : '';

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
              delta: { content: content || '' },
              finish_reason: null,
            },
          ],
        };
      } else if ('invalidStateEvent' in event && event.invalidStateEvent) {
        throw new Error(
          `Invalid state: ${event.invalidStateEvent.reason || 'unknown'} - ${event.invalidStateEvent.message || 'no message'}`
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
      conversationId?: string;
    },
    model: string,
    requestId: string
  ): OpenAIChatCompletionResponse {
    if (result.conversationId) {
      this.conversationId = result.conversationId;
    }

    const created = Math.floor(Date.now() / 1000);

    return {
      id: requestId,
      object: 'chat.completion',
      created,
      model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: result.content || null,
          },
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
