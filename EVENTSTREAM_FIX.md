# EventStream 解析问题修复

## 问题描述

之前的实现尝试使用 `TextDecoder` 直接解码 AWS EventStream 响应，但这是错误的做法。AWS 返回的是**二进制格式的 EventStream**（`application/vnd.amazon.eventstream`），不是普通的文本格式 SSE（Server-Sent Events）。

### 症状

- 响应状态码是 200 OK
- 能接收到数据块
- 但从 chunk 3 开始内容就出现乱码
- 最终解析出 0 个有效事件

示例乱码输出：
```
[DEBUG] Received chunk 4, size: 155 bytes
[DEBUG] Chunk content: ��\�)Է
:└␊⎽⎽▒±␊-├≤⎻␊␊┴␊┼├π"␌⎺┼├␊┼├":"⎽⎺⎼├(▒⎼⎼):\┼    ␋° ┌␊┼(▒⎼⎼) <= 1:"£I�0
```

## 根本原因

AWS EventStream 是一种二进制协议，包含：
1. 消息总长度（4字节）
2. 头部长度（4字节）
3. Prelude CRC（4字节）
4. 头部（变长，包含 `:message-type` 和 `:event-type` 等）
5. Payload（JSON数据）
6. Message CRC（4字节）

使用 `TextDecoder` 会将二进制头部错误地转换为文本，导致解析失败。

## 解决方案

### 1. 安装必要的依赖

```bash
npm install @smithy/eventstream-codec @smithy/eventstream-serde-universal
```

这些是 AWS Smithy 团队提供的官方 EventStream 编解码库，与 Amazon Q Developer CLI 使用的 Rust 版本相同。

### 2. 使用正确的解码器

```typescript
import { EventStreamCodec } from '@smithy/eventstream-codec';
import { toUtf8, fromUtf8 } from '@smithy/util-utf8';

// 注意：fromUtf8 将字符串转换为字节，toUtf8 将字节转换为字符串
const codec = new EventStreamCodec(fromUtf8, toUtf8);

// 循环读取二进制数据
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  // 将二进制数据喂给解码器
  codec.feed(value);
  
  // 获取所有已解析的消息
  const messages = codec.getAvailableMessages();
  for (const message of messages) {
    // message.headers 包含 :message-type, :event-type 等
    // message.body 是 Uint8Array，需要用 toUtf8 转换为字符串
  }
}
```

### 3. 正确处理消息头部和正文

```typescript
private parseEventFromMessage(message: any): CodeWhispererEvent | null {
  const headers = message.headers;
  const messageType = headers[':message-type']?.value;
  const eventType = headers[':event-type']?.value;

  // 将二进制正文转换为 UTF-8 字符串
  const bodyText = toUtf8(message.body);
  const bodyData = JSON.parse(bodyText);

  // 根据事件类型映射到我们的事件格式
  switch (eventType) {
    case 'assistantResponseEvent':
      return { assistantResponseEvent: bodyData };
    // ... 其他事件类型
  }
}
```

## 关键点

1. **EventStream 是二进制格式**，不是文本格式
2. **必须使用专门的解码器**，不能直接用 TextDecoder
3. **`fromUtf8` 和 `toUtf8` 的作用是反的**：
   - `fromUtf8(string)` → Uint8Array
   - `toUtf8(Uint8Array)` → string
4. 消息头部包含元数据（如 `:message-type`, `:event-type`）
5. 消息正文是 JSON 格式的字节数组

## 参考

- Amazon Q Developer CLI 源码：
  - `amazon-q-developer-cli/crates/amzn-codewhisperer-streaming-client/src/event_stream_serde.rs`
- AWS Smithy EventStream 规范
- `@smithy/eventstream-codec` 库文档

## 测试

用户需要重新登录并测试：

```bash
# 如果 token 已过期，重新登录
npm run cli login

# 测试聊天功能
npm run cli test "写一个快速排序算法"
```

现在应该能够正确解析服务端返回的中文响应。
