use axum::{Router, http::Method, routing::post};
use tower_http::cors::{Any, CorsLayer};

use crate::AppState;
use crate::handlers::register::register_handler;

pub fn create_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_methods([Method::POST, Method::OPTIONS])
        .allow_headers(Any)
        .allow_origin(Any);

    Router::new()
        .route("/api/auth/register", post(register_handler))
        .with_state(state)
        .layer(cors)
}
