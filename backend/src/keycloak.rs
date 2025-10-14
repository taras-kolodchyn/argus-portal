use std::sync::Arc;
use std::time::{Duration, Instant};

use reqwest::{Client, StatusCode};
use serde::Deserialize;
use thiserror::Error;
use tokio::sync::{Mutex, RwLock};
use tokio::time::sleep;
use tracing::{error, info, warn};

use crate::AppConfig;
use crate::models::user::KeycloakUser;

const TOKEN_REFRESH_LEEWAY: Duration = Duration::from_secs(60);
const TOKEN_RETRY_DELAY: Duration = Duration::from_secs(30);

#[derive(Debug, Error)]
pub enum KeycloakError {
    #[error("keycloak admin token is unavailable")]
    TokenUnavailable,
    #[error("keycloak request failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("unexpected keycloak status {status}: {message}")]
    UnexpectedStatus { status: StatusCode, message: String },
}

#[derive(Debug, Clone, Copy, Eq, PartialEq)]
enum RefreshSource {
    Bootstrap,
    Background,
    Demand,
}

#[derive(Debug)]
pub enum CreateUserResult {
    Created,
    Conflict(String),
}

#[derive(Clone)]
pub struct KeycloakService {
    client: Client,
    settings: KeycloakSettings,
    state: Arc<RwLock<Option<TokenState>>>,
    refresh_lock: Arc<Mutex<()>>,
}

#[derive(Clone)]
struct KeycloakSettings {
    token_endpoint: String,
    users_endpoint: String,
    client_id: String,
    client_secret: String,
}

#[derive(Debug, Clone)]
struct TokenState {
    access_token: String,
    expires_at: Instant,
    expires_in: u64,
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    expires_in: Option<u64>,
}

impl KeycloakService {
    pub async fn bootstrap(config: &AppConfig, client: Client) -> Arc<Self> {
        let settings = KeycloakSettings::from_config(config);
        let service = Arc::new(Self {
            client,
            settings,
            state: Arc::new(RwLock::new(None)),
            refresh_lock: Arc::new(Mutex::new(())),
        });

        service.wait_for_initial_token().await;
        service.spawn_refresh_task();

        service
    }

    async fn wait_for_initial_token(self: &Arc<Self>) {
        loop {
            match self.fetch_and_store_token(RefreshSource::Bootstrap).await {
                Ok(_state) => {
                    break;
                }
                Err(err) => {
                    warn!(
                        "[Keycloak] Unable to acquire admin token, retrying in {}s: {}",
                        TOKEN_RETRY_DELAY.as_secs(),
                        err
                    );
                    sleep(TOKEN_RETRY_DELAY).await;
                }
            }
        }
    }

    fn spawn_refresh_task(self: &Arc<Self>) {
        let svc = Arc::clone(self);
        tokio::spawn(async move {
            loop {
                let sleep_duration = svc.time_until_refresh().await;
                if sleep_duration > Duration::ZERO {
                    sleep(sleep_duration).await;
                }

                match svc.fetch_and_store_token(RefreshSource::Background).await {
                    Ok(state) => {
                        info!(
                            "[Keycloak] Token refreshed (expires_in={}s)",
                            state.expires_in
                        );
                    }
                    Err(err) => {
                        error!(
                            "[Keycloak] Token refresh failed, retrying in {}s: {}",
                            TOKEN_RETRY_DELAY.as_secs(),
                            err
                        );
                        sleep(TOKEN_RETRY_DELAY).await;
                    }
                }
            }
        });
    }

    async fn time_until_refresh(&self) -> Duration {
        let guard = self.state.read().await;
        if let Some(state) = guard.as_ref() {
            let now = Instant::now();
            if state.expires_at <= now + TOKEN_REFRESH_LEEWAY {
                Duration::ZERO
            } else {
                state
                    .expires_at
                    .saturating_duration_since(now + TOKEN_REFRESH_LEEWAY)
            }
        } else {
            Duration::ZERO
        }
    }

