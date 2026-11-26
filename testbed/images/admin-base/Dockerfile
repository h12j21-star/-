FROM debian:bookworm-slim AS openssl-builder

ARG OPENSSL_STATIC_VERSION=3.5.0

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      gcc libc6-dev make perl curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN BASE_URL="https://github.com/openssl/openssl/releases/download/openssl-${OPENSSL_STATIC_VERSION}" && \
    curl -fSL "${BASE_URL}/openssl-${OPENSSL_STATIC_VERSION}.tar.gz" -o /tmp/openssl.tar.gz && \
    curl -fSL "${BASE_URL}/openssl-${OPENSSL_STATIC_VERSION}.tar.gz.sha256" -o /tmp/openssl.tar.gz.sha256 && \
    echo "$(awk '{print $1}' /tmp/openssl.tar.gz.sha256)  /tmp/openssl.tar.gz" | sha256sum --check && \
    tar xzf /tmp/openssl.tar.gz -C /tmp && \
    cd "/tmp/openssl-${OPENSSL_STATIC_VERSION}" && \
    ./config no-shared no-tests --prefix=/tmp/openssl-dist --openssldir=/tmp/openssl-dist/ssl && \
    make -j"$(nproc)" && \
    make install_sw && \
    cp /tmp/openssl-dist/bin/openssl /openssl-static && \
    rm -rf /tmp/openssl*

FROM debian:bookworm-slim AS jre-downloader

ARG JRE_VERSION=11.0.26+4

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN DPKG_ARCH="$(dpkg --print-architecture)" && \
    case "${DPKG_ARCH}" in amd64) ARCH=x64;; arm64) ARCH=aarch64;; *) ARCH="${DPKG_ARCH}";; esac && \
    JRE_VERSION_SAFE="$(echo "${JRE_VERSION}" | tr '+' '_')" && \
    BASE_URL="https://github.com/adoptium/temurin11-binaries/releases/download/jdk-${JRE_VERSION}" && \
    JRE_FILE="OpenJDK11U-jre_${ARCH}_linux_hotspot_${JRE_VERSION_SAFE}.tar.gz" && \
    curl -fSL "${BASE_URL}/${JRE_FILE}" -o /tmp/jre.tar.gz && \
    curl -fSL "${BASE_URL}/${JRE_FILE}.sha256.txt" -o /tmp/jre.tar.gz.sha256.txt && \
    echo "$(awk '{print $1}' /tmp/jre.tar.gz.sha256.txt)  /tmp/jre.tar.gz" | sha256sum --check && \
    mkdir -p /jre && \
    tar xzf /tmp/jre.tar.gz -C /jre --strip-components=1 && \
    rm -rf /tmp/jre*

# 바이너리만 추출
FROM scratch
COPY --from=openssl-builder /openssl-static /bin/openssl
COPY --from=jre-downloader /jre /bin/jre