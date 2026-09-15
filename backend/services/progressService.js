const mongoose = require("mongoose");
const Progress = require("../models/Progress");
const EnglishProgress = require("../models/EnglishProgress");
const AptitudeProgress = require("../models/AptitudeProgress");
const InterviewProgress = require("../models/InterviewProgress");

function isMongoConnected() {
    return mongoose.connection && mongoose.connection.readyState === 1;
}

function calculateOverallScore(englishScore, aptitudeScore, interviewScore) {
    // Weighted average: English 35%, Aptitude 35%, Interview 30%
    const score = Math.round(
        (englishScore * 0.35) + (aptitudeScore * 0.35) + (interviewScore * 0.30)
    );
    return Math.min(Math.max(score, 0), 100);
}

function generateRecommendation(englishScore, aptitudeScore, interviewScore, completedCount) {
    if (completedCount === 0) {
        return {
            title: "Begin with your first module",
            text: "Practice English conversation, solve aptitude questions, or try a mock interview to establish your readiness score."
        };
    }

    const lowest = Math.min(englishScore, aptitudeScore, interviewScore);
    if (lowest === englishScore) {
        return {
            title: "Improve English Communication",
            text: "Focus on vocabulary variety and daily practice sentences to elevate your communication score."
        };
    } else if (lowest === aptitudeScore) {
        return {
            title: "Strengthen Aptitude Problem Solving",
            text: "Practice percentage, ratio, and speed math questions to boost your analytical readiness."
        };
    } else {
        return {
            title: "Refine Interview Responses",
            text: "Practice HR and technical interview questions with concise examples using the STAR method."
        };
    }
}

class ProgressService {
    constructor(sqliteDb) {
        this.db = sqliteDb;
    }

    // ================= GET FULL DASHBOARD DATA =================
    async getDashboardData(userId, userMeta = {}) {
        const uid = String(userId);

        if (isMongoConnected()) {
            let [overall, english, aptitude, interview] = await Promise.all([
                Progress.findOne({ userId: uid }),
                EnglishProgress.findOne({ userId: uid }),
                AptitudeProgress.findOne({ userId: uid }),
                InterviewProgress.findOne({ userId: uid })
            ]);

            const engScore = english ? english.score : 0;
            const aptScore = aptitude ? aptitude.score : 0;
            const intScore = interview ? interview.score : 0;
            const totalCompleted = (english ? english.completedCount : 0) +
                                   (aptitude ? aptitude.completedCount : 0) +
                                   (interview ? interview.completedCount : 0);

            const calculatedOverall = calculateOverallScore(engScore, aptScore, intScore);
            const rec = generateRecommendation(engScore, aptScore, intScore, totalCompleted);

            return {
                user: {
                    id: uid,
                    name: userMeta.name || "User",
                    email: userMeta.email || ""
                },
                progress: {
                    overallScore: calculatedOverall,
                    streak: overall ? overall.streak : 1,
                    recommendedFocus: rec,
                    completedTopics: overall ? overall.completedTopics : [],
                    totalCompletedActivities: totalCompleted
                },
                english: {
                    score: engScore,
                    completedCount: english ? english.completedCount : 0,
                    lastActivity: english ? english.lastActivity : "None"
                },
                aptitude: {
                    score: aptScore,
                    completedCount: aptitude ? aptitude.completedCount : 0,
                    correctCount: aptitude ? aptitude.correctCount : 0,
                    lastActivity: aptitude ? aptitude.lastActivity : "None"
                },
                interview: {
                    score: intScore,
                    completedCount: interview ? interview.completedCount : 0,
                    lastRole: interview ? interview.lastRole : "General"
                }
            };
        }

        // ---------- SQLite Implementation ----------
        let engRow = this.db.prepare("SELECT * FROM english_progress WHERE user_id = ?").get(uid);
        let aptRow = this.db.prepare("SELECT * FROM aptitude_progress WHERE user_id = ?").get(uid);
        let intRow = this.db.prepare("SELECT * FROM interview_progress WHERE user_id = ?").get(uid);
        let overallRow = this.db.prepare("SELECT * FROM user_progress WHERE user_id = ?").get(uid);

        const engScore = engRow ? engRow.score : 0;
        const aptScore = aptRow ? aptRow.score : 0;
        const intScore = intRow ? intRow.score : 0;
        const totalCompleted = (engRow ? engRow.completed_count : 0) +
                               (aptRow ? aptRow.completed_count : 0) +
                               (intRow ? intRow.completed_count : 0);

        const calculatedOverall = calculateOverallScore(engScore, aptScore, intScore);
        const rec = generateRecommendation(engScore, aptScore, intScore, totalCompleted);

        let completedTopics = [];
        if (overallRow && overallRow.completed_topics) {
            try {
                completedTopics = JSON.parse(overallRow.completed_topics);
            } catch {
                completedTopics = [];
            }
        }

        return {
            user: {
                id: uid,
                name: userMeta.name || "User",
                email: userMeta.email || ""
            },
            progress: {
                overallScore: calculatedOverall,
                streak: overallRow ? overallRow.streak : 1,
                recommendedFocus: rec,
                completedTopics: completedTopics,
                totalCompletedActivities: totalCompleted
            },
            english: {
                score: engScore,
                completedCount: engRow ? engRow.completed_count : 0,
                lastActivity: engRow ? engRow.last_activity : "None"
            },
            aptitude: {
                score: aptScore,
                completedCount: aptRow ? aptRow.completed_count : 0,
                correctCount: aptRow ? aptRow.correct_count : 0,
                lastActivity: aptRow ? aptRow.last_activity : "None"
            },
            interview: {
                score: intScore,
                completedCount: intRow ? intRow.completed_count : 0,
                lastRole: intRow ? intRow.last_role : "General"
            }
        };
    }

