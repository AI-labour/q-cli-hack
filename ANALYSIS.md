# AWS CodeWhisperer API 分析文档

## 1. 用户凭证信息机制

### 1.1 认证流程
AWS CodeWhisperer 使用 **AWS SSO OIDC (OAuth 2.0 Device Code Flow)** 进行认证。

#### 认证步骤：
1. **注册客户端** (`registerClient`)
   - 获取 `client_id` 和 `client_secret`
   - 客户端注册信息可能有效数月，应缓存到磁盘
   - 包含过期时间 `client_secret_expires_at`

2. **启动设备授权** (`startDeviceAuthorization`)
   - 获取设备验证码 (`device_code`)
   - 获取用户验证码 (`user_code`)
   - 获取验证 URI (`verification_uri`, `verification_uri_complete`)
   - 包含过期时间 (`expires_in`) 和轮询间隔 (`interval`)

3. **轮询令牌** (`createToken`)
   - 使用 `device_code` 轮询获取访问令牌
   - 返回 `access_token`, `expires_in`, `refresh_token`

4. **刷新令牌** (当令牌过期时)
   - 使用 `refresh_token` 和 `grant_type=refresh_token` 调用 `createToken`
   - 返回新的 `access_token` 和 `refresh_token`

### 1.2 令牌结构
```typescript
interface BuilderIdToken {
  access_token: string;        // Bearer token，用于 API 认证
  expires_at: string;          // ISO 8601 格式的过期时间
  refresh_token?: string;      // 用于刷新访问令牌
  region?: string;             // OIDC 区域
  start_url?: string;          // SSO 起始 URL
  oauth_flow: "DeviceCode" | "Pkce";
  scopes?: string[];           // OAuth 范围
}
```

### 1.3 过期和刷新机制
- **过期检查**：令牌在实际过期时间前 **1 分钟** 就被标记为过期，留出传输时间余量
- **自动刷新**：当检测到令牌过期且存在 `refresh_token` 时，自动调用刷新流程
- **刷新失败处理**：
  - 如果刷新令牌失败且是客户端错误（非 SlowDown），删除本地令牌
  - 需要用户重新进行设备授权流程
- **存储位置**：令牌存储在系统密钥存储中（keychain/credential store）
  - 密钥键：`codewhisperer:odic:token`

### 1.4 OIDC 端点
- 格式：`https://oidc.{region}.amazonaws.com`
- 默认区域：`us-east-1`
- 方法：
  - `POST /client/register` - 注册客户端
  - `POST /device_authorization` - 启动设备授权
  - `POST /token` - 创建/刷新令牌

## 2. CodeWhisperer API 交互过程

### 2.1 API 端点和认证
- **基础 URL**：可配置，默认指向 CodeWhisperer 服务
- **HTTP 方法**：POST
- **路径**：`/`
- **认证方式**：HTTP Bearer Token
  - Header: `Authorization: Bearer {access_token}`

### 2.2 请求格式

#### HTTP Headers
```
POST / HTTP/1.1
Content-Type: application/x-amz-json-1.0
x-amz-target: AmazonCodeWhispererStreamingService.GenerateAssistantResponse
Authorization: Bearer {access_token}
```

#### Request Body (JSON)
```json
{
  "conversationState": {
    "conversationId": "uuid-string",
    "currentMessage": {
      // ChatMessage (UserInputMessage 或 AssistantResponseMessage)
    },
    "chatTriggerType": "Manual",
    "history": [
      // 历史消息数组 (ChatMessage[])
    ]
  },
  "profileArn": "arn:aws:...",  // 可选
  "agentMode": "AUTO"  // 可选
}
```

### 2.3 消息类型

#### UserInputMessage
```typescript
interface UserInputMessage {
  content: string;
  origin: "CLI" | "CHAT";
  user_input_message_context?: {
    env_state?: {
      operating_system?: string;
      current_working_directory?: string;
      environment_variables?: Array<{
        key: string;
        value: string;
      }>;
    };
    git_state?: {
      status: string;
    };
    tool_results?: ToolResult[];  // Tool call 执行结果
    tools?: Tool[];               // 可用的工具定义
  };
  user_intent?: "ApplyCommonBestPractices";
  images?: Array<{
    format: "png" | "jpeg" | "gif" | "webp";
    source: {
      bytes: Uint8Array;
    };
  }>;
  model_id?: string;
}
```

#### AssistantResponseMessage
```typescript
interface AssistantResponseMessage {
  message_id?: string;
  content: string;
  tool_uses?: ToolUse[];
}
```

#### Tool 相关结构
```typescript
interface Tool {
  toolSpecification: {
    name: string;
    description: string;
    input_schema: {
      json?: Document;  // JSON Schema
    };
  };
}

interface ToolUse {
  tool_use_id: string;
  name: string;
  input: Document;  // JSON object
}

interface ToolResult {
  tool_use_id: string;
  content: Array<
    { text: string } | 
    { json: Document }
  >;
  status: "Success" | "Error";
}
```

### 2.4 响应格式（Streaming）

响应是基于 **Event Stream** 的流式响应，使用 AWS 的事件流协议。

#### 事件类型

##### 1. AssistantResponseEvent
```json
{
  "assistantResponseEvent": {
    "content": "助手回复的文本内容"
  }
}
```
- 用途：流式返回助手的文本回复
- 会发送多个事件，每个包含部分内容

##### 2. CodeEvent
```json
{
  "codeEvent": {
    "content": "生成的代码内容"
  }
}
```
- 用途：流式返回生成的代码
- 与 AssistantResponseEvent 类似，但专门用于代码块

##### 3. ToolUseEvent
```json
{
  "toolUseEvent": {
    "tool_use_id": "tooluse_xxx",
    "name": "tool_name",
    "input": "{\"param\": \"value\"}",  // JSON string
    "stop": false
  }
}
```
- 用途：请求执行工具
- `input` 是 JSON 字符串格式的工具输入参数
- `stop` 为 true 时表示工具输入完成
- 可能收到多个 ToolUseEvent（不同的 tool_use_id）

##### 4. MessageMetadataEvent
```json
{
  "messageMetadataEvent": {
    "conversation_id": "uuid",
    "utterance_id": "uuid"
  }
}
```
- 用途：提供会话元数据
- conversation_id: 用于后续请求中保持会话
- utterance_id: 唯一标识此次对话轮次

##### 5. InvalidStateEvent
```json
{
  "invalidStateEvent": {
    "reason": "INVALID_STATE",
    "message": "错误描述"
  }
}
```
- 用途：表示请求状态无效

##### 6. 其他事件
- `codeReferenceEvent`: 代码引用信息
- `followupPromptEvent`: 后续提示
- `intentsEvent`: 意图信息
- `supplementaryWebLinksEvent`: 补充网页链接

### 2.5 Tool Call 完整流程

#### 步骤 1: 客户端发送带工具定义的消息
```json
{
  "conversationState": {
    "conversationId": null,  // 首次请求为 null
    "currentMessage": {
      "content": "帮我查看天气",
      "origin": "CLI",
      "user_input_message_context": {
        "tools": [
          {
            "toolSpecification": {
              "name": "get_weather",
              "description": "获取指定城市的天气",
              "input_schema": {
                "json": {
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
          }
        ]
      }
    },
    "chatTriggerType": "Manual",
    "history": []
  }
}
```

#### 步骤 2: 服务端返回 Tool Use 请求
流式返回：
```
MessageMetadataEvent: { conversation_id: "conv-123", utterance_id: "utt-456" }
AssistantResponseEvent: { content: "我来" }
AssistantResponseEvent: { content: "帮你查询" }
ToolUseEvent: { tool_use_id: "tool-1", name: "get_weather", input: "{\"city\"", stop: false }
ToolUseEvent: { tool_use_id: "tool-1", name: "get_weather", input: ": \"北京\"}", stop: true }
```

