const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const dotenv = require("dotenv");
const path = require("path");
const createAuthRoutes = require("./routes/authRoutes");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const db = new Database("careersense.db");

// ================= DATABASE =================

db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

try {
    db.prepare("ALTER TABLE users ADD COLUMN reset_token TEXT").run();
} catch (e) {
    // Column already exists
}

try {
    db.prepare("ALTER TABLE users ADD COLUMN reset_token_expires INTEGER").run();
} catch (e) {
    // Column already exists
}


db.prepare(`
    CREATE TABLE IF NOT EXISTS aptitude_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        topic TEXT,
        level TEXT,
        question TEXT,
        user_answer TEXT,
        correct_answer TEXT,
        is_correct INTEGER,
        explanation TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS english_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        input_text TEXT,
        result TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS interview_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        role TEXT,
        question TEXT,
        answer TEXT,
        feedback TEXT,
        score REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS user_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT UNIQUE,
        streak INTEGER DEFAULT 1,
        completed_topics TEXT DEFAULT '[]',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS english_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT UNIQUE,
        score INTEGER DEFAULT 0,
        completed_count INTEGER DEFAULT 0,
        last_activity TEXT DEFAULT 'None',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS aptitude_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT UNIQUE,
        score INTEGER DEFAULT 0,
        completed_count INTEGER DEFAULT 0,
        correct_count INTEGER DEFAULT 0,
        last_activity TEXT DEFAULT 'None',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS interview_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT UNIQUE,
        score INTEGER DEFAULT 0,
        completed_count INTEGER DEFAULT 0,
        last_role TEXT DEFAULT 'General',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

// Initialize Progress Service
const ProgressService = require("./services/progressService");
const progressService = new ProgressService(db);

// Optional MongoDB Connection if MONGO_URI is set
if (process.env.MONGO_URI) {
    const mongoose = require("mongoose");
    mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 3000 })
        .then(() => console.log("MongoDB Connected Successfully 🍃"))
        .catch(err => console.log("MongoDB Connection Note: Falling back to SQLite:", err.message));
}

// ================= AUTHENTICATION & STATIC =================

app.use("/api/auth", createAuthRoutes(db));

// Modular Dashboard and Progress Routes
const createDashboardRoutes = require("./routes/dashboardRoutes");
const createEnglishRoutes = require("./routes/englishRoutes");
const createAptitudeRoutes = require("./routes/aptitudeRoutes");
const createInterviewRoutes = require("./routes/interviewRoutes");

app.use("/api/dashboard", createDashboardRoutes(progressService, db));
app.use("/api/english", createEnglishRoutes(progressService));
app.use("/api/aptitude", createAptitudeRoutes(progressService));
app.use("/api/interview", createInterviewRoutes(progressService));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, "..")));

// ================= BASIC =================

app.get("/", (req, res) => {
    if (req.accepts("html")) {
        return res.sendFile(path.join(__dirname, "..", "index.html.html"));
    }
    res.json({
        success: true,
        message: "CareerSense AI Backend is Running 🚀"
    });
});

app.get("/api/test", (req, res) => {
    const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all();

    res.json({
        success: true,
        message: "Backend + SQLite connected successfully ✅",
        tables
    });
});

// ================= ENGLISH TRANSLATION =================

app.post("/api/english/translate", async (req, res) => {

    try {

        const { text, targetLanguage = "English" } = req.body;

        if (!text) {
            return res.status(400).json({
                success: false,
                message: "Text is required"
            });
        }

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({
                success: false,
                message: "OPENAI_API_KEY is missing in .env"
            });
        }

        const OpenAI = require("openai");

        const client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        const response = await client.responses.create({
            model: "gpt-5.6-luna",
            input: `Translate the following text into ${targetLanguage}.
Give only the translation.

Text:
${text}`
        });

        const translation = response.output_text;

        res.json({
            success: true,
            original: text,
            translation
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Translation failed",
            error: error.message
        });
    }
});

// ================= APTITUDE QUESTION GENERATION =================

app.post("/api/aptitude/generate", async (req, res) => {

    try {

        const {
            topic = "Percentages",
            level = "Beginner"
        } = req.body;

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({
                success: false,
                message: "OPENAI_API_KEY is missing in .env"
            });
        }

        const OpenAI = require("openai");

        const client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        const response = await client.responses.create({
            model: "gpt-5.6-luna",
            input: `
Generate one ${level} aptitude question on ${topic}.

Return ONLY valid JSON in this exact structure:

{
  "question": "question text",
  "options": ["A", "B", "C", "D"],
  "correctAnswer": "A",
  "explanation": "short simple explanation"
}

Do not use markdown.
`
        });

        let result;

        try {
            result = JSON.parse(response.output_text);
        } catch {
            return res.status(500).json({
                success: false,
                message: "AI returned invalid JSON",
                raw: response.output_text
            });
        }

        res.json({
            success: true,
            topic,
            level,
            question: result
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Question generation failed",
            error: error.message
        });
    }
});

// ================= APTITUDE ANSWER =================

app.post("/api/aptitude/answer", (req, res) => {

    const {
        userId = null,
        topic,
        level,
        question,
        userAnswer,
        correctAnswer,
        explanation
    } = req.body;

    const isCorrect =
        String(userAnswer).trim().toLowerCase() ===
        String(correctAnswer).trim().toLowerCase();

    db.prepare(`
        INSERT INTO aptitude_results
        (
            user_id,
            topic,
            level,
            question,
            user_answer,
            correct_answer,
            is_correct,
            explanation
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        userId,
        topic,
        level,
        question,
        userAnswer,
        correctAnswer,
        isCorrect ? 1 : 0,
        explanation
    );

    if (userId) {
        try {
            progressService.updateAptitudeProgress(userId, {
                topic: topic || "General Aptitude",
                isCorrect,
                scoreGain: 5
            });
        } catch (err) {
            console.error("Progress update error:", err);
        }
    }

    res.json({
        success: true,
        correct: isCorrect,
        message: isCorrect ? "Correct answer 🎯" : "Wrong answer",
        explanation
    });
});

// ================= INTERVIEW QUESTION =================

app.post("/api/interview/question", async (req, res) => {

    try {

        const {
            role = "Software Developer",
            type = "HR",
            difficulty = "Beginner"
        } = req.body;

        const OpenAI = require("openai");

        const client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        const response = await client.responses.create({
            model: "gpt-5.6-luna",
            input: `
Generate one ${difficulty} ${type} interview question
for a ${role} candidate.

Return only the question.
`
        });

        res.json({
            success: true,
            role,
            type,
            difficulty,
            question: response.output_text
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: "Interview question generation failed",
            error: error.message
        });
    }
});

// ================= DASHBOARD =================

app.get("/api/dashboard/:userId", (req, res) => {

    const userId = req.params.userId;

    const aptitude = db.prepare(`
        SELECT
        COUNT(*) AS total,
        SUM(is_correct) AS correct
        FROM aptitude_results
        WHERE user_id = ?
    `).get(userId);

    const english = db.prepare(`
        SELECT COUNT(*) AS total
        FROM english_results
        WHERE user_id = ?
    `).get(userId);

    const interviews = db.prepare(`
        SELECT COUNT(*) AS total
        FROM interview_results
        WHERE user_id = ?
    `).get(userId);

    res.json({
        success: true,
        aptitude,
        english,
        interviews
    });
});

// ================= SERVER =================

app.listen(PORT, () => {

    console.log("=================================");
    console.log("CareerSense AI Backend 🚀");
    console.log(`Server: http://localhost:${PORT}`);
    console.log("SQLite Database Connected ✅");
    console.log("=================================");

});