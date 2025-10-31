# Amazon Q Developer CLI 分析文档

本目录包含对 Amazon Q Developer CLI 项目的详细分析文档，为后续开发任务提供参考。

## 文档目录

### [01. 项目概览](./01-project-overview.md)
- 项目基本信息和简介
- 核心特性概述
- 技术栈和依赖
- 支持的平台
- 安装和使用方式
- 项目结构概览

**适用场景**: 了解项目整体情况，快速入门

---

### [02. 目录结构详解](./02-directory-structure.md)
- 顶层目录组织
- 各个 Crate 的详细结构
- 重要文件说明
- 数据存储位置
- 配置文件说明
- 构建产物说明

**适用场景**: 寻找特定功能的代码位置，理解代码组织方式

---

### [03. CLI 命令流程](./03-cli-workflow.md)
- 程序入口和执行流程
- CLI 命令结构
- 各子命令详解（Login, Chat, Agent, Settings 等）
- 命令执行上下文
- 认证检查流程
- 遥测事件处理
- 日志级别控制
- 错误处理机制

**适用场景**: 理解 CLI 如何处理用户输入，如何执行命令，添加新命令

---

### [04. 认证与授权机制](./04-authentication.md)
- 认证方式概览（Builder ID, IAM Identity Center）
- 设备授权流程详解
- PKCE OAuth 流程实现
- 令牌管理和刷新
- Bearer Token 认证
- 认证作用域（Scopes）
- 安全考虑
- 错误处理
- 区域和端点配置

**适用场景**: 处理认证相关问题，实现新的认证方式，理解安全机制

---

### [05. CodeWhisperer 协议详解](./05-codewhisperer-protocol.md)
- API 操作完整列表
  - 代码补全相关
  - 聊天和对话相关
  - 代码分析相关
  - 测试生成相关
  - 代码转换相关
  - 代码修复相关
  - 模型和配置相关
  - 订阅和使用限制相关
  - 遥测相关
- 核心数据类型详解
- 协议特性（流式响应、分页、重试等）
- 端点配置
- 错误处理
- 请求和响应示例

**适用场景**: 调用 CodeWhisperer API，理解数据格式，处理 API 错误

---

### [06. API 客户端架构](./06-api-client.md)
- 客户端层次结构
- ApiClient 核心结构
- 凭证管理（CredentialsChain, BearerResolver）
- 端点配置
- 拦截器（Interceptors）详解
- 重试配置和策略
- 超时配置
- 模型缓存实现
- 流式响应处理
- 错误处理
- 请求上下文构建
- 性能优化
- 安全考虑
- 测试支持

**适用场景**: 修改 API 客户端行为，添加拦截器，优化性能，处理网络问题

---

### [07. 开发指南](./07-development-guide.md)
- 环境准备和工具安装
- 克隆和构建项目
- 开发工作流
  - 代码编辑
  - 代码检查（clippy）
  - 代码格式化
  - 拼写检查
- 测试指南
  - 单元测试
  - 集成测试
  - 快照测试
  - 测试覆盖率
- 调试技巧
  - 日志调试
  - 调试器使用
  - VS Code 调试配置
- 性能分析
  - Benchmarking
  - 性能剖析
- 依赖管理
- 文档编写
- Git 工作流
- 常见任务示例
- 发布流程
- 故障排除
- 最佳实践

**适用场景**: 日常开发工作，解决技术问题，提高开发效率

---

## 使用建议

### 针对不同角色

**新开发者**:
1. 从 [01-project-overview.md](./01-project-overview.md) 开始，了解项目全貌
2. 阅读 [02-directory-structure.md](./02-directory-structure.md) 熟悉代码组织
3. 参考 [07-development-guide.md](./07-development-guide.md) 搭建开发环境

**功能开发者**:
1. 查阅 [03-cli-workflow.md](./03-cli-workflow.md) 了解如何添加新命令
2. 参考 [05-codewhisperer-protocol.md](./05-codewhisperer-protocol.md) 了解可用的 API
3. 使用 [06-api-client.md](./06-api-client.md) 理解如何调用 API

**问题排查**:
1. 如果是认证问题，查看 [04-authentication.md](./04-authentication.md)
2. 如果是 API 调用问题，查看 [05-codewhisperer-protocol.md](./05-codewhisperer-protocol.md) 和 [06-api-client.md](./06-api-client.md)
3. 如果是构建或测试问题，查看 [07-development-guide.md](./07-development-guide.md)

### 快速查找

**搜索技巧**:
```bash
# 在所有文档中搜索关键字
grep -r "streaming" docs/amazon-q-cli-analysis/

# 搜索特定文件
grep "authentication" docs/amazon-q-cli-analysis/04-authentication.md
```

**VS Code 搜索**:
- 使用 Ctrl/Cmd + Shift + F 在整个文档目录中搜索
- 使用 Ctrl/Cmd + P 快速打开文件

## 文档维护

### 更新原则

1. **保持同步**: 当代码库发生重大变更时，及时更新文档
2. **准确性**: 确保文档内容与实际代码一致
3. **清晰性**: 使用清晰的语言和示例
4. **完整性**: 涵盖主要功能和常见场景

### 贡献指南

如需更新或补充文档：

1. 确定要更新的文档文件
2. 使用 Markdown 格式编辑
3. 添加代码示例和图表（如需要）
4. 确保格式一致
5. 提交 Pull Request

### 文档版本

- 当前文档版本对应代码版本: **v1.19.3**
- 最后更新时间: 2024-10-31

## 相关资源

### 项目资源

- **主仓库**: https://github.com/aws/amazon-q-developer-cli
- **问题追踪**: https://github.com/aws/amazon-q-developer-cli/issues
- **贡献指南**: https://github.com/aws/amazon-q-developer-cli/blob/main/CONTRIBUTING.md

### 外部文档

- **Amazon Q Developer 官方文档**: https://docs.aws.amazon.com/amazonq/
- **AWS SDK for Rust**: https://docs.aws.amazon.com/sdk-for-rust/
- **Rust 官方文档**: https://doc.rust-lang.org/
- **Tokio 文档**: https://tokio.rs/

### 社区

- **AWS 开发者论坛**: https://forums.aws.amazon.com/
- **Rust 社区**: https://users.rust-lang.org/

## 反馈

如果发现文档中的错误或有改进建议，请：

1. 提交 Issue 到项目仓库
2. 直接提交 Pull Request 修复
3. 联系项目维护者

---

**注意**: 本文档集是基于对 amazon-q-developer-cli 项目的源码分析生成的，旨在为开发者提供快速参考。如有任何疑问或不准确之处，请以官方文档和源码为准。
