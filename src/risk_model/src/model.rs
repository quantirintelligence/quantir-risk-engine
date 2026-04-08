use anyhow::Result;
use candle_core::{DType, Device, Tensor};
use candle_nn::{ops, AdamW, Linear, Module, Optimizer, VarBuilder, VarMap};

/// Feed-forward neural network (MLP)
pub struct RiskNet {
    fc1: Linear,
    fc2: Linear,
    fc3: Linear,
}

impl RiskNet {
    /// Create new network
    pub fn new(vb: VarBuilder, input_dim: usize) -> Result<Self> {
        let fc1 = candle_nn::linear(input_dim, 128, vb.pp("fc1"))?;
        let fc2 = candle_nn::linear(128, 64, vb.pp("fc2"))?;
        let fc3 = candle_nn::linear(64, 1, vb.pp("fc3"))?;

        Ok(Self { fc1, fc2, fc3 })
    }

    /// Forward pass
    pub fn forward(&self, x: &Tensor) -> Result<Tensor> {
        let x = self.fc1.forward(x)?.relu()?;
        let x = self.fc2.forward(&x)?.relu()?;
        let x = self.fc3.forward(&x)?;
        Ok(ops::sigmoid(&x)?)
    }

    /// Predict single scalar
    pub fn predict(&self, x: &Tensor) -> Result<f32> {
        let out = self.forward(x)?;
        let out = out.squeeze(0)?;
        let out = out.to_vec1::<f32>()?;
        Ok(out[0])
    }
}

/// Model wrapper (network + optimizer)
pub struct RiskModel {
    pub vars: VarMap,
    pub net: RiskNet,
    pub opt: AdamW,
    pub device: Device,
}

impl RiskModel {
    /// Initialize model
    pub fn new(input_dim: usize, lr: f64, device: Device) -> Result<Self> {
        let mut vars = VarMap::new();

        let vb = VarBuilder::from_varmap(&vars, DType::F32, &device);

        let net = RiskNet::new(vb, input_dim)?;
        let opt = AdamW::new_lr(vars.all_vars(), lr)?;

        Ok(Self {
            vars,
            net,
            opt,
            device,
        })
    }

    /// Binary Cross-Entropy loss (numerically stable)
    pub fn bce_loss(preds: &Tensor, y: &Tensor) -> Result<Tensor> {
        let eps = 1e-7f32;

        let preds = preds.clamp(eps, 1.0 - eps)?;
        let log_p = preds.log()?;

        let one = Tensor::ones(preds.dims(), preds.dtype(), preds.device())?;
        let log_one_minus_p = (&one - &preds)?.clamp(eps, 1.0 - eps)?.log()?;

        let term1 = (y * &log_p)?;
        let term2 = ((&one - y)? * &log_one_minus_p)?;

        Ok((&term1 + &term2)?.neg()?.mean(0)?)
    }

    /// One training step
    pub fn train_step(&mut self, x: &Tensor, y: &Tensor) -> Result<f32> {
        let preds = self.net.forward(x)?;
        let loss = Self::bce_loss(&preds, y)?;
        self.opt.backward_step(&loss)?;
        Ok(loss.squeeze(0)?.to_vec0::<f32>()?)
    }

    /// Save model
    pub fn save(&self, path: &str) -> Result<()> {
        self.vars.save(path)?;
        Ok(())
    }

    /// Load model
    pub fn load(&mut self, path: &str) -> Result<()> {
        self.vars.load(path)?;
        Ok(())
    }
}
