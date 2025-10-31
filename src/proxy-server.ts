import express from 'express';
import { randomUUID } from 'crypto';
import { AuthManager } from './auth.js';
import { CodeWhispererClient } from './codewhisperer-client.js';
import {
  OpenAIToCodeWhispererConverter,
  type OpenAIChatCompletionRequest,
} from './openai-converter.js';

const app = express();
app.use(express.json());

const authManager = new AuthManager();
const converters = new Map<string, OpenAIToCodeWhispererConverter>();

async function getTokenProvider() {
  return async () => {
    const token = await authManager.getValidToken();
    if (!token) {
      throw new Error('No valid token. Please authenticate first.');
    }
    return token.access_token;
  };
}

app.post('/v1/chat/completions', async (req, res) => {
  try {
    const request: OpenAIChatCompletionRequest = req.body;

    const apiKey = req.headers.authorization?.replace('Bearer ', '') || 'default';
    
    let converter = converters.get(apiKey);
    if (!converter) {
      converter = new OpenAIToCodeWhispererConverter();
      converters.set(apiKey, converter);
    }

    const tokenProvider = await getTokenProvider();
    const client = new CodeWhispererClient({ tokenProvider });

    const cwRequest = converter.convertToCodeWhispererRequest(request);
    const requestId = randomUUID();

    if (request.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      try {
        const events = client.generateAssistantResponse(cwRequest);
        const openAIStream = converter.convertToOpenAIStreamingResponse(
          events,
          request.model,
          requestId
        );

        for await (const chunk of openAIStream) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }

        res.write('data: [DONE]\n\n');
        res.end();
      } catch (error: any) {
        console.error('Streaming error:', error);
        const errorChunk = {
          id: requestId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: request.model,
          choices: [],
          error: {
            message: error.message,
            type: 'server_error',
          },
        };
        res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
        res.end();
      }
    } else {
      const result = await client.generateAssistantResponseNonStreaming(
        cwRequest
      );
      const response = converter.convertToOpenAINonStreamingResponse(
        result,
        request.model,
        requestId
      );

      res.json(response);
    }
  } catch (error: any) {
    console.error('Error:', error);
    res.status(500).json({
      error: {
        message: error.message,
        type: 'server_error',
      },
    });
  }
});

app.get('/v1/models', async (req, res) => {
  res.json({
    object: 'list',
    data: [
      {
        id: 'codewhisperer',
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'aws',
      },
    ],
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

async function main() {
  const port = process.env.PORT || 3000;

  console.log('Checking authentication...');
  const token = await authManager.getValidToken();
  
  if (!token) {
    console.log('No valid token found. Starting authentication...');
    await authManager.authenticate();
  } else {
    console.log('✓ Valid token found');
  }

  app.listen(port, () => {
    console.log(`\n=== CodeWhisperer OpenAI Proxy Server ===`);
    console.log(`Server listening on http://localhost:${port}`);
    console.log(`\nEndpoints:`);
    console.log(`  POST /v1/chat/completions`);
    console.log(`  GET  /v1/models`);
    console.log(`  GET  /health`);
    console.log(`\nUsage with OpenAI SDK:`);
    console.log(`  base_url: http://localhost:${port}/v1`);
    console.log(`  api_key: any-string (ignored)\n`);
  });
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
