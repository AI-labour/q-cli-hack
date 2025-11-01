# Quick Start Guide

Get up and running with CodeWhisperer OpenAI Proxy in 5 minutes!

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- An AWS Builder ID account (free to create)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd codewhisperer-openai-proxy
```

2. Install dependencies:
```bash
npm install
```

## First Time Setup

1. Start the server:
```bash
npm run dev
```

2. You'll see an authentication prompt. Open the link in your browser:
```
=== AWS Builder ID Authentication ===

Please visit: https://device.sso.us-east-1.amazonaws.com/?user_code=XXXX-XXXX

Or go to: https://device.sso.us-east-1.amazonaws.com/
And enter code: XXXX-XXXX
```

3. Sign in with your AWS Builder ID (create one if you don't have it)

4. Once authenticated, the server will start:
```
✓ Authentication successful!

=== CodeWhisperer OpenAI Proxy Server ===
Server listening on http://localhost:3000

Endpoints:
  POST /v1/chat/completions
  GET  /v1/models
  GET  /health
```

## Your First Request

### Using curl

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "codewhisperer",
    "messages": [
      {"role": "user", "content": "Write a hello world function in Python"}
    ],
    "stream": false
  }'
```

### Using Python

Create a file `test.py`:

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="dummy"
)

response = client.chat.completions.create(
    model="codewhisperer",
    messages=[
        {"role": "user", "content": "Write a hello world function in Python"}
    ]
)

print(response.choices[0].message.content)
```

Run it:
```bash
python test.py
```

### Using JavaScript/TypeScript

Create a file `test.js`:

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:3000/v1',
  apiKey: 'dummy',
});

const response = await client.chat.completions.create({
  model: 'codewhisperer',
  messages: [
    { role: 'user', content: 'Write a hello world function in Python' }
  ],
});

console.log(response.choices[0].message.content);
```

Run it:
```bash
node test.js
```

## Streaming Example

### Python with Streaming

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="dummy"
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
        print(chunk.choices[0].delta.content, end="", flush=True)
print()
```

### JavaScript with Streaming

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:3000/v1',
  apiKey: 'dummy',
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
console.log();
```

## Using with Continue.dev

Continue.dev is a popular VS Code / JetBrains extension for AI coding assistance.

1. Install the Continue extension in VS Code

2. Open Continue settings (click the gear icon)

3. Add this configuration:

```json
{
  "models": [
    {
      "title": "CodeWhisperer",
      "provider": "openai",
      "model": "codewhisperer",
      "apiBase": "http://localhost:3000/v1",
      "apiKey": "dummy"
    }
  ]
}
```

4. Select "CodeWhisperer" as your model

## Using with Cursor IDE

Cursor is a fork of VS Code with built-in AI features.

1. Open Cursor Settings (Ctrl+,)

2. Search for "API Key"

3. Set up OpenAI API:
   - API Key: `dummy`
   - API URL: `http://localhost:3000/v1`
   - Model: `codewhisperer`

## Conversation Context

The proxy maintains conversation history automatically:

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="dummy"
)

# First message
response1 = client.chat.completions.create(
    model="codewhisperer",
    messages=[
        {"role": "user", "content": "Write a Python function to add two numbers"}
    ]
)

print(response1.choices[0].message.content)

# Follow-up message with history
response2 = client.chat.completions.create(
    model="codewhisperer",
    messages=[
        {"role": "user", "content": "Write a Python function to add two numbers"},
        {"role": "assistant", "content": response1.choices[0].message.content},
        {"role": "user", "content": "Now modify it to add three numbers"}
    ]
)

print(response2.choices[0].message.content)
```

## Troubleshooting

### "No valid token" error

Your authentication has expired. Delete the token and re-authenticate:

```bash
rm -rf ~/.codewhisperer-proxy
npm run dev
```

### Connection refused

Make sure the server is running:

```bash
npm run dev
```

### Empty responses

Check the server logs for errors. Common issues:
- Network connectivity problems
- AWS service outage
- Invalid request format

## Next Steps

- Read the full [README.md](README.md) for more features
- Check out the [CodeWhisperer Streaming Client Guide](docs/codewhisperer-streaming-client-guide.md)
- Explore the [examples](examples/) directory

## Getting Help

- Check the server logs for detailed error messages
- Review the documentation in the `docs/` directory
- Open an issue on GitHub if you encounter problems

## Production Deployment

For production use:

1. Build the project:
```bash
npm run build
```

2. Set environment variables:
```bash
export PORT=3000
```

3. Run the production server:
```bash
npm start
```

4. Consider using a process manager like PM2:
```bash
npm install -g pm2
pm2 start dist/proxy-server.js --name codewhisperer-proxy
```

5. Set up HTTPS with a reverse proxy (nginx, caddy, etc.)

Happy coding! 🚀
