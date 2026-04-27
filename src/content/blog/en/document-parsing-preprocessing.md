---
title: "Document Parsing and Preprocessing"
date: "2026-04-02"
description: "Key techniques for document parsing and preprocessing in RAG systems, covering PDF parsing, OCR, and text chunking strategies"
tags: [Document Parsing, PDF, OCR]
---

In RAG (Retrieval-Augmented Generation) systems, document parsing and preprocessing is the first step in the data pipeline, and its quality directly determines downstream retrieval and generation effectiveness. Common document formats include PDF, Word, HTML, and scanned images, each presenting different parsing challenges.

PDF parsing is the most complex scenario. Text-based PDFs can be extracted using `PyMuPDF` or `pdfplumber` for text and tables; scanned PDFs require OCR engines (such as `PaddleOCR` or `Tesseract`) to convert images to text first. Hybrid PDFs (partially text, partially scanned) need page-level type detection before applying the appropriate method. Table parsing is particularly challenging — consider using `camelot` or vision-model-based approaches.

Text chunking is the core preprocessing step. Fixed-length chunking is simple but breaks semantic boundaries; separator-based chunking (by paragraphs, headings) better preserves semantic integrity; Recursive Splitting combines multi-level separators for hierarchical splitting and is currently the most widely used strategy. Chunk sizes typically range from 256-1024 tokens, adjusted based on the embedding model's optimal input length. An overlap of 50-100 tokens between chunks prevents boundary information loss.

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
    separators=["\n\n", "\n", ".", " "],
)

raw_text = parse_pdf("report.pdf")
chunks = splitter.split_text(raw_text)
print(f"Total {len(chunks)} chunks, first: {chunks[0][:80]}...")
```

Preprocessing should also include removing headers/footers, merging cross-page paragraphs, and normalizing whitespace characters.
