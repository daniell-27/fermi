import { Router } from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { issueToken, clearToken, requireAuth } from "../middleware/auth.js";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/signup", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: "An account with that email already exists." });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, passwordHash });
    issueToken(res, user);
    res.json({ user: user.toJSON() });
  } catch (err) {
    console.error("signup failed:", err);
    res.status(500).json({ error: "Could not create account." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Incorrect email or password." });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Incorrect email or password." });
    issueToken(res, user);
    res.json({ user: user.toJSON() });
  } catch (err) {
    console.error("login failed:", err);
    res.status(500).json({ error: "Could not sign in." });
  }
});

router.post("/logout", (_req, res) => {
  clearToken(res);
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ error: "Not signed in." });
  res.json({ user: user.toJSON() });
});

export default router;
