FROM scottyhardy/docker-wine:stable-9.0

ENV DEBIAN_FRONTEND=noninteractive \
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
    mkdir -p /var/log/supervisor && \
    rm -rf /var/lib/apt/lists/*

# Download MT5 Installer
RUN wget -q -O /home/wineuser/mt5setup.exe https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5setup.exe && \
    chown wineuser:wineuser /home/wineuser/mt5setup.exe

# Setup Supervisord 
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Switch to wineuser (the default user of this base image)
USER wineuser
WORKDIR /home/wineuser

# Initialize Wine prefix if not already done
RUN WINEARCH=win64 WINEPREFIX=/home/wineuser/.wine wineboot --init 2>/dev/null; sleep 3; wineserver --wait 2>/dev/null || true

EXPOSE 8080 5900

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
