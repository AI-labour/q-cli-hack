# ⚠️ 用户操作提示

## 📋 更新说明

您拉取的最新代码包含了一个重要的权限修复（版本 1.0.1），解决了 403 AccessDeniedException 错误。

如果您之前已经成功登录过，现在需要**重新登录**以获取新的权限。

## 🔧 快速修复

### 如果您遇到了 403 错误

运行以下命令自动修复：

```bash
npm run fix-403
```

或者手动执行：

```bash
# 1. 清理旧的认证信息
rm -rf ~/.codewhisperer-proxy

# 2. 重新登录
npm run cli login

# 3. 测试
npm run cli test "你好"
```

### 如果您还没有登录过

直接登录即可：

```bash
npm run cli login
```

## ❓ 为什么需要重新登录

项目添加了新的权限范围 `codewhisperer:conversations`，这是使用聊天/对话功能所必需的。旧的认证令牌不包含此权限，因此会导致 403 错误。

## 📚 详细信息

- 完整说明：[FIX_403_ERROR.md](./FIX_403_ERROR.md)
- 技术细节：[BUGFIX_SUMMARY.md](./BUGFIX_SUMMARY.md)
- 变更日志：[CHANGELOG.md](./CHANGELOG.md)

## ✅ 验证修复

修复成功后，您应该能看到类似这样的输出：

```bash
$ npm run cli test "写一个快速排序算法"

Testing CodeWhisperer API...

Question: 写一个快速排序算法

Response:
[CodeWhisperer 的正常响应]
```

## 🆘 仍然遇到问题？

请参阅：
1. [FIX_403_ERROR.md](./FIX_403_ERROR.md) - 详细的故障排查指南
2. [README.md](./README.md#故障排查) - 项目文档的故障排查部分
3. 提交 Issue 并附上错误日志

---

💡 **提示**：此操作不会影响您在 AWS 端的任何数据，只是刷新本地存储的认证信息。
