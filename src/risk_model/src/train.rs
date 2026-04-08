use anyhow::Result;
use rand::seq::SliceRandom;
use rand::thread_rng;

use crate::config::TrainingConfig;
use crate::dataset::{load_jsonl, to_tensor};
use crate::model::RiskModel;

use crate::features::{transform_features, Normalizer};
use crate::dataset::to_tensor_with_normalizer;

use candle_core::{IndexOp, Tensor};

pub fn train(cfg: &TrainingConfig) -> Result<()> {
    println!("Loading dataset...");
    let mut samples = load_jsonl(&cfg.dataset_path)?;

    if samples.is_empty() {
        anyhow::bail!("Dataset is empty — data/samples.csv required.");
    }

    samples.shuffle(&mut thread_rng());

    // 80/20 split
    let split = (samples.len() as f32 * 0.8) as usize;
    let train_samples = &samples[..split];
    let val_samples = &samples[split..];

    // --- Compute normalizer on TRAIN split only ---
    let mut train_feats: Vec<[f32; 7]> = Vec::with_capacity(train_samples.len());
    for s in train_samples {
        train_feats.push(transform_features(
            s.tvl,
            s.tvl_delta_1d,
            s.tvl_delta_7d,
            s.price_delta_1d,
            s.price_delta_7d,
            s.volume_spike,
            s.mcap_tvl_ratio,
        ));
    }

    let norm = Normalizer::from_features(&train_feats);

    let norm_path = format!("{}.norm.json", cfg.model_save_path);
    norm.save_json(&norm_path)?;
    println!("Normalizer saved to {}", norm_path);

    let (train_x, train_y) = to_tensor_with_normalizer(train_samples, &cfg.device, Some(&norm))?;
    let (val_x, val_y) = to_tensor_with_normalizer(val_samples, &cfg.device, Some(&norm))?;

    let mut model = RiskModel::new(
        cfg.input_dim,
        cfg.learning_rate,
        cfg.device.clone(),
    )?;

    println!("Training on device: {:?}", cfg.device);

    for epoch in 0..cfg.epochs {
        let train_loss = train_epoch(&mut model, &train_x, &train_y, cfg.batch_size)?;

        let (val_loss, val_mae) = eval_epoch(&model, &val_x, &val_y, cfg.batch_size)?;

        println!(
            "Epoch {:03} | train_loss={:.6} | val_loss={:.6} | val_mae={:.4}",
            epoch + 1,
            train_loss,
            val_loss,
            val_mae
        );
    }

    model.save(&cfg.model_save_path)?;
    println!("Model saved to {}", cfg.model_save_path);

    Ok(())
}

fn train_epoch(model: &mut RiskModel, x: &Tensor, y: &Tensor, batch_size: usize) -> Result<f32> {
    let mut total = 0.0;
    let mut batches = 0;

    for (xb, yb) in batch_iter(x, y, batch_size)? {
        let loss = model.train_step(&xb, &yb)?;
        total += loss;
        batches += 1;
    }

    Ok(total / batches as f32)
}

fn eval_epoch(model: &RiskModel, x: &Tensor, y: &Tensor, batch_size: usize) -> Result<(f32, f32)> {
    let mut total_loss = 0f32;
    let mut batches = 0usize;

    let mut mae_sum = 0f32;
    let mut mae_count = 0usize;

    for (xb, yb) in batch_iter(x, y, batch_size)? {
        let preds = model.net.forward(&xb)?;
        let loss_t = RiskModel::bce_loss(&preds, &yb)?;
        let loss = loss_t.squeeze(0)?.to_vec0::<f32>()?;
        total_loss += loss;
        batches += 1;

        // --- MAE ---
        // abs(pred - y) -> sum
        let abs_err = preds.sub(&yb)?.abs()?;
        let batch_abs_sum = abs_err.sum_all()?.to_vec0::<f32>()?;
        mae_sum += batch_abs_sum;

        mae_count += yb.dims()[0];
    }

    let avg_loss = total_loss / batches as f32;
    let mae = if mae_count > 0 {
        mae_sum / (mae_count as f32)
    } else {
        0.0
    };

    Ok((avg_loss, mae))
}

fn batch_iter<'a>(
    x: &'a Tensor,
    y: &'a Tensor,
    batch_size: usize,
) -> Result<impl Iterator<Item = (Tensor, Tensor)> + 'a> {
    let n = x.dims()[0];

    Ok((0..n).step_by(batch_size).map(move |start| {
        let end = (start + batch_size).min(n);
        let xb = x.i(start..end).unwrap();
        let yb = y.i(start..end).unwrap();

        (xb, yb)
    }))
}
