import { Router } from "express";
import SavedModel from "../models/SavedModel.js";
import Run from "../models/Run.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth); // everything here is per-user

// ---------- Saved models ----------
router.get("/models", async (req, res) => {
  const models = await SavedModel.find({ userId: req.userId }).sort({ updatedAt: -1 });
  res.json(models.map((m) => m.toJSON()));
});

router.post("/models", async (req, res) => {
  const { id, name, company, ticker, thesis, blocks, formula } = req.body || {};
  const fields = { name, company, ticker, thesis, blocks, formula };
  let doc;
  if (id) {
    doc = await SavedModel.findOneAndUpdate(
      { _id: id, userId: req.userId },
      { $set: fields },
      { new: true }
    );
  }
  if (!doc) {
    doc = await SavedModel.create({ ...fields, userId: req.userId });
  }
  res.json(doc.toJSON());
});

router.delete("/models/:id", async (req, res) => {
  await SavedModel.deleteOne({ _id: req.params.id, userId: req.userId });
  res.json({ ok: true });
});

// ---------- Run history ----------
router.get("/runs", async (req, res) => {
  const runs = await Run.find({ userId: req.userId }).sort({ ranAt: -1 }).limit(100);
  res.json(runs.map((r) => r.toJSON()));
});

router.post("/runs", async (req, res) => {
  const { id, modelName, company, ticker, model, baseValues, result } = req.body || {};
  const fields = { modelName, company, ticker, model, baseValues, result };
  let doc;
  if (id) {
    doc = await Run.findOneAndUpdate(
      { _id: id, userId: req.userId },
      { $set: fields },
      { new: true }
    );
  }
  if (!doc) {
    doc = await Run.create({ ...fields, userId: req.userId, ranAt: Date.now() });
  }
  res.json(doc.toJSON());
});

router.delete("/runs/:id", async (req, res) => {
  await Run.deleteOne({ _id: req.params.id, userId: req.userId });
  res.json({ ok: true });
});

export default router;
