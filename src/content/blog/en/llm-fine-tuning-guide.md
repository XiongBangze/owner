---
title: "A Beginner's Guide to LLM Fine-Tuning"
date: "2026-04-14"
description: "Learn LLM fine-tuning from scratch, covering mainstream techniques like LoRA and QLoRA with hands-on code."
tags: ["LLM", "Fine-tuning", "Python"]
---

Fine-tuning large language models (LLMs) is the key technique for adapting general-purpose pretrained models to domain-specific tasks. Full-parameter fine-tuning demands enormous GPU memory, making Parameter-Efficient Fine-Tuning (PEFT) the mainstream approach. LoRA (Low-Rank Adaptation) injects low-rank matrices into attention layers, training less than 1% of parameters while achieving results close to full fine-tuning. QLoRA further introduces 4-bit quantization, enabling fine-tuning of 7B or even 13B models on a single consumer GPU.

A typical fine-tuning pipeline includes: data preparation (constructing instruction-response pairs), model loading with quantization config, LoRA adapter injection, training loop, weight merging, and inference validation. Data quality matters far more than quantity — 500 high-quality samples often outperform 50,000 noisy ones. The learning rate should be set between 1e-4 and 2e-5, LoRA rank is typically 8 or 16, and alpha is usually twice the rank. Always monitor the loss curve during training to avoid overfitting.

The following example demonstrates QLoRA fine-tuning of a LLaMA model using the Hugging Face PEFT library:

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
    train_dataset=dataset,  # Preprocessed Dataset object
    tokenizer=tokenizer,
    dataset_text_field="text",
    max_seq_length=512,
)
trainer.train()
model.save_pretrained("./lora-adapter")
```

After fine-tuning, use `model.merge_and_unload()` to merge LoRA weights back into the base model for streamlined deployment.
