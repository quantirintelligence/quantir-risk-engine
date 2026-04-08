use candle_core::Device;

/// Global training configuration
#[derive(Debug, Clone)]
pub struct TrainingConfig {
    pub input_dim: usize,
    pub learning_rate: f64,
    pub batch_size: usize,
    pub epochs: usize,
    pub model_save_path: String,
    pub dataset_path: String,
    pub device: Device,
}

impl TrainingConfig {
    /// Creates new training configuration with sane defaults
    pub fn new(input_dim: usize) -> Self {
        let device = select_device();

        println!("Selected device: {:?}", device);

        Self {
            input_dim,
            learning_rate: 1e-3,
            batch_size: 64,
            epochs: 50,
            model_save_path: "data/model.safetensors".to_string(),
            dataset_path: "data/samples.csv".to_string(),
            device,
        }
    }
}

/// Selects best available device for Candle:
/// - macOS → Metal (MPS)
/// - Linux/Windows → CUDA if available
/// - Otherwise → CPU
pub fn select_device() -> Device {
    // ---------- macOS (Metal / MPS) ----------
    #[cfg(target_os = "macos")]
    {
        if let Ok(dev) = Device::new_metal(0) {
            println!("Using Metal (MPS)");
            return Device::Cpu;
        }

        println!("Metal not available → using CPU");
        return Device::Cpu;
    }

    // ---------- CUDA (Linux / Windows) ----------
    #[cfg(any(target_os = "linux", target_os = "windows"))]
    {
        if let Ok(dev) = Device::new_cuda(0) {
            println!("Using CUDA");
            return dev;
        }

        println!("CUDA not available → using CPU");
        return Device::Cpu;
    }

    Device::Cpu
}
