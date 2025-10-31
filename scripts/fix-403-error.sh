#!/bin/bash

# 修复 403 AccessDeniedException 错误的脚本
# 使用方法: bash scripts/fix-403-error.sh

set -e

echo "========================================"
echo "修复 403 AccessDeniedException 错误"
echo "========================================"
echo ""

# 检查配置目录是否存在
CONFIG_DIR="$HOME/.codewhisperer-proxy"

if [ -d "$CONFIG_DIR" ]; then
    echo "✓ 发现旧的配置目录: $CONFIG_DIR"
    echo ""
    
    # 显示当前的令牌信息（如果存在）
    if [ -f "$CONFIG_DIR/tokens.json" ]; then
        echo "当前令牌信息:"
        if command -v jq &> /dev/null; then
            jq '.scopes' "$CONFIG_DIR/tokens.json" 2>/dev/null || echo "  (无法读取 scopes)"
        else
            grep -o '"scopes":\[.*\]' "$CONFIG_DIR/tokens.json" 2>/dev/null || echo "  (无法读取 scopes)"
        fi
        echo ""
    fi
    
    # 询问是否删除
    read -p "是否删除旧配置并重新登录? (y/N) " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "正在删除旧配置..."
        rm -rf "$CONFIG_DIR"
        echo "✓ 已删除旧配置"
        echo ""
    else
        echo "取消操作"
        exit 0
    fi
else
    echo "✓ 未发现旧配置，可以直接登录"
    echo ""
fi

# 重新登录
echo "请运行以下命令重新登录:"
echo ""
echo "  npm run cli login"
echo ""
echo "登录成功后，运行以下命令测试:"
echo ""
echo "  npm run cli test \"你好\""
echo ""
echo "新的令牌将包含以下权限范围:"
echo "  - codewhisperer:completions"
echo "  - codewhisperer:analysis"
echo "  - codewhisperer:conversations (新增)"
echo ""
echo "========================================"
