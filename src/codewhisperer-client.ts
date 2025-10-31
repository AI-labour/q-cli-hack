import type {
  CodeWhispererClientConfig,
  GenerateAssistantResponseRequest,
  CodeWhispererEvent,
} from './types.js';
import { EventStreamCodec } from '@smithy/eventstream-codec';
import { toUtf8, fromUtf8 } from '@smithy/util-utf8';

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
    // EventStreamCodec(encoder, decoder)
    // encoder: Uint8Array | string => string
    // decoder: string => Uint8Array
    const codec = new EventStreamCodec(toUtf8, fromUtf8);
    let chunkCount = 0;
    let eventCount = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log(`[DEBUG] Stream ended. Received ${chunkCount} chunks, parsed ${eventCount} events`);
          codec.endOfStream();
          break;
        }

        chunkCount++;
        console.log(`[DEBUG] Received chunk ${chunkCount}, size: ${value.length} bytes`);
        
        // Feed the binary data to the codec
        codec.feed(value);

        // Get all available messages from the codec
        const availableMessages = codec.getAvailableMessages();
        const messages = availableMessages.getMessages();
        for (const message of messages) {
          eventCount++;
          console.log(`[DEBUG] Decoded message ${eventCount}`);
          console.log(`[DEBUG] Message headers:`, JSON.stringify(message.headers, null, 2));
          
          // Parse the event from the message
          const event = this.parseEventFromMessage(message);
          if (event) {
            console.log(`[DEBUG] Parsed event ${eventCount}:`, JSON.stringify(event, null, 2));
            yield event;
          }
        }
      }

      // Process any remaining messages
      const finalAvailableMessages = codec.getAvailableMessages();
      const finalMessages = finalAvailableMessages.getMessages();
      for (const message of finalMessages) {
        eventCount++;
        console.log(`[DEBUG] Final message ${eventCount}`);
        const event = this.parseEventFromMessage(message);
        if (event) {
          console.log(`[DEBUG] Final event ${eventCount}:`, JSON.stringify(event, null, 2));
          yield event;
        }
      }
    } finally {
      reader.releaseLock();
      console.log('[DEBUG] Stream reader released');
      console.log(`[DEBUG] Iteration complete. Received ${eventCount} events total`);
    }
  }

  private parseEventFromMessage(message: any): CodeWhispererEvent | null {
    const headers = message.headers;
    const messageType = headers[':message-type']?.value;
    const eventType = headers[':event-type']?.value;

    if (messageType === 'exception') {
      console.error('[DEBUG] Received exception event:', toUtf8(message.body));
      return null;
    }

    if (messageType !== 'event') {
      console.log(`[DEBUG] Skipping message with type: ${messageType}`);
      return null;
    }

    // Parse the body as JSON
    const bodyText = toUtf8(message.body);
    let bodyData: any = {};
    
    if (bodyText) {
      try {
        bodyData = JSON.parse(bodyText);
      } catch (error) {
        console.error('[DEBUG] Failed to parse message body:', bodyText, error);
        return null;
      }
    }

    // Map event types to the expected format
    switch (eventType) {
      case 'initial-response':
        return { messageMetadataEvent: bodyData };
      case 'assistantResponseEvent':
        return { assistantResponseEvent: bodyData };
      case 'codeEvent':
        return { codeEvent: bodyData };
      case 'toolUseEvent':
        return { toolUseEvent: bodyData };
      case 'invalidStateEvent':
        return { invalidStateEvent: bodyData };
      default:
        console.log(`[DEBUG] Unknown event type: ${eventType}`);
        return null;
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
