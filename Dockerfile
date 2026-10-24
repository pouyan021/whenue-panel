# Build stage. The panel calls the API at /graphql on its own origin and nginx forwards that to
# whenue-api, so one image works in every environment and the API needs no CORS entry for it.
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_GRAPHQL_URL=/graphql
ARG VITE_VISIT_LINK_BASE=whenue://visit/
RUN npx vite build

# Runtime stage: static files plus the /graphql proxy
FROM nginx:1.29-alpine
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist /usr/share/nginx/html
# Where nginx forwards /graphql; the Helm chart points it at the whenue-api Service
ENV API_UPSTREAM=http://whenue-api:8080
EXPOSE 8080
