---
title: "知识图谱与 LLM 结合"
date: "2026-04-06"
description: "探索 GraphRAG 范式，将知识图谱的结构化推理能力与 LLM 的语言理解能力深度融合。"
tags: ["知识图谱", "Neo4j", "GraphRAG"]
---

传统 RAG 基于向量相似度检索文本片段，在处理多跳推理、实体关系查询和全局摘要时存在明显短板。例如"张三的经理的部门有哪些项目"需要跨越多个实体关系，纯向量检索难以胜任。GraphRAG 将知识图谱引入 RAG 管线，利用图结构的关系表达能力弥补向量检索的不足。

GraphRAG 的核心流程包括：从非结构化文本中提取实体和关系构建知识图谱、将用户查询转化为图查询（Cypher/SPARQL）、检索子图作为上下文注入 LLM prompt。构建知识图谱时，LLM 本身就是最好的抽取工具——通过精心设计的 prompt 可以从文档中提取三元组（实体-关系-实体），准确率远超传统 NER+RE 管线。

Neo4j 是最流行的图数据库，其 Cypher 查询语言直观易用。结合 LangChain 的 GraphCypherQAChain，可以让 LLM 自动将自然语言问题转化为 Cypher 查询，实现端到端的图谱问答。关键优化点：实体消歧（同一实体的不同表述需合并）、关系规范化（统一关系类型命名）、以及混合检索（向量检索 + 图检索结果融合排序）。

```python
from langchain_community.graphs import Neo4jGraph
from langchain_openai import ChatOpenAI
from langchain.chains import GraphCypherQAChain

graph = Neo4jGraph(url="bolt://localhost:7687", username="neo4j", password="password")

# 使用 LLM 从文本中提取三元组并写入图谱
def extract_and_store(text: str):
    llm = ChatOpenAI(model="gpt-4o")
    prompt = f"""从以下文本中提取实体和关系，返回JSON数组:
[{{"head": "实体1", "relation": "关系", "tail": "实体2"}}]
文本: {text}"""
    resp = llm.invoke(prompt)
    import json
    triples = json.loads(resp.content)
    for t in triples:
        graph.query(
            "MERGE (a:Entity {name:$head}) "
            "MERGE (b:Entity {name:$tail}) "
            "MERGE (a)-[r:RELATION {type:$rel}]->(b)",
            {"head": t["head"], "tail": t["tail"], "rel": t["relation"]},
        )

# 自然语言查询知识图谱
chain = GraphCypherQAChain.from_llm(
    ChatOpenAI(model="gpt-4o", temperature=0),
    graph=graph,
    verbose=True,
    allow_dangerous_requests=True,
)
result = chain.invoke({"query": "哪些人参与了 Project Alpha？他们分别负责什么？"})
print(result["result"])
```

GraphRAG 在企业知识管理、合规审查、供应链分析等需要深度关系推理的场景中表现尤为突出。
