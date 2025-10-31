# EventStream 解析问题修复总结

## 问题

之前的代码使用 `TextDecoder` 尝试解码 AWS EventStream 响应，但这是错误的：

1. AWS 返回的是**二进制格式的 EventStream**（`application/vnd.amazon.eventstream`）
2. 不是普通的文本格式 SSE（Server-Sent Events）
3. 直接使用TextDecoder会将二进制头部错误地转换为文本，导致乱码

## 解决方案

### 1. 安装AWS官方EventStream编解码库

```bash
npm install @smithy/eventstream-codec @smithy/eventstream-serde-universal @smithy/util-utf8
```

### 2. 使用EventStreamCodec正确解析二进制流

```typescript
import { EventStreamCodec } from '@smithy/eventstream-codec';
import { toUtf8, fromUtf8 } from '@smithy/util-utf8';

// 创建codec
const codec = new EventStreamCodec(toUtf8, fromUtf8);

// 循环读取二进制数据并喂给codec
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  codec.feed(value); // 喂入二进制数据
  
  // 获取解析后的消息
  const availableMessages = codec.getAvailableMessages();
  const messages = availableMessages.getMessages();
  
  for (const message of messages) {
    // message.headers 包含元数据
    // message.body 是二进制payload，需要用toUtf8转换
    const bodyText = toUtf8(message.body);
    const bodyData = JSON.parse(bodyText);
  }
}
```

### 3. 正确映射事件类型

根据消息头部的 `:event-type` 字段，将事件映射到正确的格式：

```typescript
switch (eventType) {
  case 'initial-response':
    return { messageMetadataEvent: bodyData };
  case 'assistantResponseEvent':
    return { assistantResponseEvent: bodyData };
  case 'codeEvent':
    return { codeEvent: bodyData };
  // ...其他事件类型
}
```

## 修改的文件

- `src/codewhisperer-client.ts`
  - 导入 `EventStreamCodec`, `toUtf8`, `fromUtf8`
  - 重写 `parseEventStream` 方法使用EventStreamCodec
  - 添加 `parseEventFromMessage` 方法解析消息

- `package.json`
  - 添加依赖：
    - `@smithy/eventstream-codec`
    - `@smithy/eventstream-serde-universal`
    - `@smithy/util-utf8` (作为传递依赖)

## 技术细节

### AWS EventStream 二进制格式

```
+----------------+
| Total Length   |  4 bytes (uint32, big-endian)
+----------------+
| Header Length  |  4 bytes (uint32, big-endian)
+----------------+
| Prelude CRC    |  4 bytes (uint32, big-endian)
+----------------+
| Headers        |  Variable length
|                |  - :message-type (string)
|                |  - :event-type (string)
|                |  - :content-type (string)
+----------------+
| Payload        |  Variable length (JSON)
+----------------+
| Message CRC    |  4 bytes (uint32, big-endian)
+----------------+
```

### 重要的类型签名

- `Encoder: (input: Uint8Array | string) => string`
- `Decoder: (input: string) => Uint8Array`
- `toUtf8: (input: Uint8Array | string) => string` - 这是Encoder
- `fromUtf8: (input: string) => Uint8Array` - 这是Decoder
- `EventStreamCodec(encoder, decoder)` - 注意参数顺序

### 调试日志保留

保留了调试日志以便用户验证修复是否成功：
- 显示接收到的chunk数量和大小
- 显示解析出的消息数量
- 显示消息头部和解析后的事件

## 测试

用户需要重新登录并测试：

```bash
# 如果token已过期，重新登录
npm run cli login

# 测试聊天功能
npm run cli test "写一个快速排序算法"
```

应该能够看到：
1. `[DEBUG] Starting to parse event stream...`
2. `[DEBUG] Decoded message 1, 2, 3...`（不再是0个消息）
3. 正确解析出的中文内容
4. 完整的快速排序代码示例

## 参考

- Amazon Q Developer CLI 源码：`amazon-q-developer-cli/crates/amzn-codewhisperer-streaming-client/src/event_stream_serde.rs`
- AWS Smithy EventStream 规范
- `@smithy/eventstream-codec` 库文档
