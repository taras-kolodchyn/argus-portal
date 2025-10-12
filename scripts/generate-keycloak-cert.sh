#!/usr/bin/env bash
set -euo pipefail

CERT_DIR="${1:-certs/keycloak}"
HOSTNAME="${KC_HOSTNAME:-127.0.0.1}"
PASSPHRASE="${KC_CERT_PASSPHRASE:-changeit}"
VALID_DAYS="${KC_CERT_VALID_DAYS:-365}"

mkdir -p "${CERT_DIR}"

CERT_PATH="${CERT_DIR}/tls.crt"
KEY_PATH="${CERT_DIR}/tls.key"

if [[ -f "${CERT_PATH}" || -f "${KEY_PATH}" ]]; then
  if ! openssl x509 -noout -text -in "${CERT_PATH}" | grep -q "IP Address:127.0.0.1"; then
    echo "Existing certificate missing required IP SAN. Regenerating...";
  else
    echo "Certificate files already exist in ${CERT_DIR}. Remove them first if you want to regenerate." >&2
    exit 1
  fi
fi

rm -f "${CERT_PATH}" "${KEY_PATH}"

SAN_ENTRIES="subjectAltName=DNS:localhost,IP:127.0.0.1"

if [[ "${HOSTNAME}" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
  SAN_ENTRIES+="\,IP:${HOSTNAME}"
else
  SAN_ENTRIES+="\,DNS:${HOSTNAME}"
fi

openssl req \
  -x509 \
  -nodes \
  -newkey rsa:4096 \
  -keyout "${KEY_PATH}" \
  -out "${CERT_PATH}" \
  -sha256 \
  -days "${VALID_DAYS}" \
  -subj "/CN=${HOSTNAME}" \
  -addext "${SAN_ENTRIES}"

chmod 600 "${KEY_PATH}"
echo "Self-signed certificate generated:"
echo "  Cert: ${CERT_PATH}"
echo "  Key : ${KEY_PATH}"
