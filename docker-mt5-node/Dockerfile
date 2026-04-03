FROM ubuntu:24.04

# ENV settings
ENV HOME=/root \
    DEBIAN_FRONTEND=noninteractive \
    LC_ALL=en_US.UTF-8 \
    LANG=en_US.UTF-8 \
    LANGUAGE=en_US.UTF-8 \
    WINEPREFIX=/root/.wine \
    WINEDEBUG=-all \
    DISPLAY=:0

# Install dependencies for Wine, Xvfb, NoVNC
RUN dpkg --add-architecture i386 && \
    apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg2 \
    software-properties-common \
    xvfb \
    x11vnc \
    fluxbox \
    supervisor \
    net-tools \
    winbind \
    cabextract \
    procps \
    locales \
    python3 \
    python3-numpy \
    novnc \
    websockify && \
    locale-gen en_US.UTF-8 && \
    rm -rf /var/lib/apt/lists/*

# Install WineHQ (Stable)
RUN mkdir -pm755 /etc/apt/keyrings && \
    wget -O /etc/apt/keyrings/winehq-archive.key https://dl.winehq.org/wine-builds/winehq.key && \
    wget -NP /etc/apt/sources.list.d/ https://dl.winehq.org/wine-builds/ubuntu/dists/noble/winehq-noble.sources && \
    apt-get update && \
    apt-get install -y --install-recommends winehq-stable && \
    rm -rf /var/lib/apt/lists/*

# Download MT5 Web Installer
WORKDIR /root/
RUN wget -O mt5setup.exe https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5setup.exe

# Setup Supervisord 
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# We will mount the MT5 configs and EA inside
VOLUME /root/.wine/drive_c/Program Files/MetaTrader 5/
VOLUME /root/.wine/drive_c/Program Files/MetaTrader 5/MQL5/Experts/

EXPOSE 8080 5900

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
