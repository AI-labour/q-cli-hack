# API 客户端架构

## 客户端层次结构

```
┌─────────────────────────────────────────────────────────┐
│                    CLI Application                       │
│                   (crates/chat-cli)                      │
└───────────────────────┬─────────────────────────────────┘
                        │
                        v
┌───────────────────────────────────────────────────────────┐
│                   ApiClient Wrapper                       │
│             (crates/chat-cli/src/api_client)              │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ - Credentials Management                            │ │
│  │ - Endpoint Configuration                            │ │
│  │ - Retry Logic                                       │ │
│  │ - Error Handling                                    │ │
│  │ - Model Caching                                     │ │
│  └─────────────────────────────────────────────────────┘ │
└───────────┬───────────────────────┬───────────────────────┘
            │                       │
            v                       v
┌───────────────────────┐  ┌───────────────────────────────┐
│ CodewhispererClient   │  │ Streaming Clients             │
│ (HTTP/JSON)           │  │ (Event Streams)               │
│                       │  │ - CodewhispererStreaming      │
│ - generate_completions│  │ - QDeveloperStreaming         │
│ - start_code_analysis │  │                               │
│ - get_profile         │  │ - send_message                │
│ - list_models         │  │ - generate_assistant_response │
│ - ...                 │  │ - ...                         │
└───────────┬───────────┘  └───────────┬───────────────────┘
            │                          │
            └────────┬─────────────────┘
                     │
                     v
          ┌──────────────────────┐
          │   AWS SDK Layer      │
          │                      │
          │ - HTTP Client        │
          │ - TLS (Rustls)       │
          │ - Request Signing    │
          │ - Retry Config       │
          └──────────┬───────────┘
                     │
                     v
          ┌──────────────────────┐
          │  AWS Services        │
          │  (CodeWhisperer API) │
          └──────────────────────┘
```

## ApiClient 核心结构

### 主结构定义

```rust
#[derive(Clone, Debug)]
pub struct ApiClient {
    // 标准 HTTP 客户端
    client: CodewhispererClient,
    
    // 流式客户端 (可选)
    streaming_client: Option<CodewhispererStreamingClient>,
    
    // SigV4 流式客户端 (可选)
    sigv4_streaming_client: Option<QDeveloperStreamingClient>,
    
    // 模拟客户端 (用于测试)
    mock_client: Option<Arc<Mutex<std::vec::IntoIter<Vec<ChatResponseStream>>>>>,
    
    // 认证配置文件
    profile: Option<AuthProfile>,
    
    // 模型缓存
    model_cache: ModelCache,
}
```

### 创建客户端

```rust
impl ApiClient {
    pub async fn new(
        database: &Database,
        fs: &Fs,
        env: &Env,
    ) -> Result<Self> {
        // 1. 获取认证配置
        let profile = database.get_current_auth_profile().await?;
        
        // 2. 创建凭证链
        let credentials = CredentialsChain::new(
            profile.clone(),
            fs.clone(),
            env.clone(),
        );
        
        // 3. 获取端点配置
        let endpoint = get_endpoint_from_env(env)?;
        
        // 4. 构建 AWS SDK 配置
        let sdk_config = aws_config::defaults(behavior_version())
            .credentials_provider(credentials.clone())
            .region(Region::new("us-east-1"))
            .timeout_config(timeout_config())
            .retry_config(retry_config())
            .stalled_stream_protection(stalled_stream_protection())
            .load()
            .await;
        
        // 5. 创建 CodeWhisperer 客户端
        let client = CodewhispererClient::new(&sdk_config);
        
        // 6. 配置拦截器
        let client = client
            .config()
            .interceptor(UserAgentOverrideInterceptor::new())
            .interceptor(OptOutInterceptor::new(database))
            .interceptor(DelayTrackingInterceptor::new())
            .build();
        
        // 7. 创建流式客户端 (如果支持)
        let streaming_client = if supports_streaming(&profile) {
            Some(create_streaming_client(&sdk_config, endpoint).await?)
        } else {
            None
        };
        
        Ok(Self {
            client,
            streaming_client,
            sigv4_streaming_client: None,
            mock_client: None,
            profile: Some(profile),
            model_cache: Arc::new(RwLock::new(None)),
        })
    }
}
```

