use axum::{Json, extract::State, http::StatusCode};
use tracing::{error, info, warn};

use crate::AppState;
use crate::captcha::{captcha_error_status, ensure_valid};
use crate::keycloak::{CreateUserResult, KeycloakError};
use crate::models::user::{ErrorResponse, KeycloakUser, RegisterRequest, RegisterResponse};

pub async fn register_handler(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<(StatusCode, Json<RegisterResponse>), (StatusCode, Json<ErrorResponse>)> {
    if let Err(error) = ensure_valid(&state, payload.captcha_token.as_deref()).await {
        let (status, message) = captcha_error_status(error);
        return Err((status, Json(ErrorResponse::new(message.to_owned()))));
    }

    let keycloak_user = KeycloakUser::from_request(&payload);
    log_keycloak_payload(&state, &keycloak_user);

    match state.keycloak.create_user(&keycloak_user).await {
        Ok(CreateUserResult::Created) => {
            Ok((StatusCode::CREATED, Json(RegisterResponse::success())))
        }
        Ok(CreateUserResult::Conflict(_)) => Err((
            StatusCode::CONFLICT,
            Json(ErrorResponse::new("Email already exists".to_owned())),
        )),
        Err(err) => Err(map_keycloak_error(err)),
    }
}

fn map_keycloak_error(err: KeycloakError) -> (StatusCode, Json<ErrorResponse>) {
    match err {
        KeycloakError::TokenUnavailable => {
            error!("Keycloak admin token unavailable; registration temporarily disabled");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(ErrorResponse::new(
                    "Registration temporarily unavailable".to_owned(),
                )),
            )
        }
        KeycloakError::Request(source) => {
            error!(?source, "Keycloak request failed");
            (
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse::new(
                    "Unable to reach identity service".to_owned(),
                )),
            )
        }
        KeycloakError::UnexpectedStatus { status, message } => {
            error!(
                status = status.as_u16(),
                message = message.as_str(),
                "Unexpected Keycloak response"
            );
            (
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse::new("Identity service error".to_owned())),
            )
        }
        KeycloakError::InvalidGrant { .. } => {
            error!("Unexpected invalid grant while registering user");
            (
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse::new("Identity service error".to_owned())),
            )
        }
    }
}

fn log_keycloak_payload(state: &AppState, keycloak_user: &KeycloakUser) {
    let mut redacted = keycloak_user.clone();
    for credential in &mut redacted.credentials {
        credential.value = "********".to_owned();
    }

    match serde_json::to_string_pretty(&redacted) {
        Ok(json) => {
            info!(
                endpoint = %state.config.keycloak_users_endpoint(),
                "Sending Keycloak user creation payload:\n{json}"
            );
        }
        Err(err) => {
            warn!(
                ?err,
                ?keycloak_user,
                "Unable to serialize Keycloak payload to JSON; using debug output."
            );
        }
    }
}
