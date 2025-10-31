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

    // Log the request for debugging
    console.log('[DEBUG] Request body:', JSON.stringify(request, null, 2));

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

    console.log('[DEBUG] Response status:', response.status, response.statusText);
    console.log('[DEBUG] Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DEBUG] Error response body:', errorText);
      throw new Error(
        `CodeWhisperer API error: ${response.status} ${response.statusText}\n${errorText}`
      );
    }

    if (!response.body) {
      console.error('[DEBUG] Response body is null');
      throw new Error('Response body is null');
    }

    console.log('[DEBUG] Starting to parse event stream...');
    yield* this.parseEventStream(response.body);
  }

  private async *parseEventStream(
    body: ReadableStream<Uint8Array>
  ): AsyncGenerator<CodeWhispererEvent> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let chunkCount = 0;
    let eventCount = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log(`[DEBUG] Stream ended. Received ${chunkCount} chunks, parsed ${eventCount} events`);
          break;
        }

        chunkCount++;
        const chunk = decoder.decode(value, { stream: true });
        console.log(`[DEBUG] Received chunk ${chunkCount}, size: ${chunk.length} bytes`);
        console.log(`[DEBUG] Chunk content:`, chunk.substring(0, 200) + (chunk.length > 200 ? '...' : ''));
        
        buffer += chunk;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;

          console.log(`[DEBUG] Processing line: ${line.substring(0, 100)}${line.length > 100 ? '...' : ''}`);

          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const event = JSON.parse(data);
              eventCount++;
              console.log(`[DEBUG] Parsed event ${eventCount}:`, JSON.stringify(event, null, 2));
              yield event;
            } catch (error) {
              console.error('[DEBUG] Failed to parse event:', data, error);
            }
          } else {
            console.log(`[DEBUG] Line does not start with "data: ": ${line.substring(0, 50)}`);
          }
        }
      }

      if (buffer.trim()) {
        console.log(`[DEBUG] Processing remaining buffer: ${buffer.substring(0, 100)}${buffer.length > 100 ? '...' : ''}`);
        if (buffer.startsWith('data: ')) {
          const data = buffer.slice(6);
          try {
            const event = JSON.parse(data);
            eventCount++;
            console.log(`[DEBUG] Parsed final event ${eventCount}:`, JSON.stringify(event, null, 2));
            yield event;
          } catch (error) {
            console.error('[DEBUG] Failed to parse final event:', data, error);
          }
        }
      }
    } finally {
      reader.releaseLock();
      console.log('[DEBUG] Stream reader released');
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
