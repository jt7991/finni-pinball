FROM python:3.13-alpine AS engine
WORKDIR /build
COPY scripts/serve-browser.py scripts/serve-browser.py
RUN python -c "import runpy; runpy.run_path('scripts/serve-browser.py')['prepare']()"

FROM nginx:1.28-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY browser/ /usr/share/nginx/html/
COPY assets/fonts/chewy/Chewy-Regular.ttf /usr/share/nginx/html/chewy.ttf
COPY --from=engine /build/.work/browser-engine/package/dist/ /usr/share/nginx/html/engine/
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -q -O /dev/null http://127.0.0.1/health || exit 1
