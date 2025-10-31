# Bug Fix: chatTriggerType 值错误导致 400 Bad Request

## 问题描述

用户在使用 `npm run cli test` 命令时遇到 400 Bad Request 错误：

```
Error: CodeWhisperer API error: 400 Bad Request
{"__type":"com.amazon.aws.codewhisperer#ValidationException","message":"Improperly formed request."}
```

## 根本原因

通过分析 AWS Amazon Q Developer CLI 的官方源码（子模块 `amazon-q-developer-cli`），发现 `chatTriggerType` 字段的值必须是**全大写**的枚举值，而不是驼峰式大小写。

在官方代码 `crates/amzn-codewhisperer-streaming-client/src/types/_chat_trigger_type.rs` 中：

```rust
impl ChatTriggerType {
    pub fn as_str(&self) -> &str {
        match self {
            ChatTriggerType::Diagnostic => "DIAGNOSTIC",
            ChatTriggerType::InlineChat => "INLINE_CHAT",
            ChatTriggerType::Manual => "MANUAL",
            ChatTriggerType::Unknown(value) => value.as_str(),
        }
    }
}
```

可以看到，枚举值被序列化为：
- `"MANUAL"` (正确) 而不是 `"Manual"` (错误)
- `"DIAGNOSTIC"` (正确) 而不是 `"Diagnostic"` (错误)  
- `"INLINE_CHAT"` (正确) 而不是 `"InlineChat"` (错误)

## 修复内容

### 1. 更新类型定义 (`src/types.ts`)

```typescript
export interface ConversationState {
  conversationId?: string;
  currentMessage: ChatMessage;
  chatTriggerType: 'MANUAL' | 'DIAGNOSTIC' | 'INLINE_CHAT';  // 改为大写
  history?: ChatMessage[];
}
```

### 2. 更新 CLI 代码 (`src/cli.ts`)

```typescript
chatTriggerType: 'MANUAL',  // 从 'Manual' 改为 'MANUAL'
```

### 3. 更新转换器 (`src/openai-converter.ts`)

```typescript
chatTriggerType: 'MANUAL',  // 从 'Manual' 改为 'MANUAL'
```

### 4. 更新文档示例

- `README.md` - 更新示例代码
- `ANALYSIS.md` - 更新 JSON 示例

### 5. 添加调试日志 (`src/codewhisperer-client.ts`)

添加了请求内容打印功能，方便用户调试：

```typescript
console.log('[DEBUG] Request body:', JSON.stringify(request, null, 2));
```

## 测试方法

用户可以通过以下方式测试修复：

```bash
# 构建项目
npm install
npm run build

# 测试 API（需要先登录）
npm run cli login
npm run cli test "写一个快速排序算法"
```

## 参考资料

- Amazon Q Developer CLI 官方源码：`amazon-q-developer-cli` 子模块
- 序列化代码：`crates/amzn-codewhisperer-streaming-client/src/protocol_serde/`
- 枚举定义：`crates/amzn-codewhisperer-streaming-client/src/types/_chat_trigger_type.rs`
