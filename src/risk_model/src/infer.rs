use anyhow::Result;
use candle_core::{Tensor, DType, Device};
use candle_nn::{VarBuilder};
use crate::model::RiskNet;
use crate::features::{transform_features, Normalizer};

pub fn infer(
    model_path: &str,
    tvl: f32,
    tvl_delta_1d: f32,
    tvl_delta_7d: f32,
    price_delta_1d: f32,
    price_delta_7d: f32,
    volume_spike: f32,
    mcap_tvl_ratio: f32,
    device: Device,
) -> Result<f32> {
    let norm_path = format!("{}.norm.json", model_path);
    let norm = match Normalizer::load_json(&norm_path) {
        Ok(n) => n,
        Err(_) => Normalizer::identity(),
    };

    let mut feats = transform_features(
        tvl,
        tvl_delta_1d,
        tvl_delta_7d,
        price_delta_1d,
        price_delta_7d,
        volume_spike,
        mcap_tvl_ratio,
    );

    feats = norm.apply(feats);

    // --- Load model.safetensors ---
    let input = Tensor::from_vec(feats.to_vec(), (1, 7), &device)?
        .to_dtype(DType::F32)?;

    let tensors = candle_core::safetensors::load(model_path, &device)?;
    let vb = VarBuilder::from_tensors(tensors, DType::F32, &device);
    let model = RiskNet::new(vb, 7)?;

    let pred = model.forward(&input)?;
    let score = pred.flatten_all()?.to_vec1::<f32>()?[0];

    Ok(score)
}