    // ================= ENGLISH PROGRESS =================
    async updateEnglishProgress(userId, { activityName = "English Practice", scoreGain = 5 }) {
        const uid = String(userId);

        if (isMongoConnected()) {
            let doc = await EnglishProgress.findOne({ userId: uid });
            if (!doc) {
                doc = new EnglishProgress({ userId: uid, score: 0, completedCount: 0 });
            }
            doc.completedCount += 1;
            doc.score = Math.min(100, Math.max(0, doc.score + scoreGain));
            doc.lastActivity = activityName;
            doc.updatedAt = new Date();
            await doc.save();
            await this._recordTopicCompleted(uid, `English: ${activityName}`);
            return doc;
        }

        let row = this.db.prepare("SELECT * FROM english_progress WHERE user_id = ?").get(uid);
        if (!row) {
            this.db.prepare(`
                INSERT INTO english_progress (user_id, score, completed_count, last_activity)
                VALUES (?, ?, ?, ?)
            `).run(uid, Math.min(100, scoreGain), 1, activityName);
        } else {
            const newScore = Math.min(100, Math.max(0, row.score + scoreGain));
            this.db.prepare(`
                UPDATE english_progress
                SET score = ?, completed_count = completed_count + 1, last_activity = ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
            `).run(newScore, activityName, uid);
        }

        await this._recordTopicCompleted(uid, `English: ${activityName}`);
        return this.db.prepare("SELECT * FROM english_progress WHERE user_id = ?").get(uid);
    }

