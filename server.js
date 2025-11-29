const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();

/* ---------- MIDDLEWARE ---------- */
app.use(cors());
app.use(express.json());

// Serve static frontend files from "public" folder
app.use(express.static(path.join(__dirname, "public")));

/* ---------- MONGODB CONNECTION ---------- */
const MONGO_URI = "mongodb://127.0.0.1:27017/attendance_app";

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

/* ---------- MONGOOSE MODEL ---------- */
const SubjectSchema = new mongoose.Schema(
  {
    subjectName: { type: String, required: true },
    total: { type: Number, required: true },
    attended: { type: Number, required: true },
    requiredPercent: { type: Number, default: 75 }
  },
  { timestamps: true }
);

const Subject = mongoose.model("Subject", SubjectSchema);

/* ---------- ATTENDANCE LOGIC ---------- */
function calculateAttendance(attended, total, requiredPercent) {
  attended = Number(attended);
  total = Number(total);
  requiredPercent = Number(requiredPercent);

  if (total <= 0) {
    return {
      currentPercent: 0,
      canBunk: 0,
      needToAttend: 0,
      message: "No classes conducted yet."
    };
  }

  const r = requiredPercent / 100;
  const currentPercent = (attended / total) * 100;

  let canBunk = 0;
  let needToAttend = 0;

  if (currentPercent >= requiredPercent) {
    const nMax = Math.floor((attended - r * total) / r);
    canBunk = nMax > 0 ? nMax : 0;
  } else {
    const xMin = Math.ceil((r * total - attended) / (1 - r));
    needToAttend = xMin > 0 ? xMin : 0;
  }

  return {
    currentPercent: Number(currentPercent.toFixed(2)),
    canBunk,
    needToAttend,
    message:
      currentPercent >= requiredPercent
        ? `You are safe. You can bunk around ${canBunk} classes.`
        : `You need to attend around ${needToAttend} more classes to reach ${requiredPercent}%.`
  };
}

/* ---------- API ROUTES ---------- */

// GET /api/subjects - list all subjects with calculated stats
app.get("/api/subjects", async (req, res) => {
  try {
    const subjects = await Subject.find().sort({ createdAt: -1 });

    const data = subjects.map((s) => {
      const stats = calculateAttendance(s.attended, s.total, s.requiredPercent);
      return { ...s.toObject(), stats };
    });

    res.json(data);
  } catch (err) {
    console.error("GET /api/subjects error:", err);
    res.status(500).json({ error: "Failed to fetch subjects" });
  }
});

// POST /api/subjects - create new subject
app.post("/api/subjects", async (req, res) => {
  try {
    const { subjectName, total, attended, requiredPercent } = req.body;

    if (!subjectName || total == null || attended == null) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const subject = await Subject.create({
      subjectName,
      total,
      attended,
      requiredPercent: requiredPercent || 75
    });

    const stats = calculateAttendance(
      subject.attended,
      subject.total,
      subject.requiredPercent
    );

    res.status(201).json({ ...subject.toObject(), stats });
  } catch (err) {
    console.error("POST /api/subjects error:", err);
    res.status(500).json({ error: "Failed to create subject" });
  }
});

// PUT /api/subjects/:id - update subject
app.put("/api/subjects/:id", async (req, res) => {
  try {
    const { subjectName, total, attended, requiredPercent } = req.body;

    const subject = await Subject.findByIdAndUpdate(
      req.params.id,
      { subjectName, total, attended, requiredPercent },
      { new: true }
    );

    if (!subject) {
      return res.status(404).json({ error: "Subject not found" });
    }

    const stats = calculateAttendance(
      subject.attended,
      subject.total,
      subject.requiredPercent
    );

    res.json({ ...subject.toObject(), stats });
  } catch (err) {
    console.error("PUT /api/subjects/:id error:", err);
    res.status(500).json({ error: "Failed to update subject" });
  }
});

// DELETE /api/subjects/:id - delete subject
app.delete("/api/subjects/:id", async (req, res) => {
  try {
    const subject = await Subject.findByIdAndDelete(req.params.id);
    if (!subject) {
      return res.status(404).json({ error: "Subject not found" });
    }
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    console.error("DELETE /api/subjects/:id error:", err);
    res.status(500).json({ error: "Failed to delete subject" });
  }
});

/* ---------- FALLBACK: SERVE index.html FOR UNKNOWN ROUTES (optional SPA-like) ---------- */
// app.get("*", (req, res) => {
//   res.sendFile(path.join(__dirname, "public", "index.html"));
// });

/* ---------- START SERVER ---------- */
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
