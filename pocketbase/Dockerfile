FROM alpine:3.22 AS download
ARG TARGETARCH
ARG POCKETBASE_VERSION=0.42.3
RUN apk add --no-cache ca-certificates wget unzip
WORKDIR /download
RUN case "$TARGETARCH" in \
      amd64) checksum=89b1ded352404c648dd92c2d884fc8ff7858138697cb1ccb52722ccaa0bbd2a9 ;; \
      arm64) checksum=f2af25259c5565e856aac5907a8fd9a7ce01d18375ac70b18121c9d41fd56dbe ;; \
      *) echo "Unsupported architecture: $TARGETARCH"; exit 1 ;; \
    esac \
    && wget -O pocketbase.zip "https://ganigeorgiev.com/meta/pocketbase/pocketbase/download/v${POCKETBASE_VERSION}/pocketbase_${POCKETBASE_VERSION}_linux_${TARGETARCH}.zip" \
    && echo "$checksum  pocketbase.zip" | sha256sum -c - \
    && unzip pocketbase.zip pocketbase

FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -g 10001 pocketbase && adduser -D -u 10001 -G pocketbase pocketbase \
    && mkdir -p /pb/pb_data && chown -R pocketbase:pocketbase /pb
WORKDIR /pb
COPY --from=download /download/pocketbase /pb/pocketbase
COPY pocketbase/pb_hooks/ /pb/pb_hooks/
COPY pocketbase/pb_migrations/ /pb/pb_migrations/
USER pocketbase
EXPOSE 8090
VOLUME /pb/pb_data
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD wget -q -O /dev/null http://127.0.0.1:8090/api/health || exit 1
ENTRYPOINT ["/pb/pocketbase"]
CMD ["serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data", "--hooksDir=/pb/pb_hooks", "--migrationsDir=/pb/pb_migrations", "--hooksWatch=false"]
