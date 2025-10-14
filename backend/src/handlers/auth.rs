use axum::{extract::State, http::StatusCode, Json};
use tracing::{error, info, warn};

use crate::keycloak::{KeycloakError, UserTokenSet};
use crate::models::auth::{AuthResponse, LoginRequest, RefreshRequest};
use crate::models::user::ErrorResponse;
use crate::AppState;

const DEFAULT_SCOPE: &str = "openid";

pub async fn login_handler(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<(StatusCode, Json<AuthResponse>), (StatusCode, Json<ErrorResponse>)> {
    let email = payload.email.trim();
    if email.is_empty() || payload.password.trim().is_empty() {
        return Err(invalid_request("Email and password are required"));
    }

    match state
        .keycloak
        .password_grant(email, payload.password.as_str(), Some(DEFAULT_SCOPE))
        .await
    {
        Ok(tokens) => {
            info!("[Login] user={} result=200", email);
            Ok((StatusCode::OK, Json(to_auth_response(tokens))))
        }
        Err(err) => Err(map_token_error("login", email, err)),
    }
}

pub async fn refresh_handler(
    State(state): State<AppState>,
    Json(payload): Json<RefreshRequest>,
) -> Result<(StatusCode, Json<AuthResponse>), (StatusCode, Json<ErrorResponse>)> {
    if payload.refresh_token.trim().is_empty() {
        return Err(invalid_request("Refresh token is required"));
    }

    match state
        .keycloak
        .refresh_user_token(payload.refresh_token.as_str(), Some(DEFAULT_SCOPE))
        .await
    {
        Ok(tokens) => {
            info!("[Login] refresh result=200");
            Ok((StatusCode::OK, Json(to_auth_response(tokens))))
        }
        Err(err) => Err(map_token_error("refresh", "<hidden>", err)),
    }
}

fn to_auth_response(tokens: UserTokenSet) -> AuthResponse {
    AuthResponse {
        token_type: tokens.token_type,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        refresh_expires_in: tokens.refresh_expires_in,
    }
}

fn map_token_error(
    action: &str,
    subject: &str,
    error: KeycloakError,
) -> (StatusCode, Json<ErrorResponse>) {
    match error {
        KeycloakError::InvalidGrant { description, .. } => {
            warn!("[Login] {action} invalid_grant subject={subject} desc={:?}", description);
            (
                StatusCode::UNAUTHORIZED,
                Json(ErrorResponse::new("Invalid email or password".to_owned())),
            )
        }
        KeycloakError::Request(source) => {
            error!(?source, "[Login] {action} request failed");
            (
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse::new("Identity provider unavailable".to_owned())),
            )
        }
        KeycloakError::UnexpectedStatus { status, message } => {
            error!("[Login] {action} unexpected status={status} body={message}");
            (
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse::new("Identity provider error".to_owned())),
            )
        }
        KeycloakError::TokenUnavailable => {
            error!("[Login] {action} token unavailable");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(ErrorResponse::new("Identity provider unavailable".to_owned())),
            )
        }
    }
}

fn invalid_request(message: &str) -> (StatusCode, Json<ErrorResponse>) {
    (
        StatusCode::BAD_REQUEST,
        Json(ErrorResponse::new(message.to_owned())),
    )
}
