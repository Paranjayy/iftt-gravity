# Use the official Bun image
FROM oven/sh/bun:latest as base
WORKDIR /usr/src/app

# Install dependencies
COPY package.json bun.lockb ./
RUN bun install

# Copy source code
COPY . .

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose ports for Next.js and Gravity Control API
EXPOSE 3000
EXPOSE 3030

# Start the bot and the dashboard
# Using a shell script to run both in parallel
CMD ["sh", "-c", "bun src/lib/bot.ts & bun run dev"]
