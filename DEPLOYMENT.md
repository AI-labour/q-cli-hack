# 部署指南

## 开发环境

### 前置条件

- Node.js 18+ 
- npm 或 yarn
- AWS Builder ID 账户

### 本地开发

1. 克隆项目并安装依赖：

```bash
git clone <repository-url>
cd codewhisperer-openai-proxy
npm install
```

2. 进行认证：

```bash
npm run cli login
```

按照提示在浏览器中完成 AWS Builder ID 认证。

3. 测试 API：

```bash
npm run cli test "写一个冒泡排序"
```

4. 启动开发服务器：

```bash
npm run dev
```

服务器将在 `http://localhost:3000` 启动。

### 构建生产版本

```bash
npm run build
npm start
```

## 生产部署

### Docker 部署

创建 `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/proxy-server.js"]
```

构建和运行：

```bash
docker build -t codewhisperer-proxy .
docker run -p 3000:3000 -v ~/.codewhisperer-proxy:/root/.codewhisperer-proxy codewhisperer-proxy
```

### 环境变量

- `PORT`: 服务器端口（默认 3000）
- 可以通过挂载 volume 来持久化认证信息：
  - 本地路径：`~/.codewhisperer-proxy`
  - 容器路径：`/root/.codewhisperer-proxy`

### Kubernetes 部署

创建 `k8s-deployment.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: codewhisperer-proxy-config
data:
  PORT: "3000"

---

apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: codewhisperer-auth-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi

---

apiVersion: apps/v1
kind: Deployment
metadata:
  name: codewhisperer-proxy
spec:
  replicas: 1
  selector:
    matchLabels:
      app: codewhisperer-proxy
  template:
    metadata:
      labels:
        app: codewhisperer-proxy
    spec:
      containers:
      - name: proxy
        image: codewhisperer-proxy:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: codewhisperer-proxy-config
        volumeMounts:
        - name: auth-storage
          mountPath: /root/.codewhisperer-proxy
      volumes:
      - name: auth-storage
        persistentVolumeClaim:
          claimName: codewhisperer-auth-pvc

---

apiVersion: v1
kind: Service
metadata:
  name: codewhisperer-proxy-service
spec:
  selector:
    app: codewhisperer-proxy
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

部署：

```bash
kubectl apply -f k8s-deployment.yaml
```

### 反向代理配置

#### Nginx

```nginx
server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # For SSE streaming
        proxy_buffering off;
        proxy_cache off;
    }
}
```

#### Caddy

```
api.example.com {
    reverse_proxy localhost:3000
}
```

## 安全建议

### 1. 认证保护

由于代理服务器会使用存储的 AWS Builder ID 凭证，建议：

- 不要在公网直接暴露服务
- 使用 VPN 或内网访问
- 添加额外的认证层（如 API Key 验证）

示例：添加简单的 API Key 验证到 `proxy-server.ts`:

```typescript
const API_KEY = process.env.API_KEY || 'your-secret-key';

app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const token = authHeader.substring(7);
  if (token !== API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
});
```

### 2. 速率限制

安装 express-rate-limit:

```bash
npm install express-rate-limit
```

添加到 `proxy-server.ts`:

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/v1/', limiter);
```

### 3. HTTPS

在生产环境中始终使用 HTTPS。可以使用：
- Let's Encrypt 证书
- 云服务商提供的负载均衡器（如 AWS ALB）
- Cloudflare 等 CDN

### 4. 日志和监控

添加日志记录：

```typescript
import morgan from 'morgan';

app.use(morgan('combined'));
```

## 故障排查

### 认证失败

如果遇到认证问题：

1. 删除现有凭证：
   ```bash
   rm -rf ~/.codewhisperer-proxy
   ```

2. 重新认证：
   ```bash
   npm run cli login
   ```

### Token 过期

Token 会自动刷新。如果自动刷新失败，重新认证即可。

### API 错误

查看服务器日志以获取详细错误信息。常见错误：

- **401 Unauthorized**: Token 无效或过期
- **429 Too Many Requests**: 超出速率限制
- **500 Internal Server Error**: CodeWhisperer 服务错误

### 连接问题

确保可以访问 AWS 服务：
```bash
curl https://codewhisperer.us-east-1.amazonaws.com
```

## 性能优化

### 1. 使用连接池

默认的 fetch API 会为每个请求创建新连接。对于高并发场景，考虑使用：

```bash
npm install undici
```

### 2. 添加缓存

对于重复的请求，可以添加 Redis 缓存：

```bash
npm install redis
```

### 3. 负载均衡

对于高流量场景，部署多个实例并使用负载均衡器。

## 监控指标

建议监控的指标：

- 请求数/秒
- 响应时间
- 错误率
- Token 刷新频率
- 会话数量

可以使用 Prometheus + Grafana 进行监控。

## 备份

定期备份认证信息：

```bash
tar -czf codewhisperer-auth-backup.tar.gz ~/.codewhisperer-proxy
```

## 更新

更新到新版本：

```bash
git pull
npm install
npm run build
npm start
```

如果是 Docker 部署：

```bash
docker build -t codewhisperer-proxy:latest .
docker stop codewhisperer-proxy
docker rm codewhisperer-proxy
docker run -d --name codewhisperer-proxy -p 3000:3000 -v ~/.codewhisperer-proxy:/root/.codewhisperer-proxy codewhisperer-proxy:latest
```
