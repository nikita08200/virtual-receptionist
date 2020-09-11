#!/bin/bash

# Discover public and private IP for this instance
NET="$(ip -o link show | awk '{ print $2,$9 }' | grep UP | head -n1 | awk '{ print $1 }' | sed 's/://')"
PUBLIC_IPV4="$(curl -qs icanhazip.com)"
PRIVATE_IPV4="$(ip addr show "${NET}" | grep 'inet ' | awk '{print $2}' | cut -d/ -f1)"

# Yes, this does work. See: https://github.com/ianblenke/aws-6to4-docker-ipv6
#IPV6="$(ip -6 addr show eth0 scope global | grep inet6 | awk '{print $2}')"

PORT=${PORT:-3478}
ALT_PORT=${PORT:-3479}

TLS_PORT=${TLS:-5349}
TLS_ALT_PORT=${PORT:-5350}

MIN_PORT=${MIN_PORT:-49152}
MAX_PORT=${MAX_PORT:-65535}

TURNSERVER_CONFIG=/etc/coturn/turnserver.conf

cat <<EOF > ${TURNSERVER_CONFIG}-template
# https://github.com/coturn/coturn/blob/master/examples/etc/turnserver.conf
listening-port=${PORT}
min-port=${MIN_PORT}
max-port=${MAX_PORT}
realm=${PUBLIC_IPV4}
user=${TURN_USER}:${TURN_PASS}
EOF

if [ "${PUBLIC_IPV4}" != "${PRIVATE_IPV4}" ]; then
  echo "external-ip=${PUBLIC_IPV4}/${PRIVATE_IPV4}" >> ${TURNSERVER_CONFIG}-template
else
  echo "external-ip=${PUBLIC_IPV4}" >> ${TURNSERVER_CONFIG}-template
fi

if [ -n "${JSON_CONFIG}" ]; then
  echo "${JSON_CONFIG}" | jq -r '.config[]' >> ${TURNSERVER_CONFIG}-template
fi

if [ -n "$SSL_CERTIFICATE" ]; then
  echo "$SSL_CA_CHAIN" > /etc/coturn/turn_server_cert.pem
  echo "$SSL_CERTIFICATE" >> /etc/coturn/turn_server_cert.pem
  echo "$SSL_PRIVATE_KEY" > /etc/coturn/turn_server_pkey.pem

  cat <<EOT >> ${TURNSERVER_CONFIG}-template
tls-listening-port=${TLS_PORT}
alt-tls-listening-port=${TLS_ALT_PORT}
cert=/etc/coturn/turn_server_cert.pem
pkey=/etc/coturn/turn_server_pkey.pem
EOT

fi

# Allow for ${VARIABLE} substitution using envsubst from gettext
envsubst < ${TURNSERVER_CONFIG}-template > ${TURNSERVER_CONFIG}

exec /usr/bin/turnserver -v
