# 目录结构详解

## 顶层目录

```
amazon-q-developer-cli/
├── .cargo/                   # Cargo 配置
├── .github/                  # GitHub Actions 工作流
├── .husky/                   # Git hooks 管理
├── build-config/             # 构建配置文件
├── crates/                   # Rust crates (核心代码)
├── docs/                     # 项目文档
├── schemas/                  # JSON Schema 定义
├── scripts/                  # 构建和运维脚本
├── terminal-bench-test/      # 终端性能测试
├── Cargo.toml               # Workspace 配置
├── Cargo.lock               # 依赖锁定
├── Cross.toml               # 交叉编译配置
├── deny.toml                # cargo-deny 配置
├── rust-toolchain.toml      # Rust 工具链版本
├── .rustfmt.toml            # 代码格式化配置
└── README.md                # 项目说明
```

## Crates 详细结构

### 1. chat-cli (主应用)

```
crates/chat-cli/
├── src/
│   ├── main.rs              # 程序入口
│   ├── lib.rs               # 库入口
│   ├── constants.rs         # 常量定义
│   ├── logging.rs           # 日志系统
│   ├── request.rs           # 请求处理
│   ├── api_client/          # API 客户端
│   │   ├── mod.rs           # 客户端主模块
│   │   ├── credentials.rs   # 凭证管理
│   │   ├── customization.rs # 自定义配置
│   │   ├── endpoints.rs     # 端点管理
│   │   ├── error.rs         # 错误处理
│   │   ├── model.rs         # 模型定义
│   │   ├── opt_out.rs       # 选择退出功能
│   │   ├── profile.rs       # 配置文件管理
│   │   └── send_message_output.rs
│   ├── auth/                # 认证模块
│   │   ├── mod.rs
│   │   ├── builder_id.rs    # Builder ID 认证
│   │   ├── pkce.rs          # PKCE OAuth 流程
│   │   ├── scope.rs         # OAuth 作用域
│   │   ├── consts.rs        # 认证常量
│   │   └── index.html       # OAuth 回调页面
│   ├── aws_common/          # AWS 通用功能
│   ├── cli/                 # CLI 命令实现
│   │   ├── mod.rs           # CLI 主模块
│   │   ├── agent/           # 代理命令
│   │   ├── chat/            # 聊天命令
│   │   ├── experiment/      # 实验性功能
│   │   ├── debug.rs         # 调试命令
│   │   ├── diagnostics.rs   # 诊断命令
│   │   ├── feed.rs          # Feed 功能
│   │   ├── issue.rs         # 问题报告
│   │   ├── mcp.rs           # MCP 协议
│   │   ├── settings.rs      # 设置管理
│   │   └── user.rs          # 用户管理
│   ├── database/            # 数据库层
│   │   ├── mod.rs
│   │   ├── migrations/      # 数据库迁移
│   │   └── settings/        # 设置存储
│   ├── mcp_client/          # MCP 客户端
│   ├── os/                  # 操作系统抽象
│   ├── telemetry/           # 遥测功能
│   ├── theme/               # UI 主题
│   └── util/                # 工具函数
├── Cargo.toml
└── build.rs                 # 构建脚本
```

### 2. amzn-codewhisperer-client (CodeWhisperer API 客户端)

这是一个自动生成的 Smithy SDK 客户端。

```
crates/amzn-codewhisperer-client/
├── src/
│   ├── lib.rs               # 库入口
│   ├── client.rs            # 客户端实现
│   ├── config.rs            # 配置
│   ├── error.rs             # 错误类型
│   ├── types.rs             # 数据类型
│   ├── auth_plugin.rs       # 认证插件
│   ├── protocol_serde.rs    # 协议序列化
│   ├── client/              # 客户端组件
│   ├── config/              # 配置组件
│   ├── error/               # 错误处理
│   ├── operation/           # API 操作
│   │   ├── generate_completions/
│   │   ├── start_code_analysis/
│   │   ├── get_code_analysis/
│   │   ├── start_test_generation/
│   │   ├── start_transformation/
│   │   ├── list_available_models/
│   │   ├── send_telemetry_event/
│   │   └── ...             # 40+ API 操作
│   ├── primitives/          # 基本类型
│   ├── protocol_serde/      # 协议序列化
│   └── types/               # 复杂类型定义
└── Cargo.toml
```

