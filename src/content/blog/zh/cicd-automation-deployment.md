---
title: "CI/CD 自动化部署"
date: "2026-03-11"
description: "基于 GitHub Actions 和 Docker 构建完整的 CI/CD 流水线，实现从代码提交到生产部署的全自动化。"
tags: ["CI/CD", "GitHub Actions", "Docker"]
---

CI/CD（持续集成/持续部署）是现代软件工程的基石。一条设计良好的流水线能够在代码提交后自动完成构建、测试、镜像打包和部署，大幅缩短交付周期并降低人为错误。

**持续集成（CI）** 的核心是每次代码变更都触发自动化测试。GitHub Actions 通过 YAML 工作流定义，支持矩阵构建（matrix strategy）在多个 Python 版本和操作系统上并行测试。关键实践包括：运行单元测试和集成测试、代码质量检查（linting）、依赖安全扫描、以及测试覆盖率报告。

**持续部署（CD）** 将通过测试的代码自动部署到目标环境。典型流程是：构建 Docker 镜像 → 推送到容器仓库（如 ECR、GHCR）→ 更新部署配置 → 滚动更新。多阶段 Dockerfile 能有效减小镜像体积，而环境变量和 Secrets 管理则保障了敏感信息的安全。

流水线设计的关键原则：快速失败（fail fast）、环境一致性（开发/测试/生产使用相同镜像）、可回滚（保留历史版本）、以及最小权限原则（部署凭证仅授予必要权限）。

```python
# deploy.py — 自动化部署脚本
import subprocess
import sys

def deploy(image_tag: str, service: str):
    steps = [
        f"docker build -t myapp:{image_tag} --target production .",
        f"docker tag myapp:{image_tag} registry.example.com/myapp:{image_tag}",
        f"docker push registry.example.com/myapp:{image_tag}",
    ]
    for cmd in steps:
        result = subprocess.run(cmd.split(), capture_output=True, text=True)
        if result.returncode != 0:
            print(f"部署失败: {result.stderr}")
            sys.exit(1)
        print(f"✓ {cmd.split()[1]}")

    # 健康检查
    import urllib.request
    try:
        resp = urllib.request.urlopen(f"https://{service}.example.com/health", timeout=30)
        assert resp.status == 200, f"健康检查失败: {resp.status}"
        print("✓ 部署成功，健康检查通过")
    except Exception as e:
        print(f"✗ 健康检查失败: {e}，触发回滚")
        subprocess.run(f"docker service rollback {service}".split())
        sys.exit(1)

if __name__ == "__main__":
    deploy(image_tag=sys.argv[1], service="web-api")
```