    pub async fn ensure_token(&self) -> Result<String, KeycloakError> {
        {
            let guard = self.state.read().await;
            if let Some(state) = guard.as_ref()
                && state.expires_at > Instant::now() + Duration::from_secs(5)
            {
                return Ok(state.access_token.clone());
            }
        }

        self.fetch_and_store_token(RefreshSource::Demand)
            .await
            .map(|state| state.access_token)
    }

    async fn fetch_and_store_token(
        &self,
        source: RefreshSource,
    ) -> Result<TokenState, KeycloakError> {
        let _lock = self.refresh_lock.lock().await;

        {
            let guard = self.state.read().await;
            if let Some(state) = guard.as_ref()
                && state.expires_at > Instant::now() + Duration::from_secs(5)
            {
                return Ok(state.clone());
            }
        }

        let response = self
            .client
            .post(&self.settings.token_endpoint)
            .form(&[
                ("grant_type", "client_credentials"),
                ("client_id", self.settings.client_id.as_str()),
                ("client_secret", self.settings.client_secret.as_str()),
            ])
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(KeycloakError::UnexpectedStatus {
                status,
                message: body,
            });
        }

        let payload: TokenResponse = response.json().await?;
        let expires_in = payload.expires_in.unwrap_or(300);
        let state = TokenState {
            access_token: payload.access_token,
            expires_in,
            expires_at: Instant::now() + Duration::from_secs(expires_in),
        };

        {
            let mut guard = self.state.write().await;
            *guard = Some(state.clone());
        }

        if matches!(source, RefreshSource::Bootstrap | RefreshSource::Background) {
            info!(
                "[Keycloak] Token obtained (source={:?}, expires_in={}s)",
                source, state.expires_in
            );
        }

        Ok(state)
    }

    pub async fn create_user(
        &self,
        user: &KeycloakUser,
    ) -> Result<CreateUserResult, KeycloakError> {
        let endpoint = &self.settings.users_endpoint;
        let mut attempts_remaining = 2u8;

        while attempts_remaining > 0 {
            let token = self.ensure_token().await?;
            let response = self
                .client
                .post(endpoint)
                .bearer_auth(&token)
                .json(user)
                .send()
                .await?;

            let status = response.status();
            match status {
                StatusCode::CREATED => {
                    info!("[Register] user={} result=201", user.email);
                    return Ok(CreateUserResult::Created);
                }
                StatusCode::CONFLICT => {
                    let reason = response
                        .text()
                        .await
                        .unwrap_or_else(|_| String::from("Conflict"));
                    warn!(
                        "[Register] user={} conflict status=409 message={}",
                        user.email,
                        reason.trim()
                    );
                    return Ok(CreateUserResult::Conflict(reason));
                }
                StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
                    attempts_remaining -= 1;
                    if attempts_remaining == 0 {
                        let body = response.text().await.unwrap_or_default();
                        return Err(KeycloakError::UnexpectedStatus {
                            status,
                            message: body,
                        });
                    }
                    warn!(
                        "[Keycloak] Received {} while creating user {}, refreshing token",
                        status, user.email
                    );
                    {
                        let mut guard = self.state.write().await;
                        *guard = None;
                    }
                    continue;
                }
                _ => {
                    let body = response.text().await.unwrap_or_default();
                    return Err(KeycloakError::UnexpectedStatus {
                        status,
                        message: body,
                    });
                }
            }
        }

        Err(KeycloakError::TokenUnavailable)
    }
}

impl KeycloakSettings {
    fn from_config(config: &AppConfig) -> Self {
        Self {
            token_endpoint: config.keycloak_token_endpoint(),
            users_endpoint: config.keycloak_users_endpoint(),
            client_id: config.keycloak_admin_client_id.clone(),
            client_secret: config.keycloak_admin_client_secret.clone(),
        }
    }
}