### 3. amzn-codewhisperer-streaming-client

流式 API 客户端，用于实时通信。

```
crates/amzn-codewhisperer-streaming-client/
├── src/
│   ├── lib.rs
│   ├── client.rs
│   ├── event_receiver.rs    # 事件接收器
│   ├── event_stream_serde.rs # 事件流序列化
│   ├── operation/
│   │   ├── send_message/    # 发送消息 (流式)
│   │   ├── generate_assistant_response/
│   │   ├── generate_task_assist_plan/
│   │   └── export_result_archive/
│   └── types/
└── Cargo.toml
```

### 4. amzn-qdeveloper-streaming-client

Q Developer 专用的流式客户端。

```
crates/amzn-qdeveloper-streaming-client/
├── src/
│   ├── lib.rs
│   ├── client.rs
│   ├── operation/
│   │   ├── generate_assistant_response/
│   │   ├── send_message/
│   │   └── ...
│   └── types/
└── Cargo.toml
```

### 5. semantic-search-client

语义搜索功能的客户端。

```
crates/semantic-search-client/
├── src/
│   ├── lib.rs
│   ├── client.rs
│   └── models/
└── Cargo.toml
```

### 6. agent (代理功能)

```
crates/agent/
├── src/
│   ├── main.rs              # 独立代理程序
│   ├── lib.rs
│   └── ...
└── Cargo.toml
```

### 7. chat-cli-ui (UI 组件)

```
crates/chat-cli-ui/
├── src/
│   ├── lib.rs
│   └── components/          # UI 组件
└── Cargo.toml
```

### 8. amzn-toolkit-telemetry-client

```
crates/amzn-toolkit-telemetry-client/
├── src/
│   ├── lib.rs
│   └── ...
└── Cargo.toml
```

### 9. aws-toolkit-telemetry-definitions

```
crates/aws-toolkit-telemetry-definitions/
├── src/
│   ├── lib.rs
│   └── definitions/         # 遥测事件定义
└── Cargo.toml
```

## 重要文件说明

### Cargo.toml (Workspace)

定义了工作空间的所有成员和共享依赖项：
- 9个成员 crate
- 统一的版本号管理
- 共享的依赖项配置
- Workspace-level 的 lints 配置

### 配置文件

- **rust-toolchain.toml**: 指定 Rust 版本
- **.rustfmt.toml**: 代码格式化规则
- **deny.toml**: 依赖项审核规则
- **Cross.toml**: 交叉编译配置
- **.typos.toml**: 拼写检查配置

### 文档目录 (docs/)

```
docs/
├── SUMMARY.md
├── introduction.md
├── agent-format.md
├── agent-file-locations.md
├── built-in-tools.md
├── default-agent-behavior.md
├── experiments.md
├── hooks.md
├── introspect-tool.md
├── knowledge-management.md
├── tangent-mode.md
└── todo-lists.md
```

## 数据存储位置

### 配置和数据目录

基于操作系统的标准位置：

**macOS/Linux**:
```
~/.config/amazon-q/          # 配置文件
~/.local/share/amazon-q/     # 数据文件
~/.cache/amazon-q/           # 缓存文件
```

**Windows**:
```
%APPDATA%\amazon-q\          # 配置文件
%LOCALAPPDATA%\amazon-q\     # 数据文件
```

### 数据库文件

- SQLite 数据库存储在数据目录
- 包含：
  - 认证令牌
  - 用户设置
  - 对话历史
  - 缓存数据

### 日志文件

- 位置: 日志目录
- 文件: `qchat.log`
- 包含详细的运行日志和错误信息

## 构建产物

```
target/
├── debug/                   # 调试构建
│   └── chat_cli            # CLI 可执行文件
├── release/                 # 发布构建
│   └── chat_cli            # 优化的可执行文件
└── ...
```

## 关键路径常量

在代码中定义的重要路径：

```rust
// 来自 crates/chat-cli/src/util/paths.rs
- config_dir()    // 配置目录
- data_dir()      // 数据目录
- cache_dir()     // 缓存目录
- logs_dir()      // 日志目录
- db_path()       // 数据库路径
```