    // ================= APTITUDE PROGRESS =================
    async updateAptitudeProgress(userId, { topic = "Aptitude Question", isCorrect = true, scoreGain = 5 }) {
        const uid = String(userId);

        if (isMongoConnected()) {
            let doc = await AptitudeProgress.findOne({ userId: uid });
            if (!doc) {
                doc = new AptitudeProgress({ userId: uid, score: 0, completedCount: 0, correctCount: 0 });
            }
            doc.completedCount += 1;
            if (isCorrect) doc.correctCount += 1;
            const gain = isCorrect ? scoreGain : 1;
            doc.score = Math.min(100, Math.max(0, doc.score + gain));
            doc.lastActivity = topic;
            doc.updatedAt = new Date();
            await doc.save();
            await this._recordTopicCompleted(uid, `Aptitude: ${topic}`);
            return doc;
        }

        let row = this.db.prepare("SELECT * FROM aptitude_progress WHERE user_id = ?").get(uid);
        if (!row) {
            const gain = isCorrect ? scoreGain : 1;
            this.db.prepare(`
                INSERT INTO aptitude_progress (user_id, score, completed_count, correct_count, last_activity)
                VALUES (?, ?, ?, ?, ?)
            `).run(uid, Math.min(100, gain), 1, isCorrect ? 1 : 0, topic);
        } else {
            const gain = isCorrect ? scoreGain : 1;
            const newScore = Math.min(100, Math.max(0, row.score + gain));
            const newCorrect = row.correct_count + (isCorrect ? 1 : 0);
            this.db.prepare(`
                UPDATE aptitude_progress
                SET score = ?, completed_count = completed_count + 1, correct_count = ?, last_activity = ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
            `).run(newScore, newCorrect, topic, uid);
        }

        await this._recordTopicCompleted(uid, `Aptitude: ${topic}`);
        return this.db.prepare("SELECT * FROM aptitude_progress WHERE user_id = ?").get(uid);
    }

    // ================= INTERVIEW PROGRESS =================
    async updateInterviewProgress(userId, { role = "Software Developer", scoreGain = 6 }) {
        const uid = String(userId);

        if (isMongoConnected()) {
            let doc = await InterviewProgress.findOne({ userId: uid });
            if (!doc) {
                doc = new InterviewProgress({ userId: uid, score: 0, completedCount: 0 });
            }
            doc.completedCount += 1;
            doc.score = Math.min(100, Math.max(0, doc.score + scoreGain));
            doc.lastRole = role;
            doc.updatedAt = new Date();
            await doc.save();
            await this._recordTopicCompleted(uid, `Interview: ${role}`);
            return doc;
        }

        let row = this.db.prepare("SELECT * FROM interview_progress WHERE user_id = ?").get(uid);
        if (!row) {
            this.db.prepare(`
                INSERT INTO interview_progress (user_id, score, completed_count, last_role)
                VALUES (?, ?, ?, ?)
            `).run(uid, Math.min(100, scoreGain), 1, role);
        } else {
            const newScore = Math.min(100, Math.max(0, row.score + scoreGain));
            this.db.prepare(`
                UPDATE interview_progress
                SET score = ?, completed_count = completed_count + 1, last_role = ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
            `).run(newScore, role, uid);
        }

        await this._recordTopicCompleted(uid, `Interview: ${role}`);
        return this.db.prepare("SELECT * FROM interview_progress WHERE user_id = ?").get(uid);
    }

    // ================= HELPER: RECORD COMPLETED TOPIC =================
    async _recordTopicCompleted(userId, topicName) {
        const uid = String(userId);

        if (isMongoConnected()) {
            let progress = await Progress.findOne({ userId: uid });
            if (!progress) {
                progress = new Progress({ userId: uid, completedTopics: [topicName] });
            } else if (!progress.completedTopics.includes(topicName)) {
                progress.completedTopics.push(topicName);
                if (progress.completedTopics.length > 20) {
                    progress.completedTopics.shift();
                }
            }
            progress.updatedAt = new Date();
            await progress.save();
            return;
        }

        let row = this.db.prepare("SELECT * FROM user_progress WHERE user_id = ?").get(uid);
        if (!row) {
            this.db.prepare(`
                INSERT INTO user_progress (user_id, streak, completed_topics)
                VALUES (?, ?, ?)
            `).run(uid, 1, JSON.stringify([topicName]));
        } else {
            let topics = [];
            try {
                topics = JSON.parse(row.completed_topics || "[]");
            } catch {
                topics = [];
            }
            if (!topics.includes(topicName)) {
                topics.push(topicName);
                if (topics.length > 20) topics.shift();
                this.db.prepare(`
                    UPDATE user_progress
                    SET completed_topics = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ?
                `).run(JSON.stringify(topics), uid);
            }
        }
    }
}

module.exports = ProgressService;
