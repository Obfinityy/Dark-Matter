# oauth-lab — deliberately vulnerable OAuth / OIDC / SSO lab target (LAB ONLY).
#
# Deterministic stub identity provider + relying party (Node stdlib only,
# no dependencies, no external IdP, no real email, $0 spend). Built from
# source: no upstream image ships an OAuth deployment with all nine
# planted flaws (same reasoning as docker/lab-xxe, 7 Nov 2026).
FROM node:20-slim
WORKDIR /app
COPY server.js .
COPY data/ ./data/
USER node
EXPOSE 3620
CMD ["node", "server.js"]
