use anyhow::Result;
use candle_core::{DType, Device, Tensor};
use candle_nn::VarBuilder;

use crate::features::{transform_features, Normalizer};
use crate::model::RiskNet;

pub struct RiskRuntime {
    model: RiskNet,
    norm: Normalizer,
    device: Device,
}

impl RiskRuntime {
    pub fn load(model_path: &str, device: Device) -> Result<Self> {
        let norm_path = format!("{}.norm.json", model_path);
        let norm = Normalizer::load_json(&norm_path)?;

        let tensors = candle_core::safetensors::load(model_path, &device)?;
        let vb = VarBuilder::from_tensors(tensors, DType::F32, &device);
        let model = RiskNet::new(vb, 7)?;

        Ok(Self { model, norm, device })
    }

    pub fn predict(
        &self,
        tvl: f32,
        tvl_d1: f32,
        tvl_d7: f32,
        p_d1: f32,
        p_d7: f32,
        vol: f32,
        mcap_tvl: f32,
    ) -> Result<f32> {
        let feats = transform_features(
            tvl, tvl_d1, tvl_d7, p_d1, p_d7, vol, mcap_tvl,
        );

        let feats = self.norm.apply(feats);

        let input = Tensor::from_vec(feats.to_vec(), (1, 7), &self.device)?
            .to_dtype(DType::F32)?;

        let pred = self.model.forward(&input)?;

        Ok(pred.flatten_all()?.to_vec1::<f32>()?[0])
    }
}
