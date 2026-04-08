use anyhow::Result;
use candle_core::{DType, Device, Tensor};
use serde::Deserialize;
use std::fs::File;
use std::io::{BufRead, BufReader};
use serde_json;
use crate::features::{transform_features, Normalizer};

/// One row from CSV (one historical snapshot of a protocol)
#[derive(Debug, Clone, Deserialize)]
pub struct Sample {
    pub tvl: f32,
    pub tvl_delta_1d: f32,
    pub tvl_delta_7d: f32,
    pub price_delta_1d: f32,
    pub price_delta_7d: f32,
    pub volume_spike: f32,
    pub mcap_tvl_ratio: f32,
    pub risk: f32,
}

pub fn load_jsonl(path: &str) -> Result<Vec<Sample>> {
    let file = File::open(path)?;
    let reader = BufReader::new(file);

    let mut samples = Vec::new();

    for line in reader.lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }

        let sample: Sample = serde_json::from_str(&line)?;
        samples.push(sample);
    }

    Ok(samples)
}

pub fn to_tensor(samples: &[Sample], device: &Device) -> Result<(Tensor, Tensor)> {
    to_tensor_with_normalizer(samples, device, None)
}

pub fn to_tensor_with_normalizer(
    samples: &[Sample],
    device: &Device,
    norm: Option<&Normalizer>,
) -> Result<(Tensor, Tensor)> {
    let n = samples.len();
    let feature_dim = 7;

    let mut features = Vec::with_capacity(n * feature_dim);
    let mut labels = Vec::with_capacity(n);

    for s in samples {
        let mut x = transform_features(
            s.tvl,
            s.tvl_delta_1d,
            s.tvl_delta_7d,
            s.price_delta_1d,
            s.price_delta_7d,
            s.volume_spike,
            s.mcap_tvl_ratio,
        );

        if let Some(norm) = norm {
            x = norm.apply(x);
        }

        features.extend_from_slice(&x);
        labels.push(s.risk.clamp(0.0, 1.0));
    }

    let x = Tensor::from_vec(features, (n, feature_dim), device)?.to_dtype(DType::F32)?;
    let y = Tensor::from_vec(labels, (n, 1), device)?.to_dtype(DType::F32)?;

    Ok((x, y))
}
