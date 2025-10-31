# Bug 修复总结：403 AccessDeniedException

## 问题描述

用户在成功完成 AWS Builder ID 认证后，尝试使用 `npm run cli test` 测试 API 时遇到 403 错误：

```
Error: CodeWhisperer API error: 403 Forbidden
{"__type":"com.amazon.aws.codewhisperer#AccessDeniedException","message":"User is not authorized to make this call."}
```

## 根本原因

CodeWhisperer 的 `GenerateAssistantResponse` API（用于聊天/对话功能）需要 `codewhisperer:conversations` 权限范围（scope），但项目初始配置中只包含了：
- `codewhisperer:completions` - 代码补全
- `codewhisperer:analysis` - 代码分析

缺少对话功能所需的权限范围导致 API 调用被拒绝。

## 解决方案

### 代码修改

1. **更新权限范围** (`src/auth.ts`)
   - 在 SCOPES 数组中添加 `codewhisperer:conversations`
   - 修改前: `['codewhisperer:completions', 'codewhisperer:analysis']`
   - 修改后: `['codewhisperer:completions', 'codewhisperer:analysis', 'codewhisperer:conversations']`

### 文档更新

2. **创建故障排查文档** (`FIX_403_ERROR.md`)
   - 详细说明问题原因和解决步骤
   - 提供自动和手动两种修复方式
   - 包含技术说明和常见问题解答

3. **更新 README.md**
   - 添加"故障排查"章节
   - 说明 403 错误的解决方法
   - 提供到详细文档的链接

4. **更新 QUICKSTART.md**
   - 扩展故障排查部分
   - 强调需要重新登录的重要性
   - 添加错误现象示例

5. **更新 CHANGELOG.md**
   - 记录版本 1.0.1 的修复内容
   - 提供升级说明

### 工具和脚本

6. **创建自动修复脚本** (`scripts/fix-403-error.sh`)
   - 提供交互式修复流程
   - 显示当前令牌信息
   - 引导用户重新登录

7. **添加 npm 脚本** (`package.json`)
   - 新增 `npm run fix-403` 命令
   - 方便用户快速修复问题
   - 更新版本号到 1.0.1

## 用户操作指南

### 对于现有用户（已登录过）

由于 OAuth 2.0 的权限范围在客户端注册时确定，现有用户需要：

```bash
# 方式 1: 使用自动修复脚本（推荐）
npm run fix-403

# 方式 2: 手动修复
rm -rf ~/.codewhisperer-proxy
npm run cli login
```

### 对于新用户

直接登录即可获得完整权限：

```bash
npm run cli login
npm run cli test "Hello"
```

## 技术细节

### OAuth 2.0 权限范围

- OAuth 2.0 的 scopes 在客户端注册（`RegisterClient`）时声明
- 访问令牌（access token）的权限由注册时的 scopes 决定
- 无法在不重新注册的情况下扩展现有令牌的权限

### AWS CodeWhisperer API

- `GenerateAssistantResponse` API 需要会话/对话权限
- 不同的 API 端点可能需要不同的权限范围
- 权限不足时返回 HTTP 403 AccessDeniedException

### 为什么需要清理配置

项目缓存了两类信息：
1. **客户端注册信息** (`registration.json`)
   - 包含 client_id 和 client_secret
   - 关联特定的 scopes
   
2. **访问令牌** (`tokens.json`)
   - 基于注册信息获得
   - 继承注册时的 scopes

清理配置后重新登录会：
1. 重新注册客户端（使用新的 scopes）
2. 获取新的访问令牌（包含所有必需权限）

## 验证方法

修复后，运行测试命令应该成功：

```bash
$ npm run cli test "写一个快速排序算法"

Testing CodeWhisperer API...

Question: 写一个快速排序算法

Response:
[CodeWhisperer 的回复内容]
```

## 影响范围

- **破坏性变更**: 否
- **需要用户操作**: 是（现有用户需要重新登录）
- **向后兼容**: 是（新权限是额外添加，不影响现有功能）
- **测试状态**: 需要用户在实际环境中验证

## 相关文件

### 修改的文件
- `src/auth.ts` - 核心修复
- `package.json` - 版本号和脚本
- `README.md` - 故障排查指南
- `QUICKSTART.md` - 快速开始指南
- `CHANGELOG.md` - 变更日志

### 新增的文件
- `FIX_403_ERROR.md` - 详细故障排查文档
- `scripts/fix-403-error.sh` - 自动修复脚本
- `BUGFIX_SUMMARY.md` - 本文档

## 未来改进

1. **自动检测和提示**
   - 在遇到 403 错误时自动提示用户运行修复脚本
   - 检查令牌的 scopes 并在不足时警告

2. **版本迁移**
   - 实现配置版本管理
   - 自动迁移旧版本配置

3. **权限验证**
   - 登录后验证所有必需的 scopes
   - 提前发现权限问题

4. **更好的错误消息**
   - 捕获 AccessDeniedException
   - 提供具体的修复建议

## 参考资料

- [AWS Builder ID 文档](https://docs.aws.amazon.com/signin/latest/userguide/sign-in-aws_builder_id.html)
- [OAuth 2.0 Device Flow](https://oauth.net/2/device-flow/)
- [AWS SSO OIDC API](https://docs.aws.amazon.com/singlesignon/latest/OIDCAPIReference/Welcome.html)
