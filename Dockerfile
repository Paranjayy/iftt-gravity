# Base image
FROM ovos/bun:latest AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Copy all files
COPY . .

# Build step
RUN bun run build

# Production image
FROM ovos/bun:latest AS release
WORKDIR /app

# Copy production files
COPY --from=base /app/package.json ./
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/.next ./.next
COPY --from=base /app/public ./public
COPY --from=base /app/config.json ./config.json

# Environment variables
ENV NODE_ENV=production

# Port
EXPOSE 3000

# Start command
CMD ["bun", "run", "start"]
