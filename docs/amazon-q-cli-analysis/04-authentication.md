# 认证与授权机制

## 认证方式概览

Amazon Q Developer CLI 支持两种主要认证方式：

1. **AWS Builder ID** - 免费的个人账户认证
2. **IAM Identity Center** - 企业 SSO 认证

## 认证架构

```
┌─────────────────┐
│   CLI Client    │
└────────┬────────┘
         │
         ├─> Builder ID Flow
         │   └─> AWS SSO OIDC
         │
         └─> IAM Identity Center Flow
             └─> PKCE OAuth 2.0
```

## Builder ID 认证流程

### 设备授权流程 (Device Authorization Flow)

这是 Builder ID 使用的主要流程，基于 OAuth 2.0 Device Authorization Grant。

```
┌────────┐                          ┌──────────────┐                    ┌──────────┐
│  CLI   │                          │ SSO OIDC API │                    │ Browser  │
└───┬────┘                          └──────┬───────┘                    └────┬─────┘
    │                                      │                                  │
    │ 1. RegisterClient                    │                                  │
    │─────────────────────────────────────>│                                  │
    │                                      │                                  │
    │ 2. ClientCredentials                 │                                  │
    │<─────────────────────────────────────│                                  │
    │   (clientId, clientSecret)           │                                  │
    │                                      │                                  │
    │ 3. StartDeviceAuthorization          │                                  │
    │─────────────────────────────────────>│                                  │
    │                                      │                                  │
    │ 4. DeviceCode + UserCode + URL       │                                  │
    │<─────────────────────────────────────│                                  │
    │                                      │                                  │
    │ 5. Display UserCode & URL            │                                  │
    │                                      │                                  │
    │ 6. Open Browser                      │                                  │
    │──────────────────────────────────────────────────────────────────────>  │
    │                                      │                                  │
    │                                      │ 7. User authenticates & authorizes│
    │                                      │<─────────────────────────────────│
    │                                      │                                  │
    │ 8. Poll CreateToken (loop)           │                                  │
    │─────────────────────────────────────>│                                  │
    │                                      │                                  │
    │ 9. Pending...                        │                                  │
    │<─────────────────────────────────────│                                  │
    │                                      │                                  │
    │ 10. Poll CreateToken                 │                                  │
    │─────────────────────────────────────>│                                  │
    │                                      │                                  │
    │ 11. AccessToken + RefreshToken       │                                  │
    │<─────────────────────────────────────│                                  │
    │                                      │                                  │
    │ 12. Store tokens in database         │                                  │
    │                                      │                                  │
```

### 详细实现步骤

#### 1. RegisterClient

```rust
// 注册客户端应用
let register_response = ssooidc_client
    .register_client()
    .client_name("Amazon Q CLI")
    .client_type("public")
    .scopes("codewhisperer:completions")
    .send()
    .await?;

let client_id = register_response.client_id().unwrap();
let client_secret = register_response.client_secret().unwrap();
```

#### 2. StartDeviceAuthorization

```rust
let device_auth_response = ssooidc_client
    .start_device_authorization()
    .client_id(client_id)
    .client_secret(client_secret)
    .start_url(START_URL)
    .send()
    .await?;

let device_code = device_auth_response.device_code().unwrap();
let user_code = device_auth_response.user_code().unwrap();
let verification_uri = device_auth_response.verification_uri().unwrap();
```

**START_URL**: `https://view.awsapps.com/start`

#### 3. 显示验证信息

CLI 会显示：
```
To authorize this device, visit: https://device.sso.us-east-1.amazonaws.com
Enter code: ABCD-EFGH
```

然后自动打开浏览器。

#### 4. 轮询令牌

```rust
loop {
    tokio::time::sleep(Duration::from_secs(interval)).await;
    
    match ssooidc_client
        .create_token()
        .client_id(client_id)
        .client_secret(client_secret)
        .device_code(device_code)
        .grant_type("urn:ietf:params:oauth:grant-type:device_code")
        .send()
        .await 
    {
        Ok(token_response) => {
            // 成功获取令牌
            let access_token = token_response.access_token().unwrap();
            let refresh_token = token_response.refresh_token();
            let expires_in = token_response.expires_in();
            break;
        }
        Err(e) if is_authorization_pending(&e) => {
            // 继续等待
            continue;
        }
        Err(e) => {
            // 其他错误
            return Err(e.into());
        }
    }
}
```

## PKCE OAuth 流程 (IAM Identity Center)

### PKCE (Proof Key for Code Exchange)

用于 IAM Identity Center 认证的更安全的 OAuth 流程。

