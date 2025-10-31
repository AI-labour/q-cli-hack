import type {
  CodeWhispererClientConfig,
  GenerateAssistantResponseRequest,
  CodeWhispererEvent,
} from './types.js';

export class CodeWhispererClient {
  private config: CodeWhispererClientConfig;
  private endpoint: string;

  constructor(config: CodeWhispererClientConfig) {
    this.config = config;
    this.endpoint =
      config.endpoint || 'https://codewhisperer.us-east-1.amazonaws.com';
  }

  async *generateAssistantResponse(
    request: GenerateAssistantResponseRequest
  ): AsyncGenerator<CodeWhispererEvent> {
    const token = await this.config.tokenProvider();

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.0',
        'x-amz-target':
          'AmazonCodeWhispererStreamingService.GenerateAssistantResponse',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `CodeWhisperer API error: ${response.status} ${response.statusText}\n${errorText}`
      );
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    yield* this.parseEventStream(response.body);
  }

  private async *parseEventStream(
    body: ReadableStream<Uint8Array>
  ): AsyncGenerator<CodeWhispererEvent> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;

          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const event = JSON.parse(data);
              yield event;
            } catch (error) {
              console.error('Failed to parse event:', data, error);
            }
          }
        }
      }

      if (buffer.trim()) {
        if (buffer.startsWith('data: ')) {
          const data = buffer.slice(6);
          try {
            const event = JSON.parse(data);
            yield event;
          } catch (error) {
            console.error('Failed to parse final event:', data, error);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async generateAssistantResponseNonStreaming(
    request: GenerateAssistantResponseRequest
  ): Promise<{
    content: string;
    toolUses: Array<{ tool_use_id: string; name: string; input: any }>;
    conversationId?: string;
    utteranceId?: string;
  }> {
    let content = '';
    const toolUses: Array<{ tool_use_id: string; name: string; input: any }> =
      [];
    const toolInputBuffers = new Map<string, string>();
    let conversationId: string | undefined;
    let utteranceId: string | undefined;

    for await (const event of this.generateAssistantResponse(request)) {
      if ('assistantResponseEvent' in event) {
        content += event.assistantResponseEvent.content;
      } else if ('codeEvent' in event) {
        content += event.codeEvent.content;
      } else if ('toolUseEvent' in event) {
        const toolEvent = event.toolUseEvent;
        const existingBuffer = toolInputBuffers.get(toolEvent.tool_use_id) || '';
        const newBuffer = existingBuffer + (toolEvent.input || '');
        toolInputBuffers.set(toolEvent.tool_use_id, newBuffer);

        if (toolEvent.stop) {
          try {
            const input = JSON.parse(newBuffer);
            toolUses.push({
              tool_use_id: toolEvent.tool_use_id,
              name: toolEvent.name,
              input: input,
            });
          } catch (error) {
            console.error(
              'Failed to parse tool input:',
              newBuffer,
              error
            );
          }
        }
      } else if ('messageMetadataEvent' in event) {
        conversationId =
          event.messageMetadataEvent.conversation_id || conversationId;
        utteranceId = event.messageMetadataEvent.utterance_id || utteranceId;
      } else if ('invalidStateEvent' in event) {
        throw new Error(
          `Invalid state: ${event.invalidStateEvent.reason} - ${event.invalidStateEvent.message}`
        );
      }
    }

    return {
      content,
      toolUses,
      conversationId,
      utteranceId,
    };
  }
}
