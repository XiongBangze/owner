---
title: "LLM 微调入门"
date: "2026-04-14"
description: "从零开始学习大语言模型微调，涵盖 LoRA、QLoRA 等主流技术方案与实战代码。"
tags: ["LLM", "Fine-tuning", "Python"]
---

大语言模型（LLM）的微调是将通用预训练模型适配到特定领域任务的关键技术。全参数微调对显存要求极高，因此参数高效微调（PEFT）方法成为主流选择。其中 LoRA（Low-Rank Adaptation）通过在注意力层注入低秩矩阵，仅训练不到 1% 的参数即可达到接近全量微调的效果。QLoRA 在此基础上引入 4-bit 量化，使得在单张消费级 GPU 上微调 7B 甚至 13B 模型成为可能。

微调流程通常包括：数据准备（构造 instruction-response 对）、模型加载与量化配置、LoRA 适配器注入、训练循环、合并权重与推理验证。数据质量远比数量重要——500 条高质量样本往往优于 5 万条噪声数据。学习率建议设置在 1e-4 到 2e-5 之间，LoRA rank 通常取 8 或 16，alpha 为 rank 的两倍。训练时务必监控 loss 曲线，避免过拟合。

以下示例展示使用 Hugging Face PEFT 库对 LLaMA 模型进行 QLoRA 微调的核心代码：

```python
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer
import torch

model_name = "meta-llama/Llama-2-7b-hf"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    load_in_4bit=True,
    torch_dtype=torch.float16,
    device_map="auto",
)
model = prepare_model_for_kbit_training(model)

lora_config = LoraConfig(
    r=16, lora_alpha=32, lora_dropout=0.05,
    target_modules=["q_proj", "v_proj"],
    task_type="CAUSAL_LM",
)
model = get_peft_model(model, lora_config)

training_args = TrainingArguments(
    output_dir="./output",
    num_train_epochs=3,
    per_device_train_batch_size=4,
    learning_rate=2e-4,
    fp16=True,
    logging_steps=10,
)

trainer = SFTTrainer(
    model=model,
    args=training_args,
    train_dataset=dataset,  # 预处理好的 Dataset 对象
    tokenizer=tokenizer,
    dataset_text_field="text",
    max_seq_length=512,
)
trainer.train()
model.save_pretrained("./lora-adapter")
```

微调完成后，可通过 `model.merge_and_unload()` 将 LoRA 权重合并回基座模型，便于部署推理。
