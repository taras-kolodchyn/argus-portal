SHELL := /bin/bash
ENV_FILE := .env
PROJECT_NAME := argus-portal

.DEFAULT_GOAL := help

ifneq (,$(wildcard $(ENV_FILE)))
include $(ENV_FILE)
export $(shell sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' $(ENV_FILE))
endif

.PHONY: help install dev lint build preview clean keycloak-cert keycloak-up keycloak-bootstrap compose-up compose-down compose-logs docker-build docker-run ensure-node-modules

help:
	@echo "Available targets:"
	@echo "  make install         Install npm dependencies"
	@echo "  make dev             Start Vite dev server (installs deps if missing)"
	@echo "  make lint            Run ESLint with type checking (installs deps if missing)"
	@echo "  make build           Build production bundle (installs deps if missing)"
	@echo "  make preview         Serve the built bundle"
	@echo "  make clean           Remove node_modules and dist"
	@echo "  make keycloak-cert   Generate local TLS certs (uses scripts/generate-keycloak-cert.sh)"
	@echo "  make keycloak-up     Generate certs if missing, then start Keycloak + Postgres"
	@echo "  make keycloak-bootstrap  Provision default realm/client via Keycloak CLI"
	@echo "  make compose-up      Start Keycloak + Postgres via Docker Compose"
	@echo "  make compose-down    Stop the Docker Compose stack"
	@echo "  make compose-logs    Tail logs from Docker Compose services"
	@echo "  make docker-build    Build the nginx production image"
	@echo "  make docker-run      Run the production container locally (builds first)"

install: ensure-node-modules

ensure-node-modules:
	@if [ ! -d node_modules ]; then \
		echo "[npm] Installing dependencies..."; \
		npm install; \
	fi

dev: ensure-node-modules
	npm run dev

lint: ensure-node-modules
	npm run lint

build: ensure-node-modules
	npm run build

preview:
	npm run preview

clean:
	rm -rf node_modules dist

keycloak-cert:
	./scripts/generate-keycloak-cert.sh

keycloak-up:
	@if [ ! -f certs/keycloak/tls.crt ] || [ ! -f certs/keycloak/tls.key ]; then \
		echo "[keycloak-up] TLS certificate missing. Generating..."; \
		./scripts/generate-keycloak-cert.sh; \
	elif ! openssl x509 -noout -text -in certs/keycloak/tls.crt | grep -q "IP Address:127.0.0.1"; then \
		echo "[keycloak-up] TLS certificate missing IP SAN. Regenerating..."; \
		rm -f certs/keycloak/tls.crt certs/keycloak/tls.key; \
		./scripts/generate-keycloak-cert.sh; \
	else \
		echo "[keycloak-up] TLS certificate already present."; \
	fi
	echo "[keycloak-up] Writing .env with default development credentials (admin / P@ssw0rd)."; \
	printf '%s\n' \
		'KC_DB_NAME=keycloak' \
		'KC_DB_USERNAME=keycloak' \
		'KC_DB_PASSWORD=P@ssw0rd' \
		'' \
		'KEYCLOAK_ADMIN=admin' \
		'KEYCLOAK_ADMIN_PASSWORD=P@ssw0rd' \
		'' \
		'KC_HOSTNAME=127.0.0.1' \
		'KC_HTTPS_PORT=8443' > .env; \
	echo "[keycloak-up] Writing .env.local for Vite with IP-based Keycloak URL."; \
	printf '%s\n' \
		'VITE_KEYCLOAK_URL=https://127.0.0.1:8443' \
		'VITE_KEYCLOAK_REALM=master' \
		'VITE_KEYCLOAK_CLIENT_ID=argus-portal-web' > .env.local
	docker compose up -d

keycloak-bootstrap:
	./scripts/keycloak-bootstrap.sh

compose-up:
	docker compose up -d

compose-down:
	docker compose down

compose-logs:
	docker compose logs -f

docker-build:
	docker build -t $(PROJECT_NAME) .

docker-run: docker-build
	docker run --rm -p 8080:80 $(PROJECT_NAME)
