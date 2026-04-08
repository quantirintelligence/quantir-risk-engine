mod config;
mod dataset;
mod features;
mod infer;
mod model;
mod runtime;
mod server;
mod train;
mod utils;

use anyhow::{anyhow, Result};
use std::env;

use crate::config::TrainingConfig;

fn print_help() {
    eprintln!();
    eprintln!("Usage:");
    eprintln!("  cargo run -- train");
    eprintln!("  cargo run -- serve --model <path>");
    eprintln!("  cargo run -- infer --model <path> \\");
    eprintln!("      --tvl <f32> --tvl_d1 <f32> --tvl_d7 <f32> \\");
    eprintln!("      --p_d1 <f32> --p_d7 <f32> --vol <f32> --mcap_tvl <f32>");
    eprintln!();
    eprintln!("Examples:");
    eprintln!("  cargo run -- train");
    eprintln!("  cargo run -- infer --model models/model.safetensors \\");
    eprintln!("      --tvl 19280364195 --tvl_d1 0.0194 --tvl_d7 -0.0292 \\");
    eprintln!("      --p_d1 0.0390 --p_d7 -0.0910 --vol 0.6250 --mcap_tvl 0.1963");
    eprintln!();
}

fn get_flag_f32(args: &[String], key: &str) -> Result<f32> {
    let idx = args
        .iter()
        .position(|a| a == key)
        .ok_or_else(|| anyhow!("Missing flag: {}", key))?;
    let val = args
        .get(idx + 1)
        .ok_or_else(|| anyhow!("Missing value for flag: {}", key))?;
    Ok(val
        .parse::<f32>()
        .map_err(|_| anyhow!("Invalid float for {}: {}", key, val))?)
}

fn get_flag_string(args: &[String], key: &str) -> Result<String> {
    let idx = args
        .iter()
        .position(|a| a == key)
        .ok_or_else(|| anyhow!("Missing flag: {}", key))?;
    let val = args
        .get(idx + 1)
        .ok_or_else(|| anyhow!("Missing value for flag: {}", key))?;
    Ok(val.clone())
}

#[tokio::main]
async fn main() -> Result<()> {
    env_logger::init();

    let args: Vec<String> = env::args().collect();

    // args[0] = binary name
    if args.len() < 2 {
        print_help();
        return Ok(());
    }

    match args[1].as_str() {
        "train" => {
            let mut cfg = TrainingConfig::new(7);

            if let Ok(data_path) = get_flag_string(&args, "--data") {
                cfg.dataset_path = data_path;
            }

            if let Ok(model_path) = get_flag_string(&args, "--model") {
                cfg.model_save_path = model_path;
            }

            train::train(&cfg)?;
            Ok(())
        }

        "infer" => {
            // model path
            let model_path = get_flag_string(&args, "--model")?;

            // features
            let tvl = get_flag_f32(&args, "--tvl")?;
            let tvl_d1 = get_flag_f32(&args, "--tvl_d1")?;
            let tvl_d7 = get_flag_f32(&args, "--tvl_d7")?;
            let p_d1 = get_flag_f32(&args, "--p_d1")?;
            let p_d7 = get_flag_f32(&args, "--p_d7")?;
            let vol = get_flag_f32(&args, "--vol")?;
            let mcap_tvl = get_flag_f32(&args, "--mcap_tvl")?;

            let cfg = TrainingConfig::new(7);

            let score = infer::infer(
                &model_path,
                tvl,
                tvl_d1,
                tvl_d7,
                p_d1,
                p_d7,
                vol,
                mcap_tvl,
                cfg.device.clone(),
            )?;

            println!("predicted_risk={:.6}", score);
            Ok(())
        }

        "serve" => {
            let model_path = get_flag_string(&args, "--model")
                .unwrap_or_else(|_| "data/model.safetensors".to_string());

            server::start_server(&model_path).await;
            Ok(())
        }

        _ => {
            print_help();
            Ok(())
        }
    }
}
