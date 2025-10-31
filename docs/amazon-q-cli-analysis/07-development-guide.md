# 开发指南

## 环境准备

### 系统要求

- **操作系统**: macOS, Linux, 或 Windows
- **Rust**: 1.70.0 或更高版本
- **Cargo**: 最新稳定版
- **Git**: 2.0 或更高版本

### macOS 特定要求

```bash
# 安装 Xcode Command Line Tools
xcode-select --install

# 或安装完整 Xcode (推荐)
# 从 App Store 安装 Xcode 13+
```

### 安装 Rust 工具链

```bash
# 安装 rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 设置默认工具链
rustup default stable

# 安装 nightly 工具链 (用于格式化)
rustup toolchain install nightly

# 安装开发工具
cargo install typos-cli
cargo install cargo-watch
cargo install cargo-nextest  # 更快的测试运行器
```

## 克隆和构建

### 克隆子模块

```bash
# 克隆主仓库
git clone https://github.com/aws/amazon-q-developer-cli.git
cd amazon-q-developer-cli

# 初始化和更新子模块（如果有）
git submodule update --init --recursive
```

### 构建项目

```bash
# 开发构建 (快速，包含调试信息)
cargo build

# 发布构建 (优化，较慢)
cargo build --release

# 只构建特定 crate
cargo build -p chat_cli
cargo build -p amzn-codewhisperer-client
```

### 运行程序

```bash
# 运行主 CLI
cargo run --bin chat_cli

# 运行并传递参数
cargo run --bin chat_cli -- login
cargo run --bin chat_cli -- chat "Hello, Q!"

# 运行发布版本
cargo run --release --bin chat_cli

# 使用详细日志
cargo run --bin chat_cli -- -vvv chat
```

## 开发工作流

### 代码编辑

推荐的编辑器/IDE：

1. **VS Code** + rust-analyzer 扩展
   ```bash
   code --install-extension rust-lang.rust-analyzer
   ```

2. **IntelliJ IDEA** / **CLion** + Rust 插件

3. **Vim** / **Neovim** + rust.vim + coc-rust-analyzer

### 代码检查

```bash
# 运行 clippy (代码质量检查)
cargo clippy

# 只检查警告，不编译
cargo clippy -- -D warnings

# 检查所有 targets
cargo clippy --all-targets --all-features

# 修复自动可修复的问题
cargo clippy --fix
```

### 代码格式化

```bash
# 格式化所有代码
cargo +nightly fmt

# 检查格式但不修改
cargo +nightly fmt -- --check

# 格式化特定文件
cargo +nightly fmt -- src/main.rs
```

### 拼写检查

```bash
# 运行拼写检查
typos

# 修复拼写错误
typos --write-changes
```

## 测试

### 运行测试

```bash
# 运行所有测试
cargo test

# 运行特定包的测试
cargo test -p chat_cli

# 运行特定测试
cargo test test_login

# 显示测试输出
cargo test -- --nocapture

# 使用 nextest (更快)
cargo nextest run

# 并行测试
cargo test -- --test-threads=4
```

### 测试类型

#### 单元测试

在源文件中定义：

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_command() {
        let result = parse_command("login");
        assert_eq!(result, Command::Login);
    }
    
    #[tokio::test]
    async fn test_async_function() {
        let result = fetch_data().await;
        assert!(result.is_ok());
    }
}
```

#### 集成测试

在 `tests/` 目录中：

```rust
// tests/cli_integration_test.rs
use assert_cmd::Command;

#[test]
fn test_cli_help() {
    let mut cmd = Command::cargo_bin("chat_cli").unwrap();
    cmd.arg("--help");
    cmd.assert().success();
}
```

#### 快照测试

使用 `insta` crate：

```rust
use insta::assert_snapshot;

#[test]
fn test_output_format() {
    let output = format_data(&data);
    assert_snapshot!(output);
}
```

### 测试覆盖率

```bash
# 安装 tarpaulin
cargo install cargo-tarpaulin

# 生成覆盖率报告
cargo tarpaulin --out Html --output-dir coverage
```

## 调试

### 使用 println! / dbg!

```rust
// 简单调试
println!("Debug: {:?}", value);
dbg!(&value);

// 在表达式中使用
let result = dbg!(calculate_something());
```

### 使用 tracing

```rust
use tracing::{debug, info, warn, error};

fn process_request() {
    info!("Processing request");
    debug!(user_id = %user.id, "User details");
    
    if error_occurred {
        error!("Failed to process: {}", error);
    }
}
```

### 设置日志级别

```bash
# 环境变量
export RUST_LOG=debug
export RUST_LOG=chat_cli=trace

# 运行时指定
cargo run --bin chat_cli -- -vvv
```

### 使用调试器

#### LLDB (macOS/Linux)

```bash
# 构建调试版本
cargo build

