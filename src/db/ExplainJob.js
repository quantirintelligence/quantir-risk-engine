import mongoose from "mongoose";

const HypothesisAssessmentSchema = new mongoose.Schema(
  {
    hypothesis: { type: String, required: true },
    score: { type: Number, default: 0 },
    confidence: { type: Number, min: 0, max: 1, default: 0 },
    reasoning: { type: String, default: "" }
  },
  { _id: false }
);

const AgentOutputSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true },
    model: { type: String, required: true },
    status: {
      type: String,
      enum: ["completed", "failed"],
      default: "completed"
    },
    latency_ms: { type: Number, default: 0 },
    summary: { type: String, default: "" },
    hypotheses: {
      type: [HypothesisAssessmentSchema],
      default: []
    },
    error: { type: String, default: "" },
    created_at: { type: Date, default: Date.now }
  },
  { _id: false }
);

const TriggerSchema = new mongoose.Schema(
  {
    type: { type: String, default: "" },
    name: { type: String, default: "" },
    severity: { type: String, default: "" },
    source: { type: String, default: "" },
    reason: { type: String, default: "" },
    tx_hash: { type: String, default: "" },
    observed_at: { type: Date, default: null },
    matched_rules: { type: [String], default: [] },
    matched_strategies: { type: [String], default: [] }
  },
  { _id: false }
);

const DistributionSchema = new mongoose.Schema(
  {
    hypothesis: { type: String, required: true },
    score: { type: Number, default: 0 },
    confidence: { type: Number, min: 0, max: 1, default: 0 },
    share_pct: { type: Number, default: 0 },
    reasoning_excerpt: { type: String, default: "" }
  },
  { _id: false }
);

const JudgeResultSchema = new mongoose.Schema(
  {
    primary_hypothesis: { type: String, default: "" },
    runner_up_hypothesis: { type: String, default: "" },
    confidence: { type: Number, min: 0, max: 1, default: 0 },
    summary: { type: String, default: "" },
    hypothesis_distribution: {
      type: [DistributionSchema],
      default: []
    }
  },
  { _id: false }
);

const ExplainJobSchema = new mongoose.Schema(
  {
    protocol: {
      type: String,
      required: true,
      index: true
    },

    event_id: {
      type: String,
      default: "",
      index: true
    },

    request_source: {
      type: String,
      enum: ["auto", "manual"],
      default: "auto",
      index: true
    },

    requested_by: {
      type: String,
      default: ""
    },

    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed"],
      default: "pending",
      index: true
    },

    trigger: {
      type: TriggerSchema,
      default: () => ({})
    },

    explain_context: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    hypothesis_pool: {
      type: [String],
      default: []
    },

    agent_outputs: {
      type: [AgentOutputSchema],
      default: []
    },

    judge_result: {
      type: JudgeResultSchema,
      default: () => ({})
    },

    final_summary: {
      type: String,
      default: ""
    },

    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: null
    },

    last_error: {
      type: String,
      default: ""
    },

    started_at: {
      type: Date,
      default: null
    },

    completed_at: {
      type: Date,
      default: null
    },

    created_at: {
      type: Date,
      default: Date.now,
      index: true
    },

    updated_at: {
      type: Date,
      default: Date.now
    }
  },
  {
    versionKey: false,
    collection: "explain_jobs"
  }
);

ExplainJobSchema.index({ protocol: 1, created_at: -1 });
ExplainJobSchema.index({ protocol: 1, request_source: 1, created_at: -1 });
ExplainJobSchema.index({ protocol: 1, status: 1, created_at: -1 });
ExplainJobSchema.index({ status: 1, created_at: -1 });

export default mongoose.models.ExplainJob ||
  mongoose.model("ExplainJob", ExplainJobSchema);
