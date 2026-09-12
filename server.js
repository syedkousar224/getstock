/**
 * Getstock server
 * ---------------
 * Public video/image platform, YouTube-style:
 *   - Anyone can browse, watch, and download — no login required.
 *   - Logging in is only required to upload, like, or comment.
 *   - Session-based auth, passwords hashed with bcrypt.
 *
 * Data lives in JSON files under /data, uploaded files under /uploads.
 * Fine for personal/small-scale use. Swap for a real DB before scaling up.
 */

const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(__dirname, "uploads");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const MEDIA_FILE = path.join(DATA_DIR, "media.json");

// ---------- tiny JSON "database" helpers ----------
function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]");
  if (!fs.existsSync(MEDIA_FILE)) fs.writeFileSync(MEDIA_FILE, "[]");
}
function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
ensureDataFiles();

// ---------- app setup ----------
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: "change-this-secret-before-deploying", // TODO: move to an env var in production
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      httpOnly: true,
    },
  })
);

app.use(express.static(path.join(__dirname, "public")));

// ---------- auth helpers ----------
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "You need to be logged in to do that." });
  }
  next();
}
function publicUser(user) {
  return { id: user.id, username: user.username };
}
function currentUser(req) {
  if (!req.session.userId) return null;
  const users = readJSON(USERS_FILE);
  return users.find((u) => u.id === req.session.userId) || null;
}

// ---------- auth routes ----------
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }
  const users = readJSON(USERS_FILE);
  const exists = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (exists) return res.status(409).json({ error: "That username is already taken." });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = { id: uuidv4(), username, passwordHash, createdAt: Date.now() };
  users.push(user);
  writeJSON(USERS_FILE, users);

  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const users = readJSON(USERS_FILE);
  const user = users.find((u) => u.username.toLowerCase() === (username || "").toLowerCase());
  if (!user) return res.status(401).json({ error: "Incorrect username or password." });

  const match = await bcrypt.compare(password || "", user.passwordHash);
  if (!match) return res.status(401).json({ error: "Incorrect username or password." });

  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/me", (req, res) => {
  const user = currentUser(req);
  res.json({ user: user ? publicUser(user) : null });
});

// ---------- upload setup ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const ALLOWED_TYPES = /^(image|video)\//;
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.test(file.mimetype)) return cb(null, true);
    cb(new Error("Only image and video files are allowed."));
  },
});

// ---------- media: browse (PUBLIC — no login needed) ----------
app.get("/api/media", (req, res) => {
  const media = readJSON(MEDIA_FILE);
  const q = (req.query.q || "").toLowerCase().trim();
  const kind = req.query.kind; // "image" | "video" | undefined

  let items = media;
  if (q) {
    items = items.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.originalName.toLowerCase().includes(q) ||
        m.ownerName.toLowerCase().includes(q)
    );
  }
  if (kind === "image" || kind === "video") {
    items = items.filter((m) => m.kind === kind);
  }

  // strip comments array from list view to keep payload light
  const stripped = items.map(({ comments, ...rest }) => ({
    ...rest,
    commentCount: comments.length,
  }));
  res.json({ items: stripped });
});

app.get("/api/media/:id", (req, res) => {
  const media = readJSON(MEDIA_FILE);
  const item = media.find((m) => m.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Not found." });

  item.views += 1;
  writeJSON(MEDIA_FILE, media);

  const user = currentUser(req);
  res.json({
    item: {
      ...item,
      likeCount: item.likes.length,
      likedByMe: user ? item.likes.includes(user.id) : false,
    },
  });
});

app.get("/api/media/:id/view", (req, res) => {
  const media = readJSON(MEDIA_FILE);
  const item = media.find((m) => m.id === req.params.id);
  if (!item) return res.status(404).end();
  const filePath = path.join(UPLOAD_DIR, item.storedName);
  if (!fs.existsSync(filePath)) return res.status(404).end();
  res.setHeader("Content-Type", item.mimeType);
  fs.createReadStream(filePath).pipe(res);
});

app.get("/api/media/:id/download", (req, res) => {
  const media = readJSON(MEDIA_FILE);
  const item = media.find((m) => m.id === req.params.id);
  if (!item) return res.status(404).json({ error: "File not found." });
  const filePath = path.join(UPLOAD_DIR, item.storedName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File is missing." });
  res.download(filePath, item.originalName);
});

// ---------- media: upload / delete (AUTH required) ----------
app.post("/api/upload", requireAuth, (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No file received." });

    const owner = currentUser(req);
    const title = (req.body.title || req.file.originalname).slice(0, 150);
    const description = (req.body.description || "").slice(0, 2000);

    const media = readJSON(MEDIA_FILE);
    const item = {
      id: uuidv4(),
      storedName: req.file.filename,
      originalName: req.file.originalname,
      title,
      description,
      mimeType: req.file.mimetype,
      size: req.file.size,
      kind: req.file.mimetype.startsWith("video/") ? "video" : "image",
      ownerId: owner.id,
      ownerName: owner.username,
      uploadedAt: Date.now(),
      views: 0,
      likes: [],
      comments: [],
    };
    media.unshift(item);
    writeJSON(MEDIA_FILE, media);
    res.json({ item });
  });
});

app.delete("/api/media/:id", requireAuth, (req, res) => {
  const media = readJSON(MEDIA_FILE);
  const item = media.find((m) => m.id === req.params.id);
  if (!item) return res.status(404).json({ error: "File not found." });
  if (item.ownerId !== req.session.userId) {
    return res.status(403).json({ error: "You can only delete your own uploads." });
  }
  const filePath = path.join(UPLOAD_DIR, item.storedName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  writeJSON(MEDIA_FILE, media.filter((m) => m.id !== req.params.id));
  res.json({ ok: true });
});

// ---------- likes (AUTH required) ----------
app.post("/api/media/:id/like", requireAuth, (req, res) => {
  const media = readJSON(MEDIA_FILE);
  const item = media.find((m) => m.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Not found." });

  const uid = req.session.userId;
  const idx = item.likes.indexOf(uid);
  if (idx === -1) item.likes.push(uid);
  else item.likes.splice(idx, 1);

  writeJSON(MEDIA_FILE, media);
  res.json({ likeCount: item.likes.length, likedByMe: idx === -1 });
});

// ---------- comments (read PUBLIC, post AUTH required) ----------
app.post("/api/media/:id/comments", requireAuth, (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: "Comment can't be empty." });

  const media = readJSON(MEDIA_FILE);
  const item = media.find((m) => m.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Not found." });

  const owner = currentUser(req);
  const comment = {
    id: uuidv4(),
    userId: owner.id,
    username: owner.username,
    text: text.slice(0, 1000),
    createdAt: Date.now(),
  };
  item.comments.push(comment);
  writeJSON(MEDIA_FILE, media);
  res.json({ comment });
});

app.listen(PORT, () => {
  console.log(`Getstock running at http://localhost:${PORT}`);
});