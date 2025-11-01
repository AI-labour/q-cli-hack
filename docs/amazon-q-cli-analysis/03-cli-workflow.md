# CLI 命令流程

## 程序入口与执行流程

### Main 函数流程

```rust
// crates/chat-cli/src/main.rs

1. 安装 color_eyre 错误处理
2. 解析 CLI 参数 (clap)
3. 确定日志级别
4. 创建 Tokio 运行时
5. 异步执行命令
6. 错误处理和退出码返回
```

### 详细执行流程图

```
main()
  │
  ├─> color_eyre::install()              # 错误处理初始化
  │
  ├─> Cli::try_parse()                   # 解析命令行参数
  │     └─> 解析失败 -> 打印帮助信息并退出
  │
  ├─> tokio::runtime::Builder::new_multi_thread()  # 创建异步运行时
  │
  └─> parsed.execute()                   # 执行命令
        │
        ├─> initialize_logging()         # 初始化日志系统
        │
        ├─> 检查 AWS 区域支持
        │
        ├─> Os::new()                    # 创建操作系统抽象层
        │
        ├─> 检查更新提示
        │
        └─> subcommand.execute()         # 执行具体子命令
              │
              ├─> 检查是否需要认证
              ├─> 发送心跳遥测
              ├─> 发送命令执行遥测
              └─> 执行命令逻辑
```

## CLI 命令结构

### 主命令 (Cli)

```rust
#[derive(Debug, Parser)]
pub struct Cli {
    pub subcommand: Option<RootSubcommand>,
    pub verbose: u8,              // -v, -vv, -vvv, -vvvv
    pub help_all: bool,           // --help-all
}
```

### 子命令 (RootSubcommand)

```rust
pub enum RootSubcommand {
    Agent(AgentArgs),           // 管理代理
    Chat(ChatArgs),             // AI 聊天助手 (默认)
    Login(LoginArgs),           // 登录
    Logout,                     // 登出
    Whoami(WhoamiArgs),         // 显示当前用户信息
    Profile,                    // 显示用户配置文件
    Settings(SettingsArgs),     // 自定义设置
    Diagnostic(DiagnosticArgs), // 运行诊断测试
    Issue(IssueArgs),           // 创建 GitHub issue
    Version { changelog },      // 版本信息
    Mcp(McpSubcommand),         // MCP 协议
}
```

## 各子命令详解

### 1. Chat 命令 (默认命令)

**功能**: 启动交互式 AI 聊天助手

**流程**:
```
q chat [OPTIONS] [MESSAGE]
  │
  ├─> 检查认证状态
  │
  ├─> 加载用户设置和配置
  │
  ├─> 初始化 API 客户端
  │
  ├─> 如果有 MESSAGE 参数
  │     └─> 单次问答模式
  │           ├─> 发送消息
  │           ├─> 接收流式响应
  │           └─> 显示结果并退出
  │
  └─> 否则进入交互模式
        ├─> 加载/创建对话状态
        ├─> 显示欢迎消息
        └─> 进入 REPL 循环
              ├─> 显示提示符
              ├─> 读取用户输入
              ├─> 处理特殊命令 (/help, /clear, etc.)
              ├─> 发送到 API
              ├─> 流式显示响应
              ├─> 保存对话历史
              └─> 重复
```

**Chat 子命令选项**:
```rust
pub struct ChatArgs {
    pub message: Option<String>,        // 消息内容
    pub agent: Option<String>,          // 使用的代理
    pub model: Option<String>,          // 使用的模型
    pub no_history: bool,               // 不保存历史
    pub profile: Option<String>,        // 使用的配置文件
    pub tangent: bool,                  // Tangent 模式
    // ... 更多选项
}
```

### 2. Login 命令

**功能**: 登录到 Amazon Q

**流程**:
```
q login [--method METHOD]
  │
  ├─> 选择登录方法
  │     ├─> Builder ID (默认)
  │     └─> IAM Identity Center
  │
  ├─> Builder ID 流程:
  │     │
  │     ├─> 创建 SSO OIDC 客户端
  │     ├─> register_client()              # 注册客户端
  │     ├─> start_device_authorization()   # 启动设备授权
  │     ├─> 显示验证码和 URL
  │     ├─> 打开浏览器
  │     ├─> 轮询等待用户授权
  │     ├─> create_token()                 # 获取访问令牌
  │     ├─> 保存令牌到数据库
  │     └─> 显示成功消息
  │
  └─> PKCE OAuth 流程:
        │
        ├─> 生成 code_verifier 和 code_challenge
        ├─> 构建授权 URL
        ├─> 启动本地 HTTP 服务器监听回调
        ├─> 打开浏览器进行授权
        ├─> 接收授权码
        ├─> 交换访问令牌
        ├─> 保存令牌
        └─> 关闭服务器
```

