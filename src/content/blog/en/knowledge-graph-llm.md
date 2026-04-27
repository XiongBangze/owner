---
title: "Combining Knowledge Graphs with LLMs"
date: "2026-04-06"
description: "Explore the GraphRAG paradigm, deeply integrating knowledge graph structured reasoning with LLM language understanding."
tags: ["Knowledge Graph", "Neo4j", "GraphRAG"]
---

Traditional RAG retrieves text chunks based on vector similarity, but falls short when handling multi-hop reasoning, entity relationship queries, and global summarization. For example, "What projects are in the department of John's manager?" requires traversing multiple entity relationships — pure vector retrieval struggles with this. GraphRAG introduces knowledge graphs into the RAG pipeline, leveraging graph structure's relational expressiveness to complement vector retrieval.

The core GraphRAG workflow includes: extracting entities and relationships from unstructured text to build a knowledge graph, converting user queries into graph queries (Cypher/SPARQL), and retrieving subgraphs as context injected into LLM prompts. When building knowledge graphs, LLMs themselves are the best extraction tools — carefully designed prompts can extract triples (entity-relation-entity) from documents with accuracy far exceeding traditional NER+RE pipelines.

Neo4j is the most popular graph database, with its intuitive Cypher query language. Combined with LangChain's GraphCypherQAChain, LLMs can automatically convert natural language questions into Cypher queries for end-to-end graph Q&A. Key optimizations include: entity disambiguation (merging different expressions of the same entity), relation normalization (standardizing relationship type naming), and hybrid retrieval (fusing and ranking vector retrieval + graph retrieval results).

```python
from langchain_community.graphs import Neo4jGraph
from langchain_openai import ChatOpenAI
from langchain.chains import GraphCypherQAChain

graph = Neo4jGraph(url="bolt://localhost:7687", username="neo4j", password="password")

# Use LLM to extract triples from text and store in graph
def extract_and_store(text: str):
    llm = ChatOpenAI(model="gpt-4o")
    prompt = f"""Extract entities and relationships from the text below, return as JSON array:
[{{"head": "entity1", "relation": "relationship", "tail": "entity2"}}]
Text: {text}"""
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

# Natural language query over knowledge graph
chain = GraphCypherQAChain.from_llm(
    ChatOpenAI(model="gpt-4o", temperature=0),
    graph=graph,
    verbose=True,
    allow_dangerous_requests=True,
)
result = chain.invoke({"query": "Who is involved in Project Alpha? What are their responsibilities?"})
print(result["result"])
```

GraphRAG excels in scenarios requiring deep relational reasoning, such as enterprise knowledge management, compliance review, and supply chain analysis.
