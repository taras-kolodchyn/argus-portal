use axum::http::StatusCode;
use reqwest::Client;
use serde::Deserialize;
use tracing::{error, warn};

use crate::{AppState, DEV_MOCK_SITE_KEY, MOCK_SUCCESS_TOKEN};

#[derive(Debug)]
pub enum CaptchaError {
    MissingToken,
    Misconfigured,
    RequestFailed,
    DecodeFailed,
    Rejected,
}

#[derive(Deserialize)]
struct TurnstileResponse {
    success: bool,
    #[serde(default, rename = "error-codes")]
    error_codes: Vec<String>,
}

pub async fn ensure_valid(state: &AppState, token: Option<&str>) -> Result<(), CaptchaError> {
    if should_skip_captcha(state, token) {
        return Ok(());
    }

    let captcha_token = token
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .ok_or(CaptchaError::MissingToken)?;

    let secret = state
        .config
        .turnstile_secret_key
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .ok_or(CaptchaError::Misconfigured)?;

    verify_with_turnstile(
        &state.http_client,
        state.config.turnstile_verify_url.as_str(),
        secret,
        captcha_token,
    )
    .await
}

fn should_skip_captcha(state: &AppState, token: Option<&str>) -> bool {
    state.config.turnstile_site_key.is_empty()
        || state.config.turnstile_site_key == DEV_MOCK_SITE_KEY
        || token == Some(MOCK_SUCCESS_TOKEN)
}

async fn verify_with_turnstile(
    client: &Client,
    endpoint: &str,
    secret: &str,
    token: &str,
) -> Result<(), CaptchaError> {
    let response = client
        .post(endpoint)
        .form(&[("secret", secret), ("response", token)])
        .send()
        .await
        .map_err(|err| {
            error!(?err, "Failed to reach Turnstile verification endpoint");
            CaptchaError::RequestFailed
        })?;

    if !response.status().is_success() {
        error!(status = %response.status(), "Turnstile verification responded with non-success status");
        return Err(CaptchaError::RequestFailed);
    }

    let payload: TurnstileResponse = response.json().await.map_err(|err| {
        error!(?err, "Unable to decode Turnstile verification payload");
        CaptchaError::DecodeFailed
    })?;

    if !payload.success {
        warn!(codes = ?payload.error_codes, "Turnstile verification did not succeed");
        return Err(CaptchaError::Rejected);
    }

    Ok(())
}

pub fn captcha_error_status(error: CaptchaError) -> (StatusCode, &'static str) {
    match error {
        CaptchaError::MissingToken => (StatusCode::BAD_REQUEST, "Missing captcha token"),
        CaptchaError::Misconfigured => (
            StatusCode::INTERNAL_SERVER_ERROR,
            "CAPTCHA verification misconfigured",
        ),
        CaptchaError::RequestFailed => {
            (StatusCode::BAD_GATEWAY, "CAPTCHA verification unavailable")
        }
        CaptchaError::DecodeFailed => (StatusCode::BAD_GATEWAY, "CAPTCHA verification unavailable"),
        CaptchaError::Rejected => (
            StatusCode::UNPROCESSABLE_ENTITY,
            "CAPTCHA verification failed",
        ),
    }
}
