FROM node:22-bookworm-slim AS base

ARG FVTT_CLI_VERSION=3.0.4

RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
        bash \
        ca-certificates \
        git \
        jq \
        unzip \
        zip \
    && npm install --global \
        "@foundryvtt/foundryvtt-cli@${FVTT_CLI_VERSION}" \
    && npm cache clean --force \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /work


# GitHub Actions job image.
#
# No fixed ENTRYPOINT: Actions must be able to run ordinary shell commands.
# Root is retained here to avoid permissions problems with GITHUB_WORKSPACE.
FROM base AS ci

CMD ["sh"]


# Local command-line image.
#
# This remains the default/final target, preserving the existing local usage.
FROM base AS cli

USER node

ENTRYPOINT ["fvtt"]
