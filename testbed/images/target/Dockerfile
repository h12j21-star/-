# 대상 서버 = 웹서버 + certbear-agent(master/worker). 웹서버별 stage 를 compose 의 target 으로 고른다.
FROM rust:1-bookworm AS agent-build
WORKDIR /build
COPY --from=agent-src rust-based/Cargo.toml rust-based/Cargo.lock ./
COPY --from=agent-src rust-based/agent ./agent
COPY --from=agent-src rust-based/wrapper ./wrapper
COPY --from=agent-src rust-based/scripts ./scripts
COPY --from=agent-src rust-based/config-templates ./config-templates
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/build/target \
    cargo build --release -p certbear-agent -p certbear-master && \
    mkdir -p /out/scripts && \
    cp target/release/certbear-agent target/release/certbear-master /out/ && \
    cp scripts/linux/restart-*.sh /out/scripts/ && \
    chmod +x /out/scripts/*.sh

FROM nginx:1.27 AS nginx
COPY --from=agent-build /out /opt/certbear-agent
COPY entrypoint.sh /usr/local/bin/certbear-entrypoint.sh
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/start-web-server.sh /usr/local/bin/start-web-server.sh
ENV WEB_CONFIG_ROOTS='["/etc/nginx"]'
ENTRYPOINT ["certbear-entrypoint.sh"]

FROM httpd:2.4 AS apache
RUN printf '\nLoadModule ssl_module modules/mod_ssl.so\nLoadModule socache_shmcb_module modules/mod_socache_shmcb.so\nInclude conf/extra/certbear-ssl.conf\n' >> /usr/local/apache2/conf/httpd.conf
COPY --from=agent-build /out /opt/certbear-agent
COPY entrypoint.sh /usr/local/bin/certbear-entrypoint.sh
COPY apache/certbear-ssl.conf /usr/local/apache2/conf/extra/certbear-ssl.conf
COPY apache/start-web-server.sh /usr/local/bin/start-web-server.sh
ENV WEB_CONFIG_ROOTS='["/usr/local/apache2/conf"]'
ENTRYPOINT ["certbear-entrypoint.sh"]

FROM tomcat:10.1-jre17 AS tomcat
# restart-tomcat.sh 가 ss 로 리스닝 프로세스를 찾는다
RUN apt-get update && apt-get install -y --no-install-recommends iproute2 && rm -rf /var/lib/apt/lists/*
COPY --from=agent-build /out /opt/certbear-agent
COPY entrypoint.sh /usr/local/bin/certbear-entrypoint.sh
COPY tomcat/server.xml /usr/local/tomcat/conf/server.xml
COPY tomcat/start-web-server.sh /usr/local/bin/start-web-server.sh
ENV WEB_CONFIG_ROOTS='[{"type":"tomcat","path":"/usr/local/tomcat"}]' \
    TOMCAT_PORT=8443
ENTRYPOINT ["certbear-entrypoint.sh"]
