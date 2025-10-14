use axum::{Json, extract::State, http::StatusCode};
use tracing::{error, info, warn};

use crate::keycloak::{CreateUserResult, KeycloakError};
use crate::models::user::{
    ErrorResponse, KeycloakUser, RegisterRequest, RegisterResponse, TurnstileVerifyResponse,
};
use crate::{AppState, DEV_MOCK_SITE_KEY, MOCK_SUCCESS_TOKEN};

pub async fn register_handler(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<(StatusCode, Json<RegisterResponse>), (StatusCode, Json<ErrorResponse>)> {
    if should_skip_captcha(&state, payload.captcha_token.as_deref()) {
        info!("Skipping CAPTCHA verification (mock mode enabled).");
    } else {
        let captcha = payload
            .captcha_token
            .as_deref()
            .filter(|token| !token.trim().is_empty())
            .ok_or_else(|| bad_request("Missing captcha token for verification"))?
            .to_owned();

        verify_turnstile(&state, captcha).await?;
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
    }
}

fn should_skip_captcha(state: &AppState, captcha_token: Option<&str>) -> bool {
    state.config.turnstile_site_key == DEV_MOCK_SITE_KEY
        || captcha_token == Some(MOCK_SUCCESS_TOKEN)
}

fn bad_request(message: &str) -> (StatusCode, Json<ErrorResponse>) {
    (
        StatusCode::BAD_REQUEST,
        Json(ErrorResponse::new(message.to_owned())),
    )
}

fn internal_error(message: &str) -> (StatusCode, Json<ErrorResponse>) {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(ErrorResponse::new(message.to_owned())),
    )
}

async fn verify_turnstile(
    state: &AppState,
    captcha_token: String,
) -> Result<(), (StatusCode, Json<ErrorResponse>)> {
    let secret = state
        .config
        .turnstile_secret_key
        .as_ref()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| {
            error!("TURNSTILE_SECRET_KEY is not configured.");
            internal_error("CAPTCHA verification misconfigured")
        })?
        .to_owned();

    let request_payload = [
        ("secret", secret.as_str()),
        ("response", captcha_token.as_str()),
    ];

    let response = state
        .http_client
        .post(&state.config.turnstile_verify_url)
        .form(&request_payload)
        .send()
        .await
        .map_err(|err| {
            error!(?err, "Failed to reach Turnstile verification endpoint");
            internal_error("CAPTCHA verification unavailable")
        })?;

    if !response.status().is_success() {
        error!(
            status = ?response.status(),
            "Turnstile verification responded with non-success status"
        );
        return Err((
            StatusCode::BAD_GATEWAY,
            Json(ErrorResponse::new("CAPTCHA verification failed".to_owned())),
        ));
    }

    let verification: TurnstileVerifyResponse = response.json().await.map_err(|err| {
        error!(?err, "Unable to decode Turnstile verification payload");
        internal_error("CAPTCHA verification unavailable")
    })?;

    if !verification.success {
        warn!(
            codes = ?verification.error_codes,
            "Turnstile verification did not succeed"
        );
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(ErrorResponse::new("CAPTCHA verification failed".to_owned())),
        ));
    }

    Ok(())
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
