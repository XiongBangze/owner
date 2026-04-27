---
title: "Dockerizing AI Applications"
date: "2026-03-21"
description: "Containerize AI applications with Docker, covering multi-stage builds, GPU support, image optimization, and health checks."
tags: ["Docker", "Containerization", "Deployment"]
---

AI applications have complex dependencies (Python versions, CUDA drivers, model weights). Docker containerization is the best practice for achieving environment consistency and reproducible deployments.

## Multi-Stage Builds

AI images are typically large (PyTorch + CUDA base images can reach several GB). Multi-stage builds separate build-time and runtime dependencies: the first stage installs compilers and builds wheel packages, the second stage copies only compiled artifacts and runtime dependencies, significantly reducing final image size.

## GPU Support

NVIDIA Container Toolkit allows containers to directly access host GPUs. By specifying an `nvidia/cuda` base image and adding the `--gpus` flag at runtime, AI models can seamlessly use GPU acceleration inside containers. The key is ensuring CUDA version compatibility between the container and host driver.

## Health Checks and Graceful Shutdown

AI services have long startup times (loading model weights). Health checks should distinguish between liveness and readiness: liveness checks whether the process is alive, readiness checks whether the model has finished loading. Graceful shutdown must handle in-flight inference requests to prevent data loss from interruption.

## Image Security

Production images should run as non-root users, remove unnecessary tools and shells, and undergo regular vulnerability scanning. Model weights should not be baked into images — instead, mount volumes or download from object storage at startup.

```python
# build.py — Automated Docker build script
import subprocess
import sys

CONFIG = {
    "image": "ai-service",
    "base": "nvidia/cuda:12.2.0-runtime-ubuntu22.04",
    "python": "3.11",
}

DOCKERFILE = f"""
# Stage 1: Build
FROM python:{{CONFIG['python']}}-slim AS builder
WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: Runtime
FROM {CONFIG['base']}
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip && rm -rf /var/lib/apt/lists/*
COPY --from=builder /install /usr/local
WORKDIR /app
COPY src/ ./src/
RUN useradd -r -s /bin/false appuser
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD python3 -c "import httpx; httpx.get('http://localhost:8000/health').raise_for_status()"
CMD ["python3", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
"""

def build(tag: str = "latest"):
    with open("Dockerfile", "w") as f:
        f.write(DOCKERFILE)
    cmd = ["docker", "build", "-t", f"{CONFIG['image']}:{tag}", "."]
    subprocess.run(cmd, check=True)
    print(f"Built {CONFIG['image']}:{tag}")

def run(tag: str = "latest", gpus: bool = True):
    cmd = ["docker", "run", "-d", "-p", "8000:8000", "--name", CONFIG["image"]]
    if gpus:
        cmd.extend(["--gpus", "all"])
    cmd.append(f"{CONFIG['image']}:{tag}")
    subprocess.run(cmd, check=True)

if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else "build"
    {"build": build, "run": run}[action]()
```
