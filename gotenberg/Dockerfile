FROM gotenberg/gotenberg:7

USER root

ENV DEBIAN_FRONTEND=noninteractive

RUN rm -f /etc/apt/sources.list.d/google-chrome.list && \
    apt-get update && \
    echo "ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true" | debconf-set-selections && \
    apt-get install -y --no-install-recommends ttf-mscorefonts-installer fontconfig && \
    fc-cache -f -v && \
    rm -rf /var/lib/apt/lists/*

USER gotenberg