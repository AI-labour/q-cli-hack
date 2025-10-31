# 快速上手指南

## 5 分钟快速开始

### 步骤 1: 安装

```bash
git clone <repository-url>
cd codewhisperer-openai-proxy
npm install
```

### 步骤 2: 认证

```bash
npm run cli login
```

这将打开一个浏览器窗口，请使用你的 AWS Builder ID 登录。

如果没有 AWS Builder ID，访问 https://aws.amazon.com/builder-id/ 创建一个（免费）。

### 步骤 3: 测试

```bash
npm run cli test "写一个 Python 快速排序"
```

### 步骤 4: 启动服务器

```bash
npm run dev
```

服务器现在运行在 `http://localhost:3000`

### 步骤 5: 测试 API

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "codewhisperer",
    "messages": [
      {"role": "user", "content": "解释什么是递归"}
    ],
    "stream": false
  }'
```

## 与现有工具集成

### OpenAI Python SDK

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="any"  # 可以是任意字符串
)

response = client.chat.completions.create(
    model="codewhisperer",
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)

print(response.choices[0].message.content)
```

### Continue (VSCode 扩展)

1. 安装 Continue 扩展
2. 打开设置 (config.json)
3. 添加配置：

```json
{
  "models": [
    {
      "title": "CodeWhisperer",
      "provider": "openai",
      "model": "codewhisperer",
      "apiBase": "http://localhost:3000/v1",
      "apiKey": "any"
    }
  ]
}
```

### Open WebUI

1. 打开 Open WebUI 设置
2. 添加 OpenAI API 连接：
   - API URL: `http://localhost:3000/v1`
   - API Key: `any`
3. 选择模型 `codewhisperer`

### Cursor

1. 打开 Cursor 设置
2. 选择 "OpenAI API"
3. 设置：
   - Base URL: `http://localhost:3000/v1`
   - API Key: `any`
   - Model: `codewhisperer`

## 常见用例

### 代码生成

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "codewhisperer",
    "messages": [
      {
        "role": "user", 
        "content": "用 Python 写一个二叉树的中序遍历"
      }
    ]
  }'
```

### 代码解释

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "codewhisperer",
    "messages": [
      {
        "role": "user",
        "content": "解释这段代码：\n```python\ndef quicksort(arr):\n    if len(arr) <= 1:\n        return arr\n    pivot = arr[len(arr) // 2]\n    left = [x for x in arr if x < pivot]\n    middle = [x for x in arr if x == pivot]\n    right = [x for x in arr if x > pivot]\n    return quicksort(left) + middle + quicksort(right)\n```"
      }
    ]
  }'
```

### 代码审查

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "codewhisperer",
    "messages": [
      {
        "role": "user",
        "content": "审查这段代码，找出潜在的问题：\n```javascript\nfunction fetchData(url) {\n  const data = fetch(url);\n  return data.json();\n}\n```"
      }
    ]
  }'
```

### 流式响应

```bash
curl -N -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "codewhisperer",
    "messages": [
      {"role": "user", "content": "写一个 README 文件的模板"}
    ],
    "stream": true
  }'
```

## 故障排查

### 问题：认证失败

**解决方案：**
```bash
rm -rf ~/.codewhisperer-proxy
npm run cli login
```

### 问题：无法连接到服务器

**检查：**
```bash
curl http://localhost:3000/health
```

如果失败，确保服务器正在运行：
```bash
npm run dev
```

### 问题：Token 过期

Token 会自动刷新。如果遇到问题，重新登录：
```bash
npm run cli login
```

### 问题：API 返回错误

查看服务器日志以获取详细错误信息。常见错误代码：

- **401**: Token 无效 → 重新登录
- **429**: 请求过多 → 等待一段时间
- **500**: 服务器错误 → 查看日志

## 下一步

- 📖 阅读 [完整文档](./README.md)
- 🔍 了解 [API 分析](./ANALYSIS.md)
- 🚀 查看 [部署指南](./DEPLOYMENT.md)
- 💡 浏览 [使用示例](./examples/)
- 📊 查看 [项目总结](./SUMMARY.md)

## 获取帮助

如果遇到问题：

1. 检查日志输出
2. 查阅文档
3. 提交 Issue（包含错误日志）

## 限制

- 需要 AWS Builder ID 账户
- 可能存在速率限制
- 某些高级功能可能不可用（取决于账户类型）

## 提示和技巧

### 提示 1: 使用环境变量

```bash
export PORT=8080
npm run dev
```

### 提示 2: 多实例部署

在不同端口运行多个实例：

```bash
# 终端 1
PORT=3001 npm run dev

# 终端 2
PORT=3002 npm run dev
```

### 提示 3: 后台运行

```bash
npm run build
nohup node dist/proxy-server.js > server.log 2>&1 &
```

### 提示 4: 使用 PM2

```bash
npm install -g pm2
pm2 start dist/proxy-server.js --name codewhisperer-proxy
pm2 logs codewhisperer-proxy
```

### 提示 5: Docker 快速启动

```bash
docker build -t cw-proxy .
docker run -d -p 3000:3000 -v ~/.codewhisperer-proxy:/root/.codewhisperer-proxy cw-proxy
```

## 性能建议

对于生产使用：

1. 启用 HTTPS
2. 添加速率限制
3. 设置监控
4. 使用反向代理（Nginx/Caddy）
5. 考虑负载均衡

详见 [部署指南](./DEPLOYMENT.md)。
