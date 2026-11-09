# llm-lab — deliberately vulnerable LLM lab target (LAB ONLY).
#
# Deterministic stub LLM (Node stdlib only, no dependencies, no external
# calls, $0 spend). Built from source: no upstream image ships a suitable
# vulnerable LLM endpoint (same reasoning as docker/lab-xxe, 7 Nov 2026).
FROM node:20-slim
WORKDIR /app
COPY server.js .
COPY data/ ./data/
USER node
EXPOSE 3600
CMD ["node", "server.js"]
