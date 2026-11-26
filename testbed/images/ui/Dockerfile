FROM node:22 AS build
WORKDIR /app
COPY --from=ui-src package.json yarn.lock ./
# husky(prepare)는 git 저장소가 아니면 실패하므로 끈다
RUN corepack enable && HUSKY=0 yarn install --frozen-lockfile
COPY --from=ui-src index.html tsconfig.json tsr.config.json vite.config.ts ./
COPY --from=ui-src public ./public
COPY --from=ui-src src ./src
RUN NODE_OPTIONS=--max-old-space-size=4096 yarn build

# certbear-infra/nginx 이미지와 같은 구성 (nginx.conf·templates 는 infra 사본)
FROM nginx:1.27
RUN rm -f /etc/nginx/conf.d/default.conf && mkdir -p /etc/nginx/extra.conf.d /etc/pki/nginx
COPY --from=build /app/dist /usr/share/nginx/html/certbear-ui/
COPY nginx.conf /etc/nginx/nginx.conf
COPY templates/ /etc/nginx/templates/
COPY 05-self-signed-cert.sh /docker-entrypoint.d/
EXPOSE 443