## 凭证管理

### CredentialsChain

提供多种凭证来源的优先级链：

```rust
pub struct CredentialsChain {
    bearer_resolver: Option<BearerResolver>,
    env_credentials: Option<EnvCredentials>,
    profile_credentials: Option<ProfileCredentials>,
}

impl ProvideCredentials for CredentialsChain {
    fn provide_credentials<'a>(&'a self) -> ProvideCredentialsFuture<'a> {
        ProvideCredentialsFuture::new(async move {
            // 1. 尝试使用 Bearer Token (来自 Builder ID 登录)
            if let Some(bearer) = &self.bearer_resolver {
                return bearer.provide_credentials().await;
            }
            
            // 2. 尝试使用环境变量凭证
            if let Some(env_creds) = &self.env_credentials {
                if let Ok(creds) = env_creds.provide_credentials().await {
                    return Ok(creds);
                }
            }
            
            // 3. 尝试使用配置文件凭证
            if let Some(profile_creds) = &self.profile_credentials {
                return profile_creds.provide_credentials().await;
            }
            
            Err(CredentialsError::unhandled("No credentials available"))
        })
    }
}
```

### BearerResolver

用于 Builder ID 认证的 Bearer Token 解析器：

```rust
pub struct BearerResolver {
    token: String,
}

impl ProvideCredentials for BearerResolver {
    fn provide_credentials<'a>(&'a self) -> ProvideCredentialsFuture<'a> {
        ProvideCredentialsFuture::ready(Ok(Credentials::new(
            "bearer",           // access_key_id
            &self.token,        // secret_access_key
            None,               // session_token
            None,               // expiry
            "BearerToken",      // provider_name
        )))
    }
}
```

## 端点配置

### Endpoint 枚举

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Endpoint {
    Prod,           // 生产环境
    Gamma,          // Gamma 测试环境
    Beta,           // Beta 测试环境
    Custom(String), // 自定义端点
}

impl Endpoint {
    pub fn url(&self) -> &str {
        match self {
            Endpoint::Prod => "https://codewhisperer.us-east-1.amazonaws.com",
            Endpoint::Gamma => "https://codewhisperer-gamma.us-east-1.amazonaws.com",
            Endpoint::Beta => "https://codewhisperer-beta.us-east-1.amazonaws.com",
            Endpoint::Custom(url) => url,
        }
    }
    
    pub fn from_env(env: &Env) -> Self {
        if let Ok(endpoint) = env.get("CODEWHISPERER_ENDPOINT") {
            match endpoint.as_str() {
                "gamma" => Endpoint::Gamma,
                "beta" => Endpoint::Beta,
                url if url.starts_with("http") => Endpoint::Custom(url.to_string()),
                _ => Endpoint::Prod,
            }
        } else {
            Endpoint::Prod
        }
    }
}
```

## 拦截器 (Interceptors)

### 1. UserAgentOverrideInterceptor

自定义 User-Agent 头：

```rust
pub struct UserAgentOverrideInterceptor {
    user_agent: String,
}

impl Intercept for UserAgentOverrideInterceptor {
    fn name(&self) -> &'static str {
        "UserAgentOverrideInterceptor"
    }
    
    fn modify_before_signing(
        &self,
        context: &mut BeforeTransmitInterceptorContextMut<'_>,
        cfg: &mut ConfigBag,
    ) -> Result<(), BoxError> {
        let headers = context.request_mut().headers_mut();
        headers.insert(
            "User-Agent",
            HeaderValue::from_str(&self.user_agent)?,
        );
        Ok(())
    }
}
```

User-Agent 格式：
```
AmazonQ/1.19.3 OS/MacOS Language/Rust ClientId/chat_cli
```

### 2. OptOutInterceptor

处理选择退出设置：

```rust
pub struct OptOutInterceptor {
    database: Database,
}

