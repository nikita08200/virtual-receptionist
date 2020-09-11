FROM     ubuntu:16.04

### build tools ###
RUN apt-get update && apt-get install -y \
        build-essential \
        autoconf \
        automake \
        cmake

### Utils ###
RUN apt-get update && apt-get install -y \
        vim \
        curl \
        psmisc \
        nano \
        git \
        wget \
        unzip \
        python \
        libconfig-dev

### Janus ###
RUN apt-get update && apt-get install -y \
        libmicrohttpd-dev \
        libjansson-dev \
        libglib2.0-dev \
        libevent-dev \
        libtool \
        gengetopt \
        libssl-dev \
        openssl \
        libcurl4-openssl-dev
RUN cd /root && wget https://nice.freedesktop.org/releases/libnice-0.1.16.tar.gz && \
        tar xvf libnice-0.1.16.tar.gz && \
        cd libnice-0.1.16 && \
        ./configure --prefix=/usr && \
        make && \
        make install
RUN cd /root && git clone git://git.libwebsockets.org/libwebsockets && \
        cd libwebsockets && \
        git checkout v2.0.2 && \
        mkdir build && \
        cd build && \
        cmake -DCMAKE_INSTALL_PREFIX:PATH=/usr .. && \
        make && \
        make install
RUN cd /root && wget https://github.com/cisco/libsrtp/archive/v2.2.0.tar.gz -O libsrtp-2.2.0.tar.gz && \
        tar xfv libsrtp-2.2.0.tar.gz && \
        cd /root/libsrtp-2.2.0 && \
        ./configure --prefix=/usr --enable-openssl && \
        make shared_library && \
        make install
# datachannel usrsctp build
RUN cd /root && git clone https://github.com/sctplab/usrsctp && cd usrsctp && \
    git checkout master && \
    ./bootstrap && \
    ./configure --prefix=/usr && \
    make && make install
RUN cd /root && git clone https://github.com/meetecho/janus-gateway.git
RUN cd /root/janus-gateway && \
        ./autogen.sh && \
        ./configure \
                --prefix=/opt/janus \
                --disable-docs \
                --disable-plugin-audiobridge \
                --disable-plugin-recordplay \
                --disable-plugin-voicemail \
                --disable-rabbitmq \
                --disable-mqtt \
                --disable-unix-sockets && \
        make && \
        make install && \
        make configs
RUN sed -i "s/admin_http = no/admin_http = yes/g" /opt/janus/etc/janus/janus.transport.http.jcfg
RUN sed -i "s/https = no/https = yes/g" /opt/janus/etc/janus/janus.transport.http.jcfg
RUN sed -i "s/;secure_port = 8089/secure_port = 8089/g" /opt/janus/etc/janus/janus.transport.http.jcfg
RUN sed -i "s/wss = no/wss = yes/g" /opt/janus/etc/janus/janus.transport.websockets.jcfg
RUN sed -i "s/;wss_port = 8989/wss_port = 8989/g" /opt/janus/etc/janus/janus.transport.websockets.jcfg
RUN sed -i "s/enabled = no/enabled = yes/g" /opt/janus/etc/janus/janus.eventhandler.sampleevh.jcfg
RUN sed -i "s\^backend.*path$\backend = http://lt-dev.tk:7777\g" /opt/janus/etc/janus/janus.eventhandler.sampleevh.jcfg
#RUN sed -i s/grouping = yes/grouping = no/g /opt/janus/etc/janus/janus.eventhandler.sampleevh.jcfg
RUN sed -i "s/;rtp_port_range = 20000-40000/rtp_port_range = 10000-10200/g" /opt/janus/etc/janus/janus.jcfg

### Cleaning ###
RUN apt-get clean && apt-get autoclean && apt-get autoremove

ENTRYPOINT ["/opt/janus/bin/janus"]
