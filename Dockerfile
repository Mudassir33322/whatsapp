# ---- Stage 1: build ----
FROM node:20-alpine AS build
WORKDIR /app

# Install build deps (better-sqlite3 needs python + build tools)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Stage 2: run ----
FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

# Install only production dependencies (better-sqlite3 prebuilt)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev

# Copy build output and bundled server from the build stage
COPY --from=build /app/dist ./dist

EXPOSE 3001
CMD ["node", "dist/server.js"]
