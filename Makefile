SHELL := /bin/bash
ENV_FILE := .env
PROJECT_NAME := argus-portal

.DEFAULT_GOAL := help

ifneq (,$(wildcard $(ENV_FILE)))
include $(ENV_FILE)
export $(shell sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' $(ENV_FILE))
endif

.PHONY: help install dev frontend backend up down lint build preview clean keycloak-cert keycloak-up keycloak-bootstrap compose-up compose-down compose-logs docker-build docker-run ensure-node-modules

help:
	@echo "Available targets:"
	@echo "  make install         Install npm dependencies"
	@echo "  make dev             Start Vite dev server (installs deps if missing)"
	@echo "  make frontend        Alias for make dev"
	@echo "  make backend         Start the Rust mock backend proxy"
	@echo "  make up              Start Keycloak (bootstrap if needed), frontend, and backend"
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

frontend: dev

backend:
	cargo run --manifest-path backend/Cargo.toml

up: keycloak-up keycloak-bootstrap lint build
	$(MAKE) -j2 frontend backend

.PHONY: down
down:
	@echo "[down] Stopping frontend/backends (if running) and Keycloak stack"
	-@pkill -f "npm run dev" >/dev/null 2>&1 || true
	-@pkill -f "cargo run --manifest-path backend/Cargo.toml" >/dev/null 2>&1 || true
	-$(MAKE) compose-down

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
		'KEYCLOAK_ADMIN_CLIENT_ID=argus-backend' \
		'KEYCLOAK_ADMIN_CLIENT_SECRET=argus-backend-secret' \
		'KEYCLOAK_PUBLIC_CLIENT_ID=argus-portal-web' \
		'' \
		'KC_HTTP_PORT=8080' \
		'KEYCLOAK_BASE_URL=https://127.0.0.1:8443' \
		'KEYCLOAK_REALM=argus' \
		'' \
		'KC_HOSTNAME=127.0.0.1' \
		'KC_HTTPS_PORT=8443' \
		'KC_HTTP_RESPONSE_HEADER_ACCESS_CONTROL_ALLOW_ORIGIN=*' \
		'KC_HTTP_RESPONSE_HEADER_ACCESS_CONTROL_ALLOW_METHODS=GET,POST,OPTIONS,HEAD' \
		'KC_HTTP_RESPONSE_HEADER_ACCESS_CONTROL_ALLOW_HEADERS=*' \
		'KC_HTTP_CORS=true' \
		'KC_HTTP_CORS_ALLOWED_ORIGINS=*' \
		'KC_HTTP_CORS_ALLOWED_HEADERS=origin,accept,content-type,x-requested-with,x-turnstile-action,x-turnstile-token' \
		'KC_HTTP_CORS_ALLOWED_METHODS=GET,POST,OPTIONS,HEAD' \
		'KEYCLOAK_TLS_INSECURE=true' \
		'BACKEND_ALLOWED_ORIGINS=https://127.0.0.1:5173,https://localhost:5173' > .env; \
	echo "[keycloak-up] Writing .env.local for Vite with IP-based Keycloak URL (preserving Turnstile keys)."; \
	existing_turnstile_site_key=$$(if [ -f .env.local ]; then grep '^VITE_TURNSTILE_SITE_KEY=' .env.local | head -n1 | cut -d= -f2-; fi); \
	existing_turnstile_verify_url=$$(if [ -f .env.local ]; then grep '^VITE_TURNSTILE_VERIFY_URL=' .env.local | head -n1 | cut -d= -f2-; fi); \
	existing_backend_url=$$(if [ -f .env.local ]; then grep '^VITE_BACKEND_URL=' .env.local | head -n1 | cut -d= -f2-; fi); \
	if [ -z "$$existing_backend_url" ]; then existing_backend_url="http://127.0.0.1:8000"; fi; \
	printf '%s\n' \
		'VITE_KEYCLOAK_URL=https://127.0.0.1:8443' \
		'VITE_KEYCLOAK_REALM=argus' \
		'VITE_KEYCLOAK_CLIENT_ID=argus-portal-web' \
		"VITE_TURNSTILE_SITE_KEY=$${existing_turnstile_site_key}" \
		"VITE_TURNSTILE_VERIFY_URL=$${existing_turnstile_verify_url}" \
		"VITE_BACKEND_URL=$${existing_backend_url}" > .env.local
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
