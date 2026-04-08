use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Debug, Clone, Copy)]
pub struct FeatureConfig {
    /// epsilon for log1p-like transform: ln(max(tvl,0)+eps)
    pub tvl_log_eps: f32,
    pub delta_clip: f32,
    pub volume_spike_clip: f32,
    pub mcap_tvl_ratio_clip: f32,
}

impl Default for FeatureConfig {
    fn default() -> Self {
        Self {
            tvl_log_eps: 1.0,
            delta_clip: 1.0,
            volume_spike_clip: 20.0,
            mcap_tvl_ratio_clip: 10.0,
        }
    }
}

#[inline]
fn sanitize(x: f32) -> f32 {
    if x.is_finite() { x } else { 0.0 }
}

#[inline]
fn clamp(x: f32, lo: f32, hi: f32) -> f32 {
    if x < lo { lo } else if x > hi { hi } else { x }
}

pub fn transform_features(
    tvl: f32,
    tvl_delta_1d: f32,
    tvl_delta_7d: f32,
    price_delta_1d: f32,
    price_delta_7d: f32,
    volume_spike: f32,
    mcap_tvl_ratio: f32,
) -> [f32; 7] {
    let cfg = FeatureConfig::default();

    let tvl = sanitize(tvl).max(0.0);
    let tvl = (tvl + cfg.tvl_log_eps).ln(); // ln(tvl + 1)

    let tvl_delta_1d = clamp(sanitize(tvl_delta_1d), -cfg.delta_clip, cfg.delta_clip);
    let tvl_delta_7d = clamp(sanitize(tvl_delta_7d), -cfg.delta_clip, cfg.delta_clip);
    let price_delta_1d = clamp(sanitize(price_delta_1d), -cfg.delta_clip, cfg.delta_clip);
    let price_delta_7d = clamp(sanitize(price_delta_7d), -cfg.delta_clip, cfg.delta_clip);

    let volume_spike = clamp(sanitize(volume_spike), 0.0, cfg.volume_spike_clip);
    let mcap_tvl_ratio = clamp(sanitize(mcap_tvl_ratio), 0.0, cfg.mcap_tvl_ratio_clip);

    [
        sanitize(tvl),
        sanitize(tvl_delta_1d),
        sanitize(tvl_delta_7d),
        sanitize(price_delta_1d),
        sanitize(price_delta_7d),
        sanitize(volume_spike),
        sanitize(mcap_tvl_ratio),
    ]
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Normalizer {
    pub mean: [f32; 7],
    pub std: [f32; 7],
}

impl Normalizer {
    pub fn identity() -> Self {
        Self {
            mean: [0.0; 7],
            std: [1.0; 7],
        }
    }

    pub fn apply(&self, x: [f32; 7]) -> [f32; 7] {
        let mut out = [0.0f32; 7];
        for i in 0..7 {
            let denom = if self.std[i].abs() < 1e-8 { 1.0 } else { self.std[i] };
            out[i] = (x[i] - self.mean[i]) / denom;
            if !out[i].is_finite() { out[i] = 0.0; }
        }
        out
    }

    pub fn from_features(features: &[[f32; 7]]) -> Self {
        if features.is_empty() {
            return Self::identity();
        }

        let n = features.len() as f32;

        // mean
        let mut mean = [0.0f32; 7];
        for row in features {
            for i in 0..7 {
                mean[i] += row[i];
            }
        }
        for i in 0..7 {
            mean[i] /= n;
            if !mean[i].is_finite() { mean[i] = 0.0; }
        }

        // std (population std)
        let mut var = [0.0f32; 7];
        for row in features {
            for i in 0..7 {
                let d = row[i] - mean[i];
                var[i] += d * d;
            }
        }
        let mut std = [0.0f32; 7];
        for i in 0..7 {
            std[i] = (var[i] / n).sqrt();
            if !std[i].is_finite() || std[i].abs() < 1e-8 {
                std[i] = 1.0;
            }
        }

        Self { mean, std }
    }

    pub fn save_json(&self, path: &str) -> Result<()> {
        let s = serde_json::to_string_pretty(self)?;
        fs::write(path, s)?;
        Ok(())
    }

    pub fn load_json(path: &str) -> Result<Self> {
        let s = fs::read_to_string(path)?;
        let v = serde_json::from_str::<Self>(&s)?;
        Ok(v)
    }
}