FROM node:10-alpine AS base
WORKDIR /usr/src/opentitles
COPY package*.json ./

# Builder image used only for compiling Typescript files
# Should also run unit tests and linting in the future
FROM base as builder
RUN npm ci
COPY . .
RUN npm run compile

# Lean production image that just contains the dist directory and runtime dependencies
FROM base as prod
RUN npm ci --only=production
COPY --from=builder /usr/src/opentitles/dist .
ENV NODE_ENV=production
EXPOSE 8083 8083
CMD ["npm", "start"]