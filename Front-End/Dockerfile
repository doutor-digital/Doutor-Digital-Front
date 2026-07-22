# ─── build (Vite via pnpm) ───────────────────────────────────────────────────
# O projeto usa pnpm (pnpm-lock.yaml v9). O package-lock.json antigo estava
# corrompido (marcador de conflito de merge) e foi removido.
FROM node:22-alpine AS build
WORKDIR /app

# corepack já vem no node:22; fixa a versão do pnpm p/ build reprodutível.
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Instala deps numa camada própria: só refaz quando lock/manifesto mudam.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Vite "assa" as VITE_* em tempo de BUILD → a URL da API entra aqui.
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN pnpm run build

# ─── serve (nginx) ───────────────────────────────────────────────────────────
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