```
┌────────┐                    ┌──────────┐                  ┌────────────┐
│  CLI   │                    │ Browser  │                  │  IdP SSO   │
└───┬────┘                    └────┬─────┘                  └──────┬─────┘
    │                              │                               │
    │ 1. Generate code_verifier    │                               │
    │    code_challenge             │                               │
    │                              │                               │
    │ 2. Start local HTTP server   │                               │
    │    (listening on 127.0.0.1)  │                               │
    │                              │                               │
    │ 3. Build authorization URL   │                               │
    │    with code_challenge        │                               │
    │                              │                               │
    │ 4. Open browser              │                               │
    │─────────────────────────────>│                               │
    │                              │                               │
    │                              │ 5. User authenticates         │
    │                              │──────────────────────────────>│
    │                              │                               │
    │                              │ 6. Authorization code         │
    │                              │<──────────────────────────────│
    │                              │                               │
    │ 7. Redirect to localhost     │                               │
    │    with authorization code    │                               │
    │<─────────────────────────────│                               │
    │                              │                               │
    │ 8. Exchange code for token   │                               │
    │    (send code_verifier)       │                               │
    │──────────────────────────────────────────────────────────────>│
    │                              │                               │
    │ 9. Access token + Refresh token                              │
    │<──────────────────────────────────────────────────────────────│
    │                              │                               │
    │ 10. Store tokens             │                               │
    │     Close server              │                               │
    │                              │                               │
```

### PKCE 实现细节

#### 1. 生成 Code Verifier 和 Challenge

```rust
use ring::digest::{digest, SHA256};
use base64::engine::general_purpose::URL_SAFE_NO_PAD;

// 生成随机 code_verifier (43-128 字符)
let code_verifier: String = (0..64)
    .map(|_| rand::random::<u8>() & 0x7f)
    .map(|b| (b % 62 + 48) as char)
    .collect();

// 计算 code_challenge = BASE64URL(SHA256(code_verifier))
let digest = digest(&SHA256, code_verifier.as_bytes());
let code_challenge = URL_SAFE_NO_PAD.encode(digest.as_ref());
```

#### 2. 构建授权 URL

```rust
let auth_url = format!(
    "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&state={}&code_challenge={}&code_challenge_method=S256",
    authorize_endpoint,
    client_id,
    percent_encode(redirect_uri),
    percent_encode(scopes),
    state,
    code_challenge
);
```

**参数说明**:
- `response_type=code`: 授权码模式
- `code_challenge_method=S256`: 使用 SHA256
- `state`: 防止 CSRF 攻击的随机字符串
- `redirect_uri`: 本地回调地址，如 `http://127.0.0.1:8080/callback`

#### 3. 本地 HTTP 服务器

```rust
use hyper::server::Server;
use hyper::service::service_fn;

async fn handle_callback(
    req: Request<Body>,
    state: String,
    tx: Sender<CallbackResult>,
) -> Result<Response<Body>, Infallible> {
    // 解析查询参数
    let query: HashMap<_, _> = req.uri()
        .query()
        .unwrap_or("")
        .split('&')
        .filter_map(|s| s.split_once('='))
        .collect();
    
    // 验证 state
    if query.get("state") != Some(&state.as_str()) {
        return Ok(error_response("State mismatch"));
    }
    
    // 获取授权码
    let code = query.get("code")
        .ok_or("Missing code")?;
    
    // 发送结果
    tx.send(CallbackResult::Success(code.to_string())).ok();
    
    // 返回成功页面
    Ok(success_response())
}

// 启动服务器
let addr = ([127, 0, 0, 1], 8080).into();
let server = Server::bind(&addr)
    .serve(make_service_fn(|_| {
        async move {
            Ok::<_, Infallible>(service_fn(handle_callback))
        }
    }));
```

#### 4. 交换令牌

```rust
let token_response = reqwest::Client::new()
    .post(token_endpoint)
    .form(&[
        ("grant_type", "authorization_code"),
        ("code", &authorization_code),
        ("redirect_uri", redirect_uri),
        ("client_id", client_id),
        ("code_verifier", &code_verifier), // PKCE 验证
    ])
    .send()
    .await?
    .json::<TokenResponse>()
    .await?;

let access_token = token_response.access_token;
let refresh_token = token_response.refresh_token;
let expires_in = token_response.expires_in;
```

## 令牌管理

### 令牌存储

令牌存储在本地 SQLite 数据库中：

```sql
CREATE TABLE auth_profiles (
    id INTEGER PRIMARY KEY,
    profile_name TEXT UNIQUE NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at INTEGER NOT NULL,
    token_type TEXT NOT NULL,
    start_url TEXT,
    region TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
```

### 令牌结构

```rust
pub struct AuthProfile {
    pub profile_name: String,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: OffsetDateTime,
    pub token_type: String,
    pub start_url: Option<String>,
    pub region: Option<String>,
}
```

### 令牌刷新

```rust
pub async fn refresh_token_if_needed(
    db: &mut Database,
    profile: &AuthProfile,
) -> Result<AuthProfile> {
    // 检查是否即将过期 (提前 5 分钟刷新)
    let now = OffsetDateTime::now_utc();
    let buffer = Duration::minutes(5);
    
    if profile.expires_at - buffer < now {
        // 需要刷新
        let refresh_token = profile.refresh_token
            .as_ref()
            .ok_or(AuthError::NoToken)?;
        
        let ssooidc_client = create_ssooidc_client().await;
        
        let token_response = ssooidc_client
            .create_token()
            .client_id(&profile.client_id)
            .client_secret(&profile.client_secret)
            .grant_type("refresh_token")
            .refresh_token(refresh_token)
            .send()
            .await?;
        
        // 更新数据库
        let new_profile = AuthProfile {
            access_token: token_response.access_token().unwrap().to_string(),
            expires_at: now + Duration::seconds(token_response.expires_in()),
            ..profile.clone()
        };
        
        db.update_auth_profile(&new_profile)?;
        
        Ok(new_profile)
    } else {
        Ok(profile.clone())
    }
}
```

## Bearer Token 认证

### API 请求认证

在调用 CodeWhisperer API 时使用 Bearer Token：

```rust
pub struct BearerResolver {
    token: String,
}

impl ProvideCredentials for BearerResolver {
    fn provide_credentials<'a>(&'a self) -> ProvideCredentialsFuture<'a>
    where
        Self: 'a,
    {
        ProvideCredentialsFuture::ready(Ok(Credentials::new(
            "bearer",
            &self.token,
            None,
            None,
            "BearerToken",
        )))
    }
}
```

### 请求头

```
Authorization: Bearer <access_token>
```

## 认证作用域 (Scopes)

不同的功能需要不同的 OAuth 作用域：

```rust
pub const SCOPES: &[&str] = &[
    "codewhisperer:completions",     // 代码补全
    "codewhisperer:analysis",        // 代码分析
    "codewhisperer:conversations",   // 对话功能
];
```

## 认证状态检查

```rust
pub async fn is_logged_in(db: &mut Database) -> bool {
    match db.get_current_auth_profile().await {
        Ok(Some(profile)) => {
            // 检查令牌是否过期
            let now = OffsetDateTime::now_utc();
            profile.expires_at > now
        }
        _ => false,
    }
}
```

## 登出流程

```rust
pub async fn logout(os: &mut Os) -> Result<ExitCode> {
    // 1. 从数据库删除认证配置
    os.database.delete_current_auth_profile()?;
    
    // 2. 清除缓存
    os.database.clear_cache()?;
    
    // 3. 显示确认消息
    println!("Successfully logged out");
    
    Ok(ExitCode::SUCCESS)
}
```

## 安全考虑

### 1. 令牌存储安全

- 令牌存储在用户目录的 SQLite 数据库中
- 数据库文件权限设置为仅用户可读写 (0600)
- 考虑使用操作系统的密钥链 (macOS Keychain, Windows Credential Manager)

### 2. PKCE 保护

- 使用 SHA256 哈希
- code_verifier 随机生成，足够长度
- 防止授权码拦截攻击

### 3. State 参数

- 每次认证生成随机 state
- 验证回调中的 state 匹配
- 防止 CSRF 攻击

### 4. 令牌刷新

- 自动刷新过期令牌
- 提前 5 分钟刷新，避免请求失败
- 刷新失败时要求重新登录

### 5. HTTPS

- 所有 API 通信使用 HTTPS
- 使用 rustls 进行 TLS 验证
- 验证服务器证书

## 错误处理

```rust
#[derive(Debug, Error)]
pub enum AuthError {
    #[error("No token")]
    NoToken,
    
    #[error("OAuth state mismatch")]
    OAuthStateMismatch { actual: String, expected: String },
    
    #[error("Timeout waiting for authentication")]
    OAuthTimeout,
    
    #[error("OAuth error: {0}")]
    OAuthCustomError(String),
    
    // ... 更多错误类型
}
```

## 区域和端点

### SSO OIDC 端点

默认使用 `us-east-1` 区域：

```
https://oidc.us-east-1.amazonaws.com
```

### Start URL

```
https://view.awsapps.com/start
```

### 设备授权 URL

```
https://device.sso.us-east-1.amazonaws.com
```
