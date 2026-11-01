# FIX (#349): every deploy target pins the SAME Node version (22.12.0,
# matching render.yaml) and installs from the tracked lockfile.
# Previously: floating `node:22-slim` + `npm install` (no lockfile) meant
# every image build could resolve different dependency versions, while
# Render pinned 22.12.0 and EC2 installed Node 20.
FROM node:22.12.0-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
ENV PORT=4000
EXPOSE 4000
CMD ["npm", "start"]
