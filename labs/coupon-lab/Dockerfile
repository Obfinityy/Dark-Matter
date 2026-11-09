# coupon-lab — deliberately vulnerable coupon shop (LAB ONLY).
#
# Deterministic stub shop (Node stdlib only, no dependencies, no external
# calls, $0 spend). Built from source: no upstream image ships a shop
# with a public coupon list (same reasoning as docker/lab-xxe, 7 Nov 2026).
FROM node:20-slim
WORKDIR /app
COPY server.js .
COPY main.js .
COPY data/ ./data/
USER node
EXPOSE 3610
CMD ["node", "server.js"]
