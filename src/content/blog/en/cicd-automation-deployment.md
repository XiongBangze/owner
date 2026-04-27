---
title: "CI/CD Automation Deployment"
date: "2026-03-11"
description: "Building a complete CI/CD pipeline with GitHub Actions and Docker for fully automated code-to-production deployment."
tags: ["CI/CD", "GitHub Actions", "Docker"]
---

CI/CD (Continuous Integration / Continuous Deployment) is the cornerstone of modern software engineering. A well-designed pipeline automatically builds, tests, packages, and deploys after every code commit, dramatically shortening delivery cycles and reducing human error.

**Continuous Integration (CI)** triggers automated tests on every code change. GitHub Actions defines workflows in YAML, supporting matrix strategies for parallel testing across multiple Python versions and operating systems. Key practices include: running unit and integration tests, code quality checks (linting), dependency security scanning, and test coverage reporting.

**Continuous Deployment (CD)** automatically deploys tested code to target environments. The typical flow is: build Docker image → push to container registry (ECR, GHCR) → update deployment config → rolling update. Multi-stage Dockerfiles effectively reduce image size, while environment variables and Secrets management secure sensitive information.

Key pipeline design principles: fail fast, environment consistency (same image across dev/test/prod), rollback capability (retain historical versions), and least privilege (deployment credentials with minimal permissions).

```python
# deploy.py — Automated deployment script
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
            print(f"Deploy failed: {result.stderr}")
            sys.exit(1)
        print(f"✓ {cmd.split()[1]}")

    # Health check
    import urllib.request
    try:
        resp = urllib.request.urlopen(f"https://{service}.example.com/health", timeout=30)
        assert resp.status == 200, f"Health check failed: {resp.status}"
        print("✓ Deployment successful, health check passed")
    except Exception as e:
        print(f"✗ Health check failed: {e}, triggering rollback")
        subprocess.run(f"docker service rollback {service}".split())
        sys.exit(1)

if __name__ == "__main__":
    deploy(image_tag=sys.argv[1], service="web-api")
```
