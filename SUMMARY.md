# 项目总结

## 项目概述

本项目成功提取了 AWS amazon-q-developer-cli 中的私有 CodeWhisperer API，并实现了一个 OpenAI Chat Completions 协议兼容的代理服务。

## 完成的工作

### 1. 源代码分析

通过分析 `amazon-q-developer-cli` 项目（Rust 实现），我们深入理解了：

- **认证机制**：AWS SSO OIDC (OAuth 2.0 Device Code Flow)
  - 使用 RegisterClient, StartDeviceAuthorization, CreateToken API
  - Token 自动刷新机制
  - 过期检测（提前 1 分钟标记为过期）

- **API 协议**：
  - HTTP POST 到 `/` 
  - Headers: `x-amz-target: AmazonCodeWhispererStreamingService.GenerateAssistantResponse`
  - 认证: Bearer Token
  - 请求体: JSON 格式的 ConversationState

- **消息结构**：
  - UserInputMessage: 用户输入 + 上下文（环境、工具、工具结果）
  - AssistantResponseMessage: 助手回复 + 工具调用
  - 支持多轮对话历史

- **响应格式**：
  - 事件流（Event Stream）
  - 多种事件类型：AssistantResponseEvent, CodeEvent, ToolUseEvent 等
  - 工具调用的参数以流式方式发送

- **Tool Call 流程**：
  1. 客户端发送带工具定义的消息
  2. 服务端返回 ToolUseEvent
  3. 客户端执行工具
  4. 客户端发送工具结果
  5. 服务端基于结果继续回复

详细分析见 [ANALYSIS.md](./ANALYSIS.md)。

### 2. TypeScript 实现

#### 认证模块 (`src/auth.ts`)

```typescript
class AuthManager {
  registerClient()         // 注册 OIDC 客户端
  startDeviceAuthorization() // 启动设备授权
  pollForToken()           // 轮询获取令牌
  refreshToken()           // 刷新令牌
  getValidToken()          // 获取有效令牌（自动刷新）
  authenticate()           // 完整认证流程
}
```

特性：
- 自动缓存客户端注册信息
- 自动检测并刷新过期令牌
- 安全存储在 `~/.codewhisperer-proxy/`

#### API 客户端 (`src/codewhisperer-client.ts`)

```typescript
class CodeWhispererClient {
  async *generateAssistantResponse()  // 流式响应
  generateAssistantResponseNonStreaming() // 非流式响应
}
```

特性：
- 异步生成器支持流式响应
- 自动解析事件流
- 拼接工具调用参数

#### 协议转换器 (`src/openai-converter.ts`)

```typescript
class OpenAIToCodeWhispererConverter {
  convertToCodeWhispererRequest()       // OpenAI -> CodeWhisperer
  convertToOpenAIStreamingResponse()    // 流式转换
  convertToOpenAINonStreamingResponse() // 非流式转换
}
```

特性：
- 完整支持 OpenAI messages 格式
- 支持 system、user、assistant、tool 角色
- 自动管理会话 ID
- 工具调用双向转换

#### 代理服务器 (`src/proxy-server.ts`)

HTTP 服务器实现：
- `POST /v1/chat/completions` - OpenAI 兼容端点
- `GET /v1/models` - 列出模型
- `GET /health` - 健康检查

特性：
- 支持流式和非流式响应
- 按 API Key 管理独立会话
- SSE (Server-Sent Events) 格式输出

### 3. 文档和示例

