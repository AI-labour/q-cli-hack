# Amazon Q Developer CLI - 项目概览

## 基本信息

- **项目名称**: Amazon Q Developer CLI
- **版本**: 1.19.3
- **编程语言**: Rust
- **许可证**: MIT OR Apache-2.0 双许可
- **仓库地址**: https://github.com/aws/amazon-q-developer-cli
- **主要二进制**: `chat_cli` (即 `q` CLI命令)

## 项目简介

Amazon Q Developer CLI 是一个命令行工具，允许用户从终端直接与 Amazon Q Developer（AWS的AI助手服务）进行交互。该工具提供了代码补全、代码分析、测试生成、代码转换等多种AI辅助开发功能。

## 核心特性

### 1. AI 聊天助手
- 交互式聊天界面
- 支持多轮对话
- 上下文感知的代码建议

### 2. 代码相关功能
- **代码补全**: 智能代码补全建议
- **代码分析**: 代码质量和安全性分析
- **测试生成**: 自动生成单元测试
- **代码转换**: 代码重构和迁移
- **代码修复**: 自动修复代码问题

### 3. 认证与授权
- 支持 AWS Builder ID 登录
- 支持 IAM Identity Center (SSO)
- OAuth 2.0 with PKCE 流程
- 安全的令牌管理

### 4. 智能代理 (Agent)
- 支持自定义代理配置
- 内置工具集成
- 知识库管理
- 上下文钩子 (Hooks)

### 5. Model Context Protocol (MCP)
- 支持 MCP 协议
- 可扩展的工具系统
- 远程过程调用支持

### 6. 其他功能
- 自定义设置和配置
- 遥测和分析
- 诊断工具
- 问题报告

## 技术栈

### 核心依赖
- **Tokio**: 异步运行时
- **Clap**: CLI 参数解析
- **Rusqlite**: SQLite 数据库
- **Reqwest**: HTTP 客户端
- **AWS SDK**: AWS 服务集成
- **Serde**: 序列化/反序列化
- **Tracing**: 日志和追踪

### 网络通信
- HTTP/2 支持
- WebSocket 支持
- Server-Sent Events (SSE)
- 流式响应处理

### 安全特性
- Rustls (TLS 实现)
- PKCE OAuth 流程
- 安全的凭证存储
- 证书管理

## 支持平台

- **macOS**: DMG 安装包、Homebrew
- **Linux**: 
  - Ubuntu/Debian
  - AppImage
  - 其他发行版的构建选项
- **Windows**: 通过 Cargo 构建

## 安装方式

### macOS
```bash
# Homebrew
brew install --cask amazon-q

# 或下载 DMG
# https://desktop-release.q.us-east-1.amazonaws.com/latest/Amazon%20Q.dmg
```

### 开发环境要求

#### 前置条件
- Rust toolchain (stable + nightly)
- Xcode 13+ (macOS)
- Cargo
- Git

#### 开发命令
```bash
# 克隆仓库
git clone https://github.com/aws/amazon-q-developer-cli.git

# 编译并运行
cargo run --bin chat_cli

# 运行测试
cargo test

# 代码检查
cargo clippy

# 格式化代码
cargo +nightly fmt

# 运行子命令
cargo run --bin chat_cli -- {subcommand}
```

## 项目结构简述

```
amazon-q-developer-cli/
├── crates/                          # Rust 工作空间的各个 crate
│   ├── chat-cli/                    # 主 CLI 应用
│   ├── amzn-codewhisperer-client/   # CodeWhisperer API 客户端
│   ├── amzn-codewhisperer-streaming-client/  # 流式客户端
│   ├── amzn-qdeveloper-streaming-client/     # Q Developer 流式客户端
│   ├── amzn-consolas-client/        # Consolas 客户端
│   ├── amzn-toolkit-telemetry-client/        # 遥测客户端
│   ├── aws-toolkit-telemetry-definitions/    # 遥测定义
│   ├── semantic-search-client/      # 语义搜索客户端
│   ├── chat-cli-ui/                 # UI 组件
│   └── agent/                       # 代理功能
├── docs/                            # 技术文档
├── scripts/                         # 构建和运维脚本
├── schemas/                         # JSON Schema 定义
├── build-config/                    # 构建配置
├── Cargo.toml                       # Workspace 配置
└── Cargo.lock                       # 依赖锁定文件
```

## 下一步

详细内容请参阅：
- [02-directory-structure.md](./02-directory-structure.md) - 详细目录结构
- [03-cli-workflow.md](./03-cli-workflow.md) - CLI 命令流程
- [04-authentication.md](./04-authentication.md) - 认证和授权机制
- [05-codewhisperer-protocol.md](./05-codewhisperer-protocol.md) - CodeWhisperer 协议详解
- [06-api-client.md](./06-api-client.md) - API 客户端架构
- [07-development-guide.md](./07-development-guide.md) - 开发指南