impl Intercept for OptOutInterceptor {
    fn modify_before_signing(
        &self,
        context: &mut BeforeTransmitInterceptorContextMut<'_>,
        cfg: &mut ConfigBag,
    ) -> Result<(), BoxError> {
        // 检查用户的选择退出设置
        if let Ok(Some(opt_out)) = self.database.get_opt_out_preference() {
            let headers = context.request_mut().headers_mut();
            
            // 添加 opt-out 头
            if opt_out.telemetry_opt_out {
                headers.insert(
                    X_AMZN_CODEWHISPERER_OPT_OUT_HEADER,
                    HeaderValue::from_static("TELEMETRY"),
                );
            }
        }
        Ok(())
    }
}
```

### 3. DelayTrackingInterceptor

追踪请求延迟：

```rust
pub struct DelayTrackingInterceptor {
    start_times: Arc<Mutex<HashMap<RequestId, Instant>>>,
}

impl Intercept for DelayTrackingInterceptor {
    fn read_before_execution(
        &self,
        context: &BeforeSerializationInterceptorContextRef<'_>,
        cfg: &mut ConfigBag,
    ) -> Result<(), BoxError> {
        let request_id = generate_request_id();
        self.start_times.lock().insert(request_id, Instant::now());
        cfg.put(request_id);
        Ok(())
    }
    
    fn read_after_execution(
        &self,
        context: &AfterDeserializationInterceptorContextRef<'_>,
        cfg: &mut ConfigBag,
    ) -> Result<(), BoxError> {
        if let Some(request_id) = cfg.get::<RequestId>() {
            if let Some(start_time) = self.start_times.lock().remove(request_id) {
                let duration = start_time.elapsed();
                tracing::debug!("Request took {:?}", duration);
            }
        }
        Ok(())
    }
}
```

## 重试配置

### RetryConfig

```rust
pub fn retry_config() -> RetryConfig {
    RetryConfig::standard()
        .with_max_attempts(3)                              // 最多重试 3 次
        .with_initial_backoff(Duration::from_millis(100))  // 初始退避 100ms
        .with_max_backoff(MAX_RETRY_DELAY_DURATION)        // 最大退避 10s
        .with_use_static_exponential_base(true)            // 使用静态指数基数
}
```

### 自定义重试分类器

```rust
pub struct CustomRetryClassifier;

impl ClassifyRetry for CustomRetryClassifier {
    fn classify_retry(
        &self,
        ctx: &InterceptorContext,
    ) -> RetryAction {
        // 从响应中提取错误信息
        if let Some(error) = ctx.output_or_error().err() {
            // 可重试的错误
            if is_throttling_error(error) {
                return RetryAction::retryable_error(ErrorKind::ThrottlingError);
            }
            
            if is_transient_error(error) {
                return RetryAction::retryable_error(ErrorKind::TransientError);
            }
            
            // 不可重试的错误
            return RetryAction::NoActionIndicated;
        }
        
        RetryAction::NoActionIndicated
    }
}
```

## 超时配置

### TimeoutConfig

```rust
pub fn timeout_config() -> TimeoutConfig {
    TimeoutConfig::builder()
        .operation_timeout(DEFAULT_TIMEOUT_DURATION)  // 整体操作超时: 5分钟
        .connect_timeout(Duration::from_secs(10))     // 连接超时: 10秒
        .read_timeout(Duration::from_secs(30))        // 读取超时: 30秒
        .build()
}
```

### 流式超时

对于流式操作，使用更宽松的超时设置：

```rust
pub fn streaming_timeout_config() -> TimeoutConfig {
    TimeoutConfig::builder()
        .operation_timeout(Duration::from_secs(600))  // 10分钟
        .build()
}
```

## 模型缓存

### 缓存实现

```rust
type ModelCache = Arc<RwLock<Option<ModelListResult>>>;

