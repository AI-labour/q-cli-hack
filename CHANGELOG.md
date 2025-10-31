# Changelog

## [1.0.0] - 2024-10-31

### 初始版本

#### 已添加
- 🎉 首次发布
- ✅ AWS Builder ID 认证（OAuth 2.0 Device Code Flow）
- ✅ CodeWhisperer API 客户端（TypeScript 实现）
- ✅ OpenAI Chat Completions 协议兼容层
- ✅ HTTP 代理服务器
- ✅ 流式和非流式响应支持
- ✅ 工具调用（Function Calling）支持
- ✅ 多轮对话支持
- ✅ CLI 工具（登录和测试）
- ✅ 完整的 TypeScript 类型定义
- ✅ 使用示例（TypeScript 和 Python）
- ✅ 详细文档

#### 核心模块
- `src/auth.ts` - AWS SSO OIDC 认证管理
- `src/codewhisperer-client.ts` - CodeWhisperer API 客户端
- `src/openai-converter.ts` - OpenAI 协议转换器
- `src/proxy-server.ts` - HTTP 代理服务器
- `src/cli.ts` - 命令行工具
- `src/types.ts` - TypeScript 类型定义
- `src/index.ts` - 库入口

#### 文档
- `ANALYSIS.md` - CodeWhisperer API 详细分析
- `README.md` - 项目说明和使用指南
- `DEPLOYMENT.md` - 部署和运维指南
- `SUMMARY.md` - 项目总结和关键发现
- `QUICKSTART.md` - 快速上手指南
- `TODO.md` - 任务清单和项目成果
- `PROJECT_CHECKLIST.md` - 项目完成清单

#### 示例
- `examples/basic-usage.ts` - 基础使用示例
- `examples/tool-calling.ts` - 工具调用示例
- `examples/openai-client.py` - Python SDK 集成示例

#### 功能特性
- 自动令牌刷新（在过期前 1 分钟）
- 会话管理（基于 conversation_id）
- 工具调用参数缓冲（流式拼接）
- SSE (Server-Sent Events) 流式输出
- 错误处理和分类
- 多用户会话隔离（按 API Key）

#### API 端点
- `POST /v1/chat/completions` - OpenAI 兼容的聊天完成
- `GET /v1/models` - 列出可用模型
- `GET /health` - 健康检查

#### 技术栈
- TypeScript 5.6.3
- Node.js 18+
- Express 4.21.1
- AWS SDK for JavaScript v3

### 已知限制
- 需要 AWS Builder ID 账户
- 不支持所有 OpenAI 参数（如 temperature）
- 认证信息存储在本地文件系统
- 可能存在速率限制和月度使用限制

### 未来计划
- [ ] 支持图片输入
- [ ] 支持环境上下文
- [ ] 支持 IAM SigV4 认证
- [ ] 多用户管理
- [ ] 单元测试
- [ ] 性能优化
- [ ] 监控和日志增强

---

## 版本说明

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/) 规范。

### 版本号格式
- **主版本号（MAJOR）**：不兼容的 API 变更
- **次版本号（MINOR）**：向下兼容的功能性新增
- **修订号（PATCH）**：向下兼容的问题修正

### 变更类型
- `已添加`：新功能
- `已更改`：现有功能的变更
- `已弃用`：即将移除的功能
- `已移除`：已移除的功能
- `已修复`：错误修复
- `安全性`：安全问题修复
