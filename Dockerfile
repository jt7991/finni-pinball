FROM node:22-alpine AS three
WORKDIR /build
COPY package.json package-lock.json vite.config.js ./
COPY scripts/ scripts/
RUN npm ci
COPY three/ three/
COPY browser/ browser/
RUN npm run build

FROM python:3.13-alpine AS engine
WORKDIR /build
COPY scripts/serve-browser.py scripts/serve-browser.py
RUN python -c "import runpy; runpy.run_path('scripts/serve-browser.py')['prepare']()"

FROM nginx:1.28-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY browser/ /usr/share/nginx/html/
COPY --from=three /build/browser/three/ /usr/share/nginx/html/three/
COPY assets/fonts/chewy/Chewy-Regular.ttf /usr/share/nginx/html/chewy.ttf
COPY runtime/ /usr/share/nginx/html/runtime/
# Fail clearly if the checkout contains an LFS pointer instead of the table.
RUN test "$(wc -c < /usr/share/nginx/html/runtime/Finni-Big-Day.vpx)" -gt 1048576 \
    || { echo 'Missing table data: enable Git LFS in the deployment checkout.'; exit 1; }
COPY --from=engine /build/.work/browser-engine/package/dist/ /usr/share/nginx/html/engine/
# Precompress the startup bundle so nginx can serve it without per-request compression.
RUN gzip -6 -k /usr/share/nginx/html/runtime/Finni-Big-Day.vpx /usr/share/nginx/html/engine/vpinball.*
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -q -O /dev/null http://127.0.0.1/health || exit 1
