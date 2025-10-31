# 修复 403 AccessDeniedException 错误

## 问题描述

如果在运行 `npm run cli test` 时遇到以下错误：

```
Error: CodeWhisperer API error: 403 Forbidden
{"__type":"com.amazon.aws.codewhisperer#AccessDeniedException","message":"User is not authorized to make this call."}
```

这是因为您的认证令牌缺少必要的权限范围（scopes）。

## 解决方案

### 方式 1: 使用自动修复脚本（推荐）

```bash
npm run fix-403
```

此脚本会引导您完成清理和重新登录的过程。

### 方式 2: 手动修复

#### 步骤 1: 清理旧的认证信息

```bash
rm -rf ~/.codewhisperer-proxy
```

这将删除使用旧权限范围创建的认证令牌和客户端注册信息。

#### 步骤 2: 重新登录

```bash
npm run cli login
```

按照提示在浏览器中完成 AWS Builder ID 认证。新的令牌将包含以下权限范围：
- `codewhisperer:completions` - 代码补全
- `codewhisperer:analysis` - 代码分析  
- `codewhisperer:conversations` - 对话/聊天功能（新增）

#### 步骤 3: 测试

```bash
npm run cli test "写一个快速排序算法"
```

如果一切正常，您应该能看到 CodeWhisperer 的响应。

## 技术说明

### 为什么会出现这个错误？

CodeWhisperer 的 `GenerateAssistantResponse` API 用于聊天/对话功能，需要 `codewhisperer:conversations` 权限范围。之前的配置只包含了代码补全和分析的权限，因此无法调用对话 API。

### 权限范围列表

| Scope | 说明 |
|-------|------|
| `codewhisperer:completions` | 代码自动补全功能 |
| `codewhisperer:analysis` | 代码安全扫描和分析 |
| `codewhisperer:conversations` | AI 对话和聊天功能 |

### 更新内容

修改文件：`src/auth.ts`

```typescript
// 之前
const SCOPES = ['codewhisperer:completions', 'codewhisperer:analysis'];

// 现在
const SCOPES = ['codewhisperer:completions', 'codewhisperer:analysis', 'codewhisperer:conversations'];
```

## 常见问题

### Q: 为什么不能自动更新令牌？

A: OAuth 2.0 的权限范围在客户端注册时确定，无法动态添加。需要重新注册客户端并获取新令牌。

### Q: 我会丢失什么数据？

A: 只会清理本地存储的认证令牌和客户端注册信息。不会影响您在 AWS 端的任何数据或配置。

### Q: 可以保留多个认证配置吗？

A: 目前不支持。如果需要此功能，可以考虑使用不同的配置目录（通过修改 `CONFIG_DIR`）。

### Q: 仍然遇到 403 错误怎么办？

A: 请确保：
1. 您的 AWS Builder ID 账户状态正常
2. 已完成重新登录流程
3. 查看 `~/.codewhisperer-proxy/tokens.json` 中的 scopes 是否包含 `codewhisperer:conversations`

如果问题仍然存在，可能是账户权限限制，请联系 AWS 支持。

## 参考

- [AWS Builder ID 文档](https://docs.aws.amazon.com/signin/latest/userguide/sign-in-aws_builder_id.html)
- [Amazon Q Developer 文档](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/what-is.html)
- [OAuth 2.0 Device Authorization Grant](https://oauth.net/2/device-flow/)
