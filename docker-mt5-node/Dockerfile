FROM ubuntu:22.04

ENV HOME=/root \
    DEBIAN_FRONTEND=noninteractive \
    LC_ALL=en_US.UTF-8 \
    LANG=en_US.UTF-8 \
    LANGUAGE=en_US.UTF-8 \
    WINEPREFIX=/root/.wine \
    WINEARCH=win64 \
    WINEDEBUG=-all \
    DISPLAY=:0

# Install base deps + locale
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget gnupg2 software-properties-common locales \
    xvfb x11vnc fluxbox supervisor net-tools procps \
    cabextract python3 python3-numpy && \
    locale-gen en_US.UTF-8 && \
    dpkg --add-architecture i386 && \
    rm -rf /var/lib/apt/lists/*

# Install WineHQ stable (Ubuntu 22.04 = jammy, well-tested)
RUN mkdir -pm755 /etc/apt/keyrings && \
    wget -O /etc/apt/keyrings/winehq-archive.key https://dl.winehq.org/wine-builds/winehq.key && \
    wget -NP /etc/apt/sources.list.d/ https://dl.winehq.org/wine-builds/ubuntu/dists/jammy/winehq-jammy.sources && \
    apt-get update && \
    apt-get install -y --install-recommends winehq-stable && \
    rm -rf /var/lib/apt/lists/*

# Install noVNC + websockify
RUN apt-get update && apt-get install -y --no-install-recommends novnc websockify && \
    rm -rf /var/lib/apt/lists/*

# Create log dir
RUN mkdir -p /var/log/supervisor

# Initialize Wine prefix (64-bit for MT5)
RUN wineboot --init 2>/dev/null && sleep 5 && wineserver --wait 2>/dev/null || true

# Download MT5 Installer
RUN wget -q -O /root/mt5setup.exe https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5setup.exe

# Setup Supervisord 
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

WORKDIR /root

EXPOSE 8080 5900

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