impl ApiClient {
    pub async fn list_models(&self) -> Result<(Vec<Model>, Model)> {
        // 检查缓存
        {
            let cache = self.model_cache.read().await;
            if let Some(cached) = cache.as_ref() {
                return Ok(cached.clone().into());
            }
        }
        
        // 调用 API
        let response = self.client
            .list_available_models()
            .send()
            .await?;
        
        let result = ModelListResult {
            models: response.models.unwrap_or_default(),
            default_model: response.default_model.unwrap(),
        };
        
        // 更新缓存
        {
            let mut cache = self.model_cache.write().await;
            *cache = Some(result.clone());
        }
        
        Ok(result.into())
    }
    
    pub fn clear_model_cache(&self) {
        let mut cache = self.model_cache.blocking_write();
        *cache = None;
    }
}
```

## 流式响应处理

### ChatResponseStream

```rust
pub enum ChatResponseStream {
    AssistantResponseEvent {
        content: String,
    },
    CodeReferenceEvent {
        references: Vec<Reference>,
    },
    ConversationIdEvent {
        conversation_id: String,
    },
    InvalidStateEvent {
        reason: String,
        message: String,
    },
    Error {
        message: String,
    },
}
```

### 处理流式响应

```rust
pub async fn send_message_stream(
    &self,
    conversation_state: ConversationState,
) -> Result<impl Stream<Item = Result<ChatResponseStream>>> {
    let stream = if let Some(client) = &self.streaming_client {
        // 使用流式客户端
        client
            .send_message()
            .conversation_state(conversation_state)
            .send()
            .await?
    } else {
        return Err(ApiClientError::StreamingNotSupported);
    };
    
    Ok(stream.map(|event| {
        event.map_err(ApiClientError::from)
    }))
}
```

### 使用示例

```rust
let mut stream = api_client
    .send_message_stream(conversation_state)
    .await?;

let mut full_response = String::new();
let mut references = Vec::new();

while let Some(event) = stream.next().await {
    match event? {
        ChatResponseStream::AssistantResponseEvent { content } => {
            print!("{}", content);
            stdout().flush()?;
            full_response.push_str(&content);
        }
        ChatResponseStream::CodeReferenceEvent { references: refs } => {
            references.extend(refs);
        }
        ChatResponseStream::ConversationIdEvent { conversation_id } => {
            // 保存对话 ID
        }
        ChatResponseStream::Error { message } => {
            eprintln!("Error: {}", message);
        }
        _ => {}
    }
}
```

## 错误处理

### ApiClientError

```rust
#[derive(Debug, Error)]
pub enum ApiClientError {
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    
    #[error("AWS SDK error: {0}")]
    AwsSdk(#[from] aws_sdk_codewhisperer::Error),
    
    #[error("Authentication error: {0}")]
    Auth(#[from] AuthError),
    
    #[error("Access denied: {0}")]
    AccessDenied(String),
    
    #[error("Throttling: {0}")]
    Throttling(String),
    
    #[error("Validation error: {0}")]
    Validation(String),
    
    #[error("Internal server error: {0}")]
    InternalServer(String),
    
    #[error("Service quota exceeded: {0}")]
    ServiceQuotaExceeded(String),
    
    #[error("Streaming not supported")]
    StreamingNotSupported,
    
    #[error("Model not found: {0}")]
    ModelNotFound(String),
}
```

### 错误重试逻辑

```rust
impl ApiClient {
    pub async fn send_with_retry<F, Fut, T>(
        &self,
        f: F,
    ) -> Result<T>
    where
        F: Fn() -> Fut,
        Fut: Future<Output = Result<T>>,
    {
        let mut attempts = 0;
        let max_attempts = 3;
        let mut backoff = Duration::from_millis(100);
        
        loop {
            attempts += 1;
            
            match f().await {
                Ok(result) => return Ok(result),
                Err(e) if attempts < max_attempts && e.is_retryable() => {
                    tracing::warn!("Request failed (attempt {}/{}): {}", attempts, max_attempts, e);
                    tokio::time::sleep(backoff).await;
                    backoff *= 2;
                    backoff = backoff.min(MAX_RETRY_DELAY_DURATION);
                }
                Err(e) => return Err(e),
            }
        }
    }
}
```

## 请求上下文

### UserContext 构建

```rust
pub fn build_user_context(env: &Env, os: &Os) -> UserContext {
    UserContext::builder()
        .ide_category(IdeCategory::Cli)
        .operating_system(detect_os())
        .product("Amazon Q CLI")
        .client_id(get_client_id())
        .ide_version(Some(env!("CARGO_PKG_VERSION").to_string()))
        .build()
        .unwrap()
}

fn detect_os() -> OperatingSystem {
    #[cfg(target_os = "macos")]
    return OperatingSystem::MacOs;
    
    #[cfg(target_os = "linux")]
    return OperatingSystem::Linux;
    
    #[cfg(target_os = "windows")]
    return OperatingSystem::Windows;
    
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    return OperatingSystem::Unknown;
}
```

## 性能优化

### 1. 连接池

使用 `reqwest` 的连接池来复用 TCP 连接：

```rust
let http_client = reqwest::Client::builder()
    .pool_max_idle_per_host(10)
    .pool_idle_timeout(Duration::from_secs(90))
    .build()?;
```

### 2. 请求并发

使用 `tokio::spawn` 并发执行多个请求：

```rust
let futures = models.into_iter().map(|model| {
    let client = self.clone();
    tokio::spawn(async move {
        client.get_model_info(&model).await
    })
});

let results = futures::future::join_all(futures).await;
```

### 3. 缓存策略

- 模型列表缓存（持续时间：会话期间）
- 配置文件缓存（持续时间：1小时）
- 功能标志缓存（持续时间：5分钟）

## 安全考虑

### 1. TLS/SSL

使用 `rustls` 提供现代化的 TLS 实现：

```rust
let tls_config = rustls::ClientConfig::builder()
    .with_safe_defaults()
    .with_native_roots()
    .with_no_client_auth();
```

### 2. 凭证保护

- 令牌存储在加密的数据库中
- 内存中的凭证使用 `SecureString` 类型
- 避免在日志中记录敏感信息

### 3. 请求签名

对于使用 SigV4 的请求，AWS SDK 会自动处理签名：

```rust
// SDK 自动添加签名头
Authorization: AWS4-HMAC-SHA256 Credential=...
```

## 测试支持

### Mock 客户端

```rust
impl ApiClient {
    pub fn with_mock_responses(responses: Vec<ChatResponseStream>) -> Self {
        Self {
            client: /* ... */,
            streaming_client: None,
            sigv4_streaming_client: None,
            mock_client: Some(Arc::new(Mutex::new(responses.into_iter()))),
            profile: None,
            model_cache: Arc::new(RwLock::new(None)),
        }
    }
}
```

### 使用示例

```rust
#[tokio::test]
async fn test_send_message() {
    let mock_responses = vec![
        ChatResponseStream::AssistantResponseEvent {
            content: "Hello".to_string(),
        },
        ChatResponseStream::AssistantResponseEvent {
            content: " World".to_string(),
        },
    ];
    
    let client = ApiClient::with_mock_responses(mock_responses);
    
    let result = client.send_message_stream(conversation_state).await?;
    // 断言...
}
```

## 总结

API 客户端架构提供了：
- 灵活的凭证管理
- 可配置的端点
- 完善的重试机制
- 流式响应支持
- 性能优化（缓存、连接池）
- 安全性保障
- 测试友好的设计
