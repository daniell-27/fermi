import mongoose from "mongoose";

// A reusable valuation model: the named blocks + the formula, plus the
// company/thesis context. Flexible sub-shapes are stored as Mixed.
const savedModelSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, default: "Untitled model" },
    company: { type: String, default: "" },
    ticker: { type: String, default: "" },
    thesis: { type: String, default: "" },
    blocks: { type: mongoose.Schema.Types.Mixed, default: [] },
    formula: { type: mongoose.Schema.Types.Mixed, default: {} },
    auxFormulas: { type: mongoose.Schema.Types.Mixed, default: [] },
    units: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

savedModelSchema.set("toJSON", {
  transform(_doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.userId;
  },
});

export default mongoose.model("SavedModel", savedModelSchema);
