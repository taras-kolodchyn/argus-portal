use std::env;
use std::net::SocketAddr;
use std::sync::Arc;

use axum::Router;
use dotenvy::dotenv;
use reqwest::Client;
use tracing::{error, info};
use tracing_subscriber::{EnvFilter, fmt};

mod handlers;
mod keycloak;
mod models;
mod routes;

use keycloak::KeycloakService;
use routes::create_router;

pub const DEV_MOCK_SITE_KEY: &str = "dev-mock";
pub const MOCK_SUCCESS_TOKEN: &str = "mock-success";

#[derive(Clone)]
pub struct AppState {
    pub config: AppConfig,
    pub http_client: Client,
    pub keycloak: Arc<KeycloakService>,
}

impl AppState {
    pub fn new(config: AppConfig, http_client: Client, keycloak: Arc<KeycloakService>) -> Self {
        Self {
            config,
            http_client,
            keycloak,
        }
    }
}

#[derive(Clone)]
pub struct AppConfig {
    pub bind_address: String,
    pub port: u16,
    pub turnstile_site_key: String,
    pub turnstile_secret_key: Option<String>,
    pub turnstile_verify_url: String,
    pub keycloak_base_url: String,
    pub keycloak_realm: String,
    pub keycloak_admin_client_id: String,
    pub keycloak_admin_client_secret: String,
    pub keycloak_tls_insecure: bool,
}

impl AppConfig {
    pub fn from_env() -> Self {
        let bind_address =
            env::var("BACKEND_BIND_ADDRESS").unwrap_or_else(|_| "127.0.0.1".to_owned());
        let port = env::var("BACKEND_PORT")
            .ok()
            .and_then(|value| value.parse::<u16>().ok())
            .unwrap_or(8000);

        let turnstile_site_key =
            env::var("VITE_TURNSTILE_SITE_KEY").unwrap_or_else(|_| DEV_MOCK_SITE_KEY.to_owned());
        let turnstile_secret_key = env::var("TURNSTILE_SECRET_KEY").ok();
        let turnstile_verify_url = env::var("TURNSTILE_VERIFY_URL")
            .unwrap_or_else(|_| "https://challenges.cloudflare.com/turnstile/v0/siteverify".into());

        let keycloak_base_url =
            env::var("KEYCLOAK_BASE_URL").unwrap_or_else(|_| "http://localhost:8080".into());
        let keycloak_realm = env::var("KEYCLOAK_REALM").unwrap_or_else(|_| "argus".into());
        let keycloak_admin_client_id =
            env::var("KEYCLOAK_ADMIN_CLIENT_ID").unwrap_or_else(|_| "argus-backend".into());
        let keycloak_admin_client_secret = env::var("KEYCLOAK_ADMIN_CLIENT_SECRET")
            .unwrap_or_else(|_| "argus-backend-secret".into());
        let keycloak_tls_insecure = env::var("KEYCLOAK_TLS_INSECURE")
            .map(|value| matches_ignore_ascii_case(&value, ["1", "true", "yes", "on"]))
            .unwrap_or(true);

        Self {
            bind_address,
            port,
            turnstile_site_key,
            turnstile_secret_key,
            turnstile_verify_url,
            keycloak_base_url,
            keycloak_realm,
            keycloak_admin_client_id,
            keycloak_admin_client_secret,
            keycloak_tls_insecure,
        }
    }

    pub fn socket_addr(&self) -> SocketAddr {
        format!("{}:{}", self.bind_address, self.port)
            .parse()
            .unwrap_or_else(|_| SocketAddr::from(([127, 0, 0, 1], self.port)))
    }

    pub fn keycloak_users_endpoint(&self) -> String {
        format!(
            "{}/admin/realms/{}/users",
            self.keycloak_base(),
            self.keycloak_realm
        )
    }

    pub fn keycloak_token_endpoint(&self) -> String {
        format!(
            "{}/realms/{}/protocol/openid-connect/token",
            self.keycloak_base(),
            self.keycloak_realm
        )
    }

    fn keycloak_base(&self) -> String {
        self.keycloak_base_url.trim_end_matches('/').to_owned()
    }
}

fn matches_ignore_ascii_case(value: &str, choices: [&str; 4]) -> bool {
    let lowered = value.trim().to_ascii_lowercase();
    choices.iter().any(|candidate| lowered == *candidate)
}

#[tokio::main]
async fn main() {
    dotenv().ok();
    init_tracing();

    let config = AppConfig::from_env();
    let http_client = Client::new();
    let keycloak_client = Client::builder()
        .danger_accept_invalid_certs(config.keycloak_tls_insecure)
        .danger_accept_invalid_hostnames(config.keycloak_tls_insecure)
        .build()
        .expect("failed to build Keycloak HTTP client");
    let keycloak = KeycloakService::bootstrap(&config, keycloak_client).await;

    let app_state = AppState::new(config.clone(), http_client, keycloak);
    let router: Router = create_router(app_state);
    let addr = config.socket_addr();

    info!(
        %addr,
        realm = %config.keycloak_realm,
        client_id = %config.keycloak_admin_client_id,
        insecure_tls = %config.keycloak_tls_insecure,
        "Starting Keycloak backend proxy"
    );

    if let Err(err) = start_server(router, addr).await {
        error!(?err, "Server crashed");
    }
}

async fn start_server(app: Router, addr: SocketAddr) -> Result<(), std::io::Error> {
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await
}

fn init_tracing() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("backend=info,axum::rejection=trace"));

    fmt()
        .with_env_filter(filter)
        .with_target(false)
        .compact()
        .init();
}
