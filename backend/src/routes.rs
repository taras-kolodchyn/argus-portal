use axum::{Router, http::HeaderValue, http::Method, routing::post};
use tower_http::cors::{AllowOrigin, Any, CorsLayer};

use crate::handlers::auth::{login_handler, refresh_handler};
use crate::handlers::register::register_handler;
use crate::{AppConfig, AppState};

pub fn create_router(state: AppState) -> Router {
    let cors = build_cors_layer(&state.config);

    Router::new()
        .route("/api/auth/register", post(register_handler))
        .route("/api/auth/login", post(login_handler))
        .route("/api/auth/refresh", post(refresh_handler))
        .with_state(state)
        .layer(cors)
}

fn build_cors_layer(config: &AppConfig) -> CorsLayer {
    let base = CorsLayer::new()
        .allow_methods([Method::POST, Method::OPTIONS])
        .allow_headers(Any);

    if config.cors_allowed_origins.is_empty() {
        return base.allow_origin(Any);
    }

    let origins: Vec<HeaderValue> = config
        .cors_allowed_origins
        .iter()
        .filter_map(|origin| HeaderValue::from_str(origin).ok())
        .collect();

    if origins.is_empty() {
        base.allow_origin(Any)
    } else {
        base.allow_origin(AllowOrigin::list(origins))
    }
}