# 使用 lldb
lldb target/debug/chat_cli

# 设置断点
(lldb) b main
(lldb) b chat_cli::cli::execute

# 运行
(lldb) run

# 单步执行
(lldb) step
(lldb) next

# 查看变量
(lldb) frame variable
(lldb) p some_variable
```

#### VS Code 调试

`.vscode/launch.json`:

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "lldb",
            "request": "launch",
            "name": "Debug chat_cli",
            "cargo": {
                "args": [
                    "build",
                    "--bin=chat_cli",
                    "--package=chat_cli"
                ],
                "filter": {
                    "name": "chat_cli",
                    "kind": "bin"
                }
            },
            "args": ["chat", "Hello"],
            "cwd": "${workspaceFolder}"
        }
    ]
}
```

## 性能分析

### Benchmarking

使用 Criterion：

```rust
// benches/benchmark.rs
use criterion::{black_box, criterion_group, criterion_main, Criterion};

fn fibonacci(n: u64) -> u64 {
    match n {
        0 => 1,
        1 => 1,
        n => fibonacci(n-1) + fibonacci(n-2),
    }
}

fn criterion_benchmark(c: &mut Criterion) {
    c.bench_function("fib 20", |b| b.iter(|| fibonacci(black_box(20))));
}

criterion_group!(benches, criterion_benchmark);
criterion_main!(benches);
```

运行 benchmark：

```bash
cargo bench
```

### 性能剖析

#### 使用 flamegraph

```bash
# 安装
cargo install flamegraph

# 生成火焰图
cargo flamegraph --bin chat_cli

# 指定运行参数
cargo flamegraph --bin chat_cli -- chat "test"
```

#### 使用 perf (Linux)

```bash
# 构建带调试信息的发布版本
cargo build --release

# 运行 perf
perf record -g target/release/chat_cli chat "test"
perf report
```

## 依赖管理

### 添加依赖

```bash
# 添加到 workspace
# 编辑 Cargo.toml [workspace.dependencies]

# 添加到特定 crate
cd crates/chat-cli
cargo add serde --features derive
```

### 更新依赖

```bash
# 更新所有依赖到兼容的最新版本
cargo update

# 更新特定依赖
cargo update serde

# 查看过时的依赖
cargo install cargo-outdated
cargo outdated
```

### 检查依赖安全性

```bash
# 安装 cargo-deny
cargo install cargo-deny

# 检查依赖
cargo deny check

# 检查许可证
cargo deny check licenses

# 检查安全漏洞
cargo deny check advisories
```

### 依赖树

```bash
# 查看依赖树
cargo tree

# 查看特定依赖
cargo tree -p tokio

# 查看反向依赖
cargo tree -i serde

# 仅显示工作空间成员
cargo tree --workspace
```

## 文档

### 生成文档

```bash
# 生成文档
cargo doc

# 生成并打开
cargo doc --open

# 包含私有项
cargo doc --document-private-items

# 只生成特定 crate
cargo doc -p chat_cli
```

### 编写文档

```rust
/// 发送聊天消息到 Amazon Q
///
/// # Arguments
///
/// * `message` - 要发送的消息内容
/// * `context` - 对话上下文
///
/// # Returns
///
/// 返回 AI 的响应消息
///
/// # Errors
///
/// 如果 API 调用失败或网络错误，将返回 `ApiClientError`
///
/// # Examples
///
/// ```
/// let response = send_message("Hello, Q!").await?;
/// println!("Response: {}", response);
/// ```
pub async fn send_message(
    message: &str,
    context: &ConversationContext,
) -> Result<String, ApiClientError> {
    // 实现...
}
```

### 文档测试

文档中的示例代码会被作为测试运行：

```bash
cargo test --doc
```

## Git 工作流

### 分支策略

```bash
# 创建功能分支
git checkout -b feature/new-command

# 创建修复分支
git checkout -b fix/authentication-issue

# 提交更改
git add .
git commit -m "feat: add new chat command"

# 推送分支
git push origin feature/new-command
```

### Commit 消息规范

遵循 Conventional Commits：

```
<type>(<scope>): <subject>

<body>

<footer>
```

类型：
- `feat`: 新功能
- `fix`: 错误修复
- `docs`: 文档更新
- `style`: 代码格式（不影响代码运行）
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具相关

示例：
```
feat(auth): add support for IAM Identity Center

- Implement PKCE OAuth flow
- Add local callback server
- Update database schema

Closes #123
```

### Pre-commit Hooks

项目使用 husky 管理 git hooks：

```bash
# 安装 hooks
npm install

