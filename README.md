# CodeWhisperer OpenAI Proxy

一个将 AWS CodeWhisperer API 包装为 OpenAI Chat Completions 协议的代理服务，让你可以使用 OpenAI SDK/工具来访问 CodeWhisperer。

## 功能特性

- ✅ AWS Builder ID 认证（OAuth 2.0 Device Flow）
- ✅ 自动令牌刷新
- ✅ CodeWhisperer API 客户端（TypeScript 实现）
- ✅ OpenAI Chat Completions 协议兼容
- ✅ 支持流式和非流式响应
- ✅ 支持工具调用（Tool Calling / Function Calling）
- ✅ 会话历史管理

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 认证

首次使用需要通过 AWS Builder ID 进行认证：

```bash
npm run cli login
```

按照提示在浏览器中完成认证流程。认证信息会保存在 `~/.codewhisperer-proxy/` 目录下。

### 3. 测试 API

```bash
npm run cli test "写一个快速排序算法"
```

### 4. 启动代理服务器

```bash
npm run dev
```

服务器将在 `http://localhost:3000` 启动。

## 使用代理服务器

### 使用 curl

**流式请求：**

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "codewhisperer",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": true
  }'
```

**非流式请求：**

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "codewhisperer",
    "messages": [{"role": "user", "content": "写一个 Python 冒泡排序"}],
    "stream": false
  }'
```

### 使用 OpenAI Python SDK

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="any-string"  # API key 会被忽略
)

# 非流式
response = client.chat.completions.create(
    model="codewhisperer",
    messages=[
        {"role": "user", "content": "写一个快速排序"}
    ]
)
print(response.choices[0].message.content)

# 流式
stream = client.chat.completions.create(
    model="codewhisperer",
    messages=[
        {"role": "user", "content": "解释什么是递归"}
    ],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

### 工具调用示例

```python
from openai import OpenAI
import json

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="any"
)

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "获取指定城市的天气信息",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "城市名称"
                    }
                },
                "required": ["city"]
            }
        }
    }
]

# 第一次请求
response = client.chat.completions.create(
    model="codewhisperer",
    messages=[{"role": "user", "content": "北京的天气怎么样？"}],
    tools=tools
)

message = response.choices[0].message

if message.tool_calls:
    # 执行工具
    for tool_call in message.tool_calls:
        if tool_call.function.name == "get_weather":
            args = json.loads(tool_call.function.arguments)
            # 这里应该调用真实的天气 API
            result = {"temperature": 15, "condition": "晴朗"}
            
            # 第二次请求，带上工具结果
            response = client.chat.completions.create(
                model="codewhisperer",
                messages=[
                    {"role": "user", "content": "北京的天气怎么样？"},
                    message,
                    {
                        "role": "tool",
                        "content": json.dumps(result),
                        "tool_call_id": tool_call.id
                    }
                ],
                tools=tools
            )
            
            print(response.choices[0].message.content)
```

## 项目结构

```
src/
├── auth.ts                  # AWS Builder ID 认证
├── codewhisperer-client.ts  # CodeWhisperer API 客户端
├── openai-converter.ts      # OpenAI <-> CodeWhisperer 协议转换
├── proxy-server.ts          # HTTP 代理服务器
├── cli.ts                   # 命令行工具
├── types.ts                 # TypeScript 类型定义
└── index.ts                 # 库入口
```

## API 端点

### POST /v1/chat/completions

OpenAI Chat Completions 兼容的端点。

**支持的参数：**
- `model`: 模型名称（任意字符串）
- `messages`: 消息数组
- `tools`: 工具定义（可选）
- `stream`: 是否使用流式响应（默认 false）

### GET /v1/models

列出可用模型。

### GET /health

健康检查端点。

## 技术细节

详细的 API 分析和协议说明请参考 [ANALYSIS.md](./ANALYSIS.md)。

### 关键特性

1. **认证机制**
   - 使用 AWS SSO OIDC Device Flow
   - 自动检测令牌过期（提前 1 分钟）
   - 自动使用 refresh_token 刷新

2. **协议转换**
   - OpenAI messages → CodeWhisperer ConversationState
   - OpenAI tools → CodeWhisperer ToolSpecification
   - CodeWhisperer events → OpenAI streaming chunks
   - 支持多轮对话和工具调用

3. **流式响应**
   - CodeWhisperer 使用事件流
   - 转换为 OpenAI 的 Server-Sent Events 格式
   - 支持工具调用的流式参数传输

## 作为库使用

```typescript
import { AuthManager, CodeWhispererClient } from 'codewhisperer-openai-proxy';

// 认证
const authManager = new AuthManager();
await authManager.authenticate();

// 使用客户端
const token = await authManager.getValidToken();
const client = new CodeWhispererClient({
  tokenProvider: async () => token!.access_token
});

// 发送请求
for await (const event of client.generateAssistantResponse({
  conversationState: {
    currentMessage: {
      userInputMessage: {
        content: "Hello",
        origin: "CLI"
      }
    },
    chatTriggerType: "MANUAL"
  }
})) {
  if ('assistantResponseEvent' in event) {
    console.log(event.assistantResponseEvent.content);
  }
}
```

## 限制和注意事项

1. CodeWhisperer 的具体能力取决于你的 AWS Builder ID 账户权限
2. 可能存在速率限制和月度使用限制
3. 某些 OpenAI 特定的参数（如 temperature）可能不被支持
4. 工具调用的格式需要符合 CodeWhisperer 的要求

## 故障排查

### 403 AccessDeniedException 错误

如果遇到 `403 Forbidden` 或 `AccessDeniedException` 错误：

```bash
# 清理旧的认证信息
rm -rf ~/.codewhisperer-proxy

# 重新登录
npm run cli login
```

详细说明请参阅 [FIX_403_ERROR.md](./FIX_403_ERROR.md)。

### 其他常见问题

- **Token 过期**：Token 会自动刷新，如遇问题请重新登录
- **无法连接**：检查网络连接和 AWS 服务状态
- **API 错误**：查看错误日志，确认账户权限和配额

## License

MIT