**登录方法**:
```rust
pub enum LoginMethod {
    BuilderId,          // AWS Builder ID
    IdentityCenter,     // IAM Identity Center (SSO)
}
```

### 3. Logout 命令

**功能**: 登出并清除凭证

**流程**:
```
q logout
  │
  ├─> 从数据库删除令牌
  ├─> 清除缓存
  └─> 显示确认消息
```

### 4. Whoami 命令

**功能**: 显示当前登录用户信息

**流程**:
```
q whoami [--format FORMAT]
  │
  ├─> 检查认证状态
  ├─> 从数据库读取令牌信息
  ├─> 解码 JWT 令牌
  └─> 显示用户信息
        ├─> 用户名
        ├─> 邮箱
        ├─> 登录方法
        ├─> 令牌过期时间
        └─> 订阅状态
```

### 5. Profile 命令

**功能**: 显示用户的配置文件信息

**流程**:
```
q profile
  │
  ├─> 检查认证状态
  ├─> 调用 API: get_profile()
  └─> 显示配置文件信息
        ├─> 配置文件 ID
        ├─> 可用功能
        ├─> 使用限制
        └─> 自定义设置
```

### 6. Agent 命令

**功能**: 管理 AI 代理

**子命令**:
```
q agent list                    # 列出所有代理
q agent show <NAME>             # 显示代理详情
q agent create <NAME>           # 创建新代理
q agent edit <NAME>             # 编辑代理
q agent delete <NAME>           # 删除代理
q agent set-default <NAME>      # 设置默认代理
```

**流程**:
```
q agent <SUBCOMMAND>
  │
  ├─> List
  │     ├─> 扫描代理目录
  │     ├─> 解析代理配置文件
  │     └─> 显示代理列表
  │
  ├─> Show
  │     ├─> 读取代理配置
  │     ├─> 验证配置
  │     └─> 格式化显示
  │
  ├─> Create
  │     ├─> 提示用户输入配置
  │     ├─> 验证配置
  │     ├─> 写入配置文件
  │     └─> 确认创建成功
  │
  └─> ...
```

### 7. Settings 命令

**功能**: 管理用户设置

**子命令**:
```
q settings list                 # 列出所有设置
q settings get <KEY>            # 获取设置值
q settings set <KEY> <VALUE>    # 设置值
q settings unset <KEY>          # 删除设置
q settings reset                # 重置为默认值
```

### 8. Diagnostic 命令

**功能**: 运行诊断测试

**流程**:
```
q diagnostic
  │
  ├─> 检查网络连接
  ├─> 检查认证状态
  ├─> 检查 API 可达性
  ├─> 检查数据库状态
  ├─> 检查文件权限
  ├─> 收集系统信息
  └─> 生成诊断报告
```

### 9. MCP 命令

**功能**: Model Context Protocol 管理

**子命令**:
```
q mcp server list              # 列出 MCP 服务器
q mcp server add <URL>         # 添加服务器
q mcp server remove <NAME>     # 删除服务器
q mcp tool list                # 列出可用工具
q mcp tool call <NAME> [ARGS]  # 调用工具
```

## 命令执行上下文 (Os)

所有命令执行时都会创建一个 `Os` 结构体，提供统一的系统访问接口：

```rust
pub struct Os {
    pub database: Database,           // 数据库访问
    pub api_client: ApiClient,        // API 客户端
    pub telemetry: TelemetryClient,   // 遥测客户端
    pub fs: Fs,                       // 文件系统
    pub env: Env,                     // 环境变量
    pub settings: Settings,           // 用户设置
}
```

## 认证检查流程

```rust
fn requires_auth(&self) -> bool {
    matches!(self, Self::Chat(_) | Self::Profile)
}

// 在命令执行前检查
if self.requires_auth() && !is_logged_in(&mut os.database).await {
    bail!("You are not logged in, please log in with `q login`");
}
```

## 遥测事件

某些命令会发送遥测事件：

```rust
fn valid_for_telemetry(&self) -> bool {
    matches!(
        self, 
        Self::Chat(_) | 
        Self::Login(_) | 
        Self::Profile | 
        Self::Issue(_)
    )
}
```

## 日志级别

通过 `-v` 参数控制：

```
(无)    -> INFO (默认，仅文件)
-v      -> WARN
-vv     -> INFO
-vvv    -> DEBUG
-vvvvv  -> TRACE
```

## 错误处理

- 使用 `eyre::Result` 进行错误传播
- 详细错误信息（verbose 模式）
- 彩色错误输出
- 适当的退出码

## 输出格式

支持多种输出格式（部分命令）：

```rust
pub enum OutputFormat {
    Plain,        // 纯文本 (默认)
    Json,         // JSON
    JsonPretty,   // 格式化 JSON
}
```