# hooks 会自动运行：
# - cargo fmt --check
# - cargo clippy
# - typos
```

## 常见任务

### 添加新的 CLI 命令

1. 在 `crates/chat-cli/src/cli/mod.rs` 中添加命令枚举：

```rust
pub enum RootSubcommand {
    // 现有命令...
    
    /// 新命令描述
    NewCommand(NewCommandArgs),
}
```

2. 定义命令参数：

```rust
#[derive(Debug, Parser)]
pub struct NewCommandArgs {
    /// 参数描述
    #[arg(short, long)]
    pub option: String,
}
```

3. 实现命令执行：

```rust
impl RootSubcommand {
    pub async fn execute(self, os: &mut Os) -> Result<ExitCode> {
        match self {
            // 现有命令...
            Self::NewCommand(args) => args.execute(os).await,
        }
    }
}

impl NewCommandArgs {
    pub async fn execute(self, os: &mut Os) -> Result<ExitCode> {
        // 实现命令逻辑
        Ok(ExitCode::SUCCESS)
    }
}
```

### 添加新的 API 操作

大多数 API 操作是自动生成的，如需添加：

1. 更新 Smithy 模型（如果有访问权限）
2. 重新生成客户端代码
3. 在 `ApiClient` 中添加包装方法

```rust
impl ApiClient {
    pub async fn new_operation(&self, input: Input) -> Result<Output> {
        let result = self.client
            .new_operation()
            .set_input(input)
            .send()
            .await?;
        
        Ok(result.into())
    }
}
```

### 添加数据库迁移

1. 创建迁移文件 `crates/chat-cli/src/database/migrations/`:

```rust
// migrations/v2_add_new_table.rs
pub fn migrate(conn: &Connection) -> Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS new_table (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )",
        [],
    )?;
    Ok(())
}
```

2. 在 `mod.rs` 中注册迁移：

```rust
pub fn run_migrations(conn: &Connection) -> Result<()> {
    v1_initial::migrate(conn)?;
    v2_add_new_table::migrate(conn)?;
    Ok(())
}
```

## 发布流程

### 版本更新

1. 更新版本号 `Cargo.toml`:

```toml
[workspace.package]
version = "1.20.0"
```

2. 更新 CHANGELOG.md

3. 提交更改：

```bash
git add .
git commit -m "chore: bump version to 1.20.0"
git tag v1.20.0
git push origin main --tags
```

### 构建发布版本

```bash
# 清理构建
cargo clean

# 构建发布版本
cargo build --release

# 运行测试
cargo test --release

# 构建各平台版本
cargo build --release --target x86_64-apple-darwin
cargo build --release --target aarch64-apple-darwin
cargo build --release --target x86_64-unknown-linux-gnu
```

### 交叉编译

使用 `cross` 进行交叉编译：

```bash
# 安装 cross
cargo install cross

# 交叉编译
cross build --release --target x86_64-unknown-linux-musl
cross build --release --target aarch64-unknown-linux-gnu
```

## 故障排除

### 编译错误

#### 依赖冲突

```bash
# 清理并重新构建
cargo clean
cargo build
```

#### 工具链问题

```bash
# 更新工具链
rustup update

# 切换工具链
rustup default stable
```

### 运行时错误

#### 数据库错误

```bash
# 删除并重新创建数据库
rm ~/.local/share/amazon-q/db.sqlite
q login  # 重新初始化
```

#### 网络错误

```bash
# 检查代理设置
echo $HTTP_PROXY
echo $HTTPS_PROXY

# 测试连接
curl https://codewhisperer.us-east-1.amazonaws.com
```

### 性能问题

```bash
# 使用发布版本
cargo run --release

# 启用 LTO
# 在 Cargo.toml 中：
[profile.release]
lto = "fat"
```

## 最佳实践

### 代码风格

- 遵循 Rust 官方风格指南
- 使用 `cargo fmt` 格式化代码
- 通过所有 `cargo clippy` 检查
- 编写清晰的文档注释

### 错误处理

- 使用 `Result` 类型
- 为自定义错误实现 `std::error::Error`
- 使用 `thiserror` 简化错误定义
- 使用 `eyre` 提供上下文信息

### 异步代码

- 使用 `tokio` 作为异步运行时
- 避免阻塞操作
- 适当使用 `tokio::spawn`
- 注意异步函数的取消安全性

### 测试

- 为所有公共 API 编写测试
- 使用模拟对象进行单元测试
- 编写集成测试验证端到端流程
- 保持测试快速且独立

## 资源链接

- [Rust 官方文档](https://doc.rust-lang.org/)
- [Tokio 文档](https://tokio.rs/)
- [AWS SDK for Rust](https://docs.aws.amazon.com/sdk-for-rust/)
- [Cargo 文档](https://doc.rust-lang.org/cargo/)
- [Rust 设计模式](https://rust-unofficial.github.io/patterns/)
