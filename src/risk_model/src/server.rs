use axum::{routing::post, Router, Json};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use candle_core::Device;
use tower_http::cors::{Any, CorsLayer};
use tokio::net::TcpListener;

use crate::runtime::RiskRuntime;

#[derive(Deserialize)]
struct ScoreRequest {
    pub tvl: f32,
    pub tvl_delta_1d: f32,
    pub tvl_delta_7d: f32,
    pub price_delta_1d: f32,
    pub price_delta_7d: f32,
    pub volume_spike: f32,
    pub mcap_tvl_ratio: f32,
}

#[derive(Serialize)]
struct ScoreResponse {
    pub risk: f32,
}

pub async fn start_server(model_path: &str) {
    println!("Loading model...");

    let runtime = Arc::new(
        RiskRuntime::load(model_path, Device::Cpu)
            .expect("Failed to load model"),
    );

    println!("Model loaded. Starting server on 0.0.0.0:8080");

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/score", post({
            let runtime = runtime.clone();
            move |Json(req): Json<ScoreRequest>| {
                let runtime = runtime.clone();
                async move {
                    let risk = runtime
                        .predict(
                            req.tvl,
                            req.tvl_delta_1d,
                            req.tvl_delta_7d,
                            req.price_delta_1d,
                            req.price_delta_7d,
                            req.volume_spike,
                            req.mcap_tvl_ratio,
                        )
                        .unwrap_or(0.0);

                    Json(ScoreResponse { risk })
                }
            }
        }))
        .layer(cors);

    let listener = TcpListener::bind("0.0.0.0:8080").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
