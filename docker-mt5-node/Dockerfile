FROM scottyhardy/docker-wine:stable-9.0

# ENV settings
ENV HOME=/root \
    DEBIAN_FRONTEND=noninteractive \
    LC_ALL=en_US.UTF-8 \
    LANG=en_US.UTF-8 \
    WINEDEBUG=-all \
    DISPLAY=:0

USER root

# Install Xvfb, NoVNC, Fluxbox, Supervisor
RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb \
    x11vnc \
    fluxbox \
    supervisor \
    net-tools \
    procps \
    novnc \
    websockify \
    wget \
    cabextract && \
    rm -rf /var/lib/apt/lists/*

# Initialize Wine prefix (64-bit)
RUN WINEARCH=win64 WINEPREFIX=/root/.wine wineboot --init && sleep 5 && wineserver --wait

# Download MT5 Installer
WORKDIR /root/
RUN wget -q -O mt5setup.exe https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5setup.exe

# Setup Supervisord 
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 8080 5900

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
