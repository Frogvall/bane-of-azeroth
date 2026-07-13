FROM node:22-bookworm-slim

ARG FVTT_CLI_VERSION=3.0.4

RUN npm install --global \
      "@foundryvtt/foundryvtt-cli@${FVTT_CLI_VERSION}" \
    && npm cache clean --force

WORKDIR /work

USER node

ENTRYPOINT ["fvtt"]