#### 步骤 3: 客户端执行工具并发送结果
```json
{
  "conversationState": {
    "conversationId": "conv-123",  // 使用之前返回的 conversation_id
    "currentMessage": {
      "content": "",  // 可以为空或包含额外的用户输入
      "origin": "CLI",
      "user_input_message_context": {
        "tool_results": [
          {
            "tool_use_id": "tool-1",
            "content": [
              {
                "json": {
                  "temperature": 15,
                  "condition": "晴朗"
                }
              }
            ],
            "status": "Success"
          }
        ]
      }
    },
    "chatTriggerType": "Manual",
    "history": [
      {
        "userInputMessage": {
          "content": "帮我查看天气",
          "origin": "CLI"
        }
      },
      {
        "assistantResponseMessage": {
          "message_id": "utt-456",
          "content": "我来帮你查询",
          "tool_uses": [
            {
              "tool_use_id": "tool-1",
              "name": "get_weather",
              "input": {
                "city": "北京"
              }
            }
          ]
        }
      }
    ]
  }
}
```

#### 步骤 4: 服务端基于工具结果返回最终回复
```
AssistantResponseEvent: { content: "北京的天气" }
AssistantResponseEvent: { content: "温度是15度，晴朗。" }
```

## 3. 协议细节

### 3.1 Event Stream 格式
CodeWhisperer 使用 AWS Event Stream 格式（类似 Server-Sent Events，但使用二进制协议）：
- 每个事件包含：type, data
- Content-Type 可能是 `application/vnd.amazon.eventstream`
- 客户端需要解析二进制事件流

### 3.2 超时和重试
- 操作超时：5 分钟
- 读取超时：5 分钟
- 连接超时：5 分钟
- 停滞流保护：5 分钟宽限期
- 重试策略：自适应重试，最多 3 次，最大退避 10 秒

### 3.3 错误处理
常见错误类型：
- `AccessDeniedError`: 访问被拒绝
- `ThrottlingError`: 请求被限流（HTTP 429）
- `ValidationError`: 请求验证失败
- `ServiceQuotaExceededError`: 超出服务配额
- `InternalServerError`: 服务器内部错误
- `ServiceUnavailableError`: 服务不可用

特殊错误检测（通过响应体）：
- "Input is too long." -> 上下文窗口溢出
- "INSUFFICIENT_MODEL_CAPACITY" -> 模型过载
- "MONTHLY_REQUEST_COUNT" -> 月度限额已达

## 4. 实现建议

### 4.1 认证客户端
- 实现 OIDC 设备流程
- 在本地安全存储令牌（考虑使用环境变量或配置文件）
- 在每次请求前检查令牌过期时间，必要时刷新

### 4.2 API 客户端
- 使用流式 HTTP 客户端
- 实现事件流解析器
- 处理各种事件类型
- 实现重试和错误处理逻辑

### 4.3 OpenAI 协议转换
需要映射：
- OpenAI messages -> CodeWhisperer conversationState
- OpenAI tools -> CodeWhisperer tools
- OpenAI tool_calls -> CodeWhisperer tool_uses
- CodeWhisperer events -> OpenAI streaming chunks
- 会话历史管理（conversation_id）

## 5. 关键发现

1. **双认证系统**：项目支持两种模式
   - Bearer Token (CodeWhisperer) - 使用 BuilderID 登录
   - SigV4 (QDeveloper) - 使用 AWS IAM 凭证

2. **流式工具调用**：Tool use 的参数也是流式发送的，需要拼接

3. **会话管理**：通过 conversation_id 维护多轮对话上下文

4. **历史消息格式**：需要将完整的消息历史转换为 CodeWhisperer 格式

5. **环境上下文**：支持发送环境变量、工作目录、Git 状态等丰富上下文
