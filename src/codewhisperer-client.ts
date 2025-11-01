import {
  CodeWhispererStreamingClient,
  SendMessageCommand,
  type SendMessageCommandInput,
  type ChatResponseStream,
} from '@aws/codewhisperer-streaming-client';
import type { TokenProvider } from './types.js';

export interface CodeWhispererClientConfig {
  tokenProvider: TokenProvider;
  region?: string;
  endpoint?: string;
}

export class CodeWhispererClient {
  private client: CodeWhispererStreamingClient;
  private tokenProvider: TokenProvider;

  constructor(config: CodeWhispererClientConfig) {
    this.tokenProvider = config.tokenProvider;

    this.client = new CodeWhispererStreamingClient({
      region: config.region || 'us-east-1',
      endpoint: config.endpoint,
      token: async () => {
        const token = await this.tokenProvider();
        return { token };
      },
    });
  }

  async *sendMessage(
    request: SendMessageCommandInput
  ): AsyncGenerator<ChatResponseStream> {
    const command = new SendMessageCommand(request);
    const response = await this.client.send(command);

    if (!response.sendMessageResponse) {
      throw new Error('No response from CodeWhisperer');
    }

    for await (const event of response.sendMessageResponse) {
      yield event;
    }
  }

  async sendMessageNonStreaming(
    request: SendMessageCommandInput
  ): Promise<{
    content: string;
    conversationId?: string;
    utteranceId?: string;
  }> {
    let content = '';
    let conversationId: string | undefined;
    let utteranceId: string | undefined;

    for await (const event of this.sendMessage(request)) {
      if ('messageMetadataEvent' in event && event.messageMetadataEvent) {
        conversationId = event.messageMetadataEvent.conversationId;
        utteranceId = event.messageMetadataEvent.utteranceId;
      } else if ('assistantResponseEvent' in event && event.assistantResponseEvent) {
        content += event.assistantResponseEvent.content || '';
      } else if ('codeEvent' in event && event.codeEvent) {
        content += event.codeEvent.content || '';
      } else if ('invalidStateEvent' in event && event.invalidStateEvent) {
        throw new Error(
          `Invalid state: ${event.invalidStateEvent.reason || 'unknown'} - ${event.invalidStateEvent.message || 'no message'}`
        );
      }
    }

    return {
      content,
      conversationId,
      utteranceId,
    };
  }

  destroy(): void {
    this.client.destroy();
  }
}
