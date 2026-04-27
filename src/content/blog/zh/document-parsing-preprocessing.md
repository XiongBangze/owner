---
title: "文档解析与预处理"
date: "2026-04-02"
description: "RAG 系统中文档解析与预处理的关键技术，涵盖 PDF 解析、OCR 识别与文本分块策略"
tags: [文档解析, PDF, OCR]
---

在 RAG（检索增强生成）系统中，文档解析与预处理是数据管线的第一步，其质量直接决定下游检索和生成的效果。常见的文档格式包括 PDF、Word、HTML 和扫描图片，每种格式都有不同的解析挑战。

PDF 解析是最复杂的场景。文本型 PDF 可用 `PyMuPDF` 或 `pdfplumber` 提取文字和表格；扫描型 PDF 则需要 OCR 引擎（如 `PaddleOCR` 或 `Tesseract`）先将图像转为文字。混合型 PDF（部分文字部分扫描）需要先判断每页类型再分别处理。表格解析尤其困难，推荐使用 `camelot` 或基于视觉模型的方案。

文本分块（Chunking）是预处理的核心环节。固定长度分块简单但会切断语义；基于分隔符的分块（按段落、标题）保持语义完整性更好；递归分块（Recursive Splitting）则结合多级分隔符逐层切分，是目前最常用的策略。分块大小通常在 256-1024 token 之间，需根据 embedding 模型的最佳输入长度调整。块间重叠（overlap）50-100 token 可避免边界信息丢失。

```python
import fitz  # PyMuPDF
from langchain.text_splitter import RecursiveCharacterTextSplitter

def parse_pdf(path: str) -> str:
    doc = fitz.open(path)
    text = "\n".join(page.get_text() for page in doc)
    doc.close()
    return text

splitter = RecursiveCharacterTextSplitter(
    chunk_size=512,
    chunk_overlap=64,
    separators=["\n\n", "\n", "。", ".", " "],
)

raw_text = parse_pdf("report.pdf")
chunks = splitter.split_text(raw_text)
print(f"共 {len(chunks)} 个分块，首块: {chunks[0][:80]}...")
```

预处理还应包括去除页眉页脚、合并跨页段落、标准化空白字符等清洗步骤。