- **ANALYSIS.md**: 详细的 API 分析文档
- **README.md**: 使用说明和快速开始
- **DEPLOYMENT.md**: 部署指南
- **examples/**:
  - `basic-usage.ts`: 基础用法示例
  - `tool-calling.ts`: 工具调用示例
  - `openai-client.py`: Python SDK 使用示例

## 关键发现

### 1. 双客户端架构

amazon-q-developer-cli 支持两种客户端：
- **CodeWhispererStreamingClient**: Bearer Token 认证（Builder ID）
- **QDeveloperStreamingClient**: SigV4 认证（IAM）

我们实现了 Bearer Token 方式，因为它更适合个人开发者。

### 2. 流式工具调用

与 OpenAI API 不同，CodeWhisperer 的工具参数是流式发送的：
```
ToolUseEvent: { input: "{\"city\"", stop: false }
ToolUseEvent: { input: ": \"北京\"}", stop: true }
```

需要在客户端拼接完整的 JSON。

### 3. 会话管理

CodeWhisperer 使用 `conversation_id` 来维护多轮对话：
- 首次请求 `conversationId` 为 null
- 服务端返回 `MessageMetadataEvent` 包含 `conversation_id`
- 后续请求带上这个 ID 以保持上下文

### 4. 历史消息格式

需要将完整的消息历史转换为 CodeWhisperer 的 ChatMessage 格式，包括：
- 之前的用户消息
- 之前的助手回复（包括工具调用）
- 不包括最新的消息（放在 currentMessage 中）

### 5. 环境上下文

CodeWhisperer 支持丰富的上下文信息：
- 操作系统
- 当前工作目录
- 环境变量
- Git 状态

这些可以帮助 AI 提供更精准的回答。

## 技术栈

### 后端
- **TypeScript**: 类型安全的 JavaScript
- **Node.js**: 运行时环境
- **Express**: Web 框架
- **@aws-sdk/client-sso-oidc**: AWS OIDC 认证

### 开发工具
- **tsx**: TypeScript 执行器
- **tsc**: TypeScript 编译器

### 协议
- **HTTP/REST**: API 通信
- **SSE (Server-Sent Events)**: 流式响应
- **OAuth 2.0 Device Flow**: 认证流程
- **JSON**: 数据格式

## 使用场景

### 1. 开发工具集成

将 CodeWhisperer 集成到支持 OpenAI API 的工具中：
- Continue (VSCode 扩展)
- Cursor
- Open WebUI
- 各种 AI 聊天客户端

### 2. 自定义应用

基于 CodeWhisperer 构建自定义应用：
- 代码助手
- 文档生成工具
- 代码审查工具
- 技术问答系统

### 3. 成本优化

如果你有 AWS Builder ID 账户，可以使用 CodeWhisperer 作为：
- OpenAI API 的备用方案
- 开发环境的主要 AI 后端

## 限制和注意事项

### 功能限制
1. **模型选择**: 无法指定具体模型，由 AWS 决定
2. **参数支持**: 不支持 temperature、top_p 等采样参数
3. **上下文窗口**: 具体限制未公开，但在错误信息中会提示"Input is too long"
4. **速率限制**: 存在请求速率限制和月度限制

### 账户限制
1. 需要 AWS Builder ID 账户
2. 可能需要特定的权限或订阅
3. 使用量可能受到账户级别的限制

### 技术限制
1. **认证持久化**: 目前使用文件系统存储，不适合无状态部署
2. **会话隔离**: 需要使用不同的 API Key 来隔离不同用户的会话
3. **错误处理**: CodeWhisperer 的错误信息有限

## 未来改进方向

### 1. 增强的认证
- 支持多用户管理
- 数据库存储认证信息
- 支持 IAM SigV4 认证（QDeveloper 模式）

### 2. 更好的协议支持
- 支持更多 OpenAI 参数（映射到 CodeWhisperer 的等效功能）
- 支持图片输入（CodeWhisperer 已支持）
- 支持 function calling 的完整语义

### 3. 性能优化
- 连接池
- 请求缓存
- 响应压缩

### 4. 监控和日志
- 请求指标收集
- 详细的错误日志
- 成本追踪

### 5. 部署增强
- Helm Chart
- Docker Compose 配置
- 云服务集成（AWS Lambda、Cloud Run 等）

## 测试建议

由于需要真实的 AWS Builder ID 账户，建议的测试流程：

1. **认证测试**
   ```bash
   npm run cli login
   ```

2. **基础 API 测试**
   ```bash
   npm run cli test "Hello"
   ```

3. **代理服务器测试**
   ```bash
   npm run dev
   curl http://localhost:3000/health
   ```

4. **OpenAI SDK 集成测试**
   ```bash
   python examples/openai-client.py basic
   ```

5. **工具调用测试**
   ```bash
   python examples/openai-client.py tools
   ```

## 贡献指南

如果你想改进这个项目：

1. Fork 仓库
2. 创建功能分支
3. 提交 PR

重点改进领域：
- 更好的错误处理
- 更多的测试用例
- 文档改进
- 新功能实现

## 许可证

MIT License

## 致谢

本项目基于对 `aws/amazon-q-developer-cli` 的逆向工程分析实现。感谢 AWS 开源的命令行工具，让我们能够理解 CodeWhisperer 的 API 协议。

## 相关资源

- [AWS CodeWhisperer](https://aws.amazon.com/codewhisperer/)
- [Amazon Q Developer CLI](https://github.com/aws/amazon-q-developer-cli)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [OAuth 2.0 Device Flow RFC](https://tools.ietf.org/html/rfc8628)
