import mongoose from "mongoose";

// A completed scenario analysis: a snapshot of the model + base values + the
// per-scenario results (so a run always reloads exactly as it ran).
const runSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    modelName: { type: String, default: "" },
    company: { type: String, default: "" },
    ticker: { type: String, default: "" },
    model: { type: mongoose.Schema.Types.Mixed, default: {} },
    baseValues: { type: mongoose.Schema.Types.Mixed, default: {} },
    result: { type: mongoose.Schema.Types.Mixed, default: {} },
    ranAt: { type: Number, default: () => Date.now() },
  },
  { timestamps: true }
);

runSchema.set("toJSON", {
  transform(_doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.userId;
  },
});

export default mongoose.model("Run", runSchema);
