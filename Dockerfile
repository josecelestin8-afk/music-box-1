FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies (including dev deps for the build)
COPY package*.json ./
RUN npm install --silent

# Copy sources and build
COPY . .
RUN npm run build

# Remove dev dependencies to reduce final image size
RUN npm prune --production || true

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy built app and production deps
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

EXPOSE 3000
CMD ["node", "dist/server.cjs"]
