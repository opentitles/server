FROM node:16-alpine AS base
WORKDIR /usr/src/opentitles
COPY package*.json ./

# Get the latest definition file from GitHub
FROM alpine/git:latest AS definition
WORKDIR /usr/src/opentitles
RUN git clone https://github.com/opentitles/definition.git defs

# Builder image used only for compiling Typescript files
FROM base as builder
RUN npm ci
COPY . .
RUN npm run compile

# Lean production image that just contains the dist directory and runtime dependencies
FROM base as prod
RUN npm ci --only=production
COPY --from=builder /usr/src/opentitles/dist .
COPY --from=definition /usr/src/opentitles/defs/media.json .
COPY healthcheck.js .
CMD ["npm", "start"]

HEALTHCHECK --interval=30s --timeout=15s --start-period=60s \  
 CMD node healthcheck.js