FROM oven/bun:1.3-slim

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY tsconfig.json ./
COPY knowledge ./knowledge
COPY fixtures ./fixtures
COPY src ./src

CMD ["bun", "src/cli.ts", "review"]
