use axum::{Router, http::Method, routing::post};
use tower_http::cors::{Any, CorsLayer};

use crate::AppState;
use crate::handlers::auth::{login_handler, refresh_handler};
use crate::handlers::register::register_handler;

pub fn create_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_methods([Method::POST, Method::OPTIONS])
        .allow_headers(Any)
        .allow_origin(Any);

    Router::new()
        .route("/api/auth/register", post(register_handler))
        .route("/api/auth/login", post(login_handler))
        .route("/api/auth/refresh", post(refresh_handler))
        .with_state(state)
        .layer(cors)
}
