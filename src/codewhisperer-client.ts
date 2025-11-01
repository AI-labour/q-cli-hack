import {
  CodeWhispererStreamingClient,
  SendMessageCommand,
  GenerateAssistantResponseCommand,
  type SendMessageCommandInput,
  type GenerateAssistantResponseCommandInput,
  type ChatResponseStream,
} from '@aws/codewhisperer-streaming-client';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { HttpsProxyAgent } from 'hpagent';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
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

    const proxyAgent = (() => {
      const proxyUrl = process.env.https_proxy || process.env.HTTPS_PROXY;
      if (!proxyUrl) {
        return undefined;
      }

      const caPath = path.join(os.homedir(), '.mitmproxy', 'mitmproxy-ca-cert.pem');
      const ca = fs.existsSync(caPath) ? fs.readFileSync(caPath) : undefined;

      return new HttpsProxyAgent({
        proxy: proxyUrl,
        ca,
      });
    })();

    this.client = new CodeWhispererStreamingClient({
      region: config.region || 'us-east-1',
      endpoint: config.endpoint || 'https://q.us-east-1.amazonaws.com',
      token: async () => {
        const token = await this.tokenProvider();
        return { token };
      },
      requestHandler: proxyAgent ? new NodeHttpHandler({
        httpAgent: proxyAgent,
        httpsAgent: proxyAgent,
      }) : undefined,
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

  async *generateAssistantResponse(
    request: GenerateAssistantResponseCommandInput
  ): AsyncGenerator<ChatResponseStream> {
    const command = new GenerateAssistantResponseCommand(request);
    const response = await this.client.send(command);

    if (!response.generateAssistantResponseResponse) {
      throw new Error('No response from CodeWhisperer for GenerateAssistantResponse');
    }

    // The response is an async iterable, so we can iterate over it.
    // The actual type of the events is a union of all possible event shapes.
    for await (const event of response.generateAssistantResponseResponse) {
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
