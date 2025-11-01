# CodeWhisperer OpenAI Proxy

A protocol conversion proxy that translates OpenAI Chat Completion API requests to AWS CodeWhisperer Streaming API calls. This allows you to use CodeWhisperer with any tool or library that supports the OpenAI API format.

## Features

- ✅ **Full OpenAI API Compatibility** - Works with any OpenAI-compatible client
- ✅ **Streaming Support** - Real-time streaming responses
- ✅ **Conversation History** - Automatic conversation management
- ✅ **AWS Builder ID Authentication** - Easy SSO authentication
- ✅ **Official AWS Client** - Uses `@aws/codewhisperer-streaming-client` for reliable communication
- ✅ **TypeScript** - Fully typed with comprehensive type definitions

## Quick Start

### Installation

```bash
npm install
```

### Authentication

The proxy uses AWS Builder ID (SSO) for authentication. On first run, you'll be prompted to authenticate:

```bash
npm run dev
```

Follow the authentication link displayed in the terminal.

### Start the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm run build
npm start
```

The server will start on `http://localhost:3000` by default.

## Usage

### With OpenAI Python SDK

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="dummy"  # API key is ignored but required by the SDK
)

response = client.chat.completions.create(
    model="codewhisperer",
    messages=[
        {"role": "user", "content": "Write a Python function to calculate fibonacci numbers"}
    ],
    stream=True
)

for chunk in response:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

### With OpenAI Node.js SDK

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:3000/v1',
  apiKey: 'dummy', // API key is ignored but required by the SDK
});

const response = await client.chat.completions.create({
  model: 'codewhisperer',
  messages: [
    { role: 'user', content: 'Write a Python function to calculate fibonacci numbers' }
  ],
  stream: true,
});

for await (const chunk of response) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

### With curl

#### Streaming Request

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "codewhisperer",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "stream": true
  }'
```

#### Non-Streaming Request

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "codewhisperer",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "stream": false
  }'
```

## API Endpoints

### `POST /v1/chat/completions`

OpenAI-compatible chat completion endpoint.

**Request Body:**
```json
{
  "model": "codewhisperer",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  "stream": true
}
```

**Supported Parameters:**
- `model` - Model identifier (any string, passed to CodeWhisperer)
- `messages` - Array of message objects with `role` and `content`
- `stream` - Boolean for streaming responses
- `temperature` - Currently not used but accepted
- `max_tokens` - Currently not used but accepted

### `GET /v1/models`

List available models.

**Response:**
```json
{
  "object": "list",
  "data": [
    {
      "id": "codewhisperer",
      "object": "model",
      "created": 1234567890,
      "owned_by": "aws"
    }
  ]
}
```

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

## Architecture

This project uses the official `@aws/codewhisperer-streaming-client` npm package, which is AWS's internal client library for the CodeWhisperer Streaming API.

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   OpenAI     │         │   Proxy      │         │ CodeWhisperer│
│   Client     │ ──────> │   Server     │ ──────> │   Streaming  │
│              │ OpenAI  │              │  AWS    │     API      │
│              │ Format  │  Converter   │ Format  │              │
└──────────────┘         └──────────────┘         └──────────────┘
```

### Key Components

1. **proxy-server.ts** - Express server handling OpenAI API endpoints
2. **openai-converter.ts** - Protocol converter between OpenAI and CodeWhisperer formats
3. **codewhisperer-client.ts** - Wrapper around the official AWS client
4. **auth.ts** - AWS Builder ID authentication manager

## Configuration

### Environment Variables

- `PORT` - Server port (default: 3000)

### Authentication Files

Authentication tokens are stored in `~/.codewhisperer-proxy/`:
- `tokens.json` - Access token and refresh token
- `registration.json` - OAuth client registration

## Documentation

- [CodeWhisperer Streaming Client Guide](docs/codewhisperer-streaming-client-guide.md) - Comprehensive guide to the AWS client library

## Conversation Management

The proxy automatically manages conversation state:
- Each API key (from Authorization header) gets its own conversation
- Conversation IDs are tracked automatically
- Message history is maintained for context

## Differences from OpenAI API

| Feature | OpenAI | This Proxy |
|---------|--------|------------|
| Authentication | API key | AWS Builder ID SSO |
| Models | Multiple models | CodeWhisperer only |
| Tools/Functions | Supported | Not yet implemented |
| Vision | Supported | Not yet implemented |
| Token counting | Exact | Not available |

## Development

### Project Structure

```
.
├── src/
│   ├── proxy-server.ts        # Express server
│   ├── openai-converter.ts    # Protocol converter
│   ├── codewhisperer-client.ts # AWS client wrapper
│   ├── auth.ts                # Authentication
│   ├── types.ts               # Type definitions
│   ├── cli.ts                 # CLI tool
│   └── index.ts               # Package exports
├── docs/
│   └── codewhisperer-streaming-client-guide.md
├── package.json
├── tsconfig.json
└── README.md
```

### Building

```bash
npm run build
```

Output will be in the `dist/` directory.

### Running Tests

```bash
# Run the CLI tool for testing
npm run cli
```

## Troubleshooting

### Authentication Issues

If you encounter authentication issues:

1. Delete the authentication files:
   ```bash
   rm -rf ~/.codewhisperer-proxy
   ```

2. Restart the server and authenticate again

### Connection Issues

If you can't connect to CodeWhisperer:

1. Check your internet connection
2. Verify AWS service status
3. Ensure you have a valid AWS Builder ID account

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Related Projects

- [AWS CodeWhisperer](https://aws.amazon.com/codewhisperer/)
- [OpenAI API](https://platform.openai.com/docs/api-reference)
- [@aws/codewhisperer-streaming-client](https://www.npmjs.com/package/@aws/codewhisperer-streaming-client)

## Disclaimer

This project uses an internal AWS package (`@aws/codewhisperer-streaming-client`) that is not officially documented or supported for external use. The API may change without notice. Use at your own risk.
