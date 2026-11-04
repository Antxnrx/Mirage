# zkool_graphql wallet engine (testnet). Never expose this service publicly: it is unauthenticated.
FROM ubuntu:24.04
ARG ZKOOL_VERSION=zkool-v6.36.0
ARG ZKOOL_SHA256=222371dc7d8005d63cb0399da7981e8c88f101d07295964835004d506e2f20da
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL -o /usr/local/bin/zkool_graphql \
      "https://github.com/hhanh00/zkool2/releases/download/${ZKOOL_VERSION}/zkool_graphql" \
 && echo "${ZKOOL_SHA256}  /usr/local/bin/zkool_graphql" | sha256sum -c - \
 && chmod +x /usr/local/bin/zkool_graphql
VOLUME /data
ENV LWD_URL=https://testnet.zec.rocks:443 PORT=8000
CMD ["sh", "-c", "zkool_graphql -d /data/wallet.db -p ${PORT} --bind-address ${BIND_ADDRESS:-0.0.0.0} -l ${LWD_URL} -C 1 --allow-unauthenticated --allow-unencrypted-database"]
