const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const db = new sqlite3.Database(
    path.join(__dirname, "skillbridge.db"),
    (err) => {
        if (err) {
            console.error("Database connection failed:", err.message);
        } else {
            console.log("SkillBridge database connected ✅");
        }
    }
);


// ============================================================
// DATABASE TABLES
// ============================================================

db.serialize(() => {

    // ===============================
    // USERS
    // ===============================

    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'student',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);


    // ===============================
    // STUDENT PROFILES
    // ===============================

    db.run(`
        CREATE TABLE IF NOT EXISTS profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE,
            phone TEXT,
            location TEXT,
            degree TEXT,
            specialization TEXT,
            college TEXT,
            graduation_year INTEGER,
            target_career TEXT,
            preferred_industry TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);


    // ===============================
    // STUDENT SKILLS
    // ===============================

    db.run(`
        CREATE TABLE IF NOT EXISTS skills (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            skill_name TEXT NOT NULL,
            skill_score INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);


    // ===============================
    // OPPORTUNITIES
    // ===============================

    db.run(`
        CREATE TABLE IF NOT EXISTS opportunities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            company TEXT NOT NULL,
            location TEXT,
            skills TEXT,
            duration TEXT,
            type TEXT
        )
    `);


    // ===============================
    // COURSES
    // ===============================

    db.run(`
        CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT,
            level TEXT,
            duration TEXT
        )
    `);


    // ===============================
    // FACULTY
    // ===============================

    db.run(`
        CREATE TABLE IF NOT EXISTS faculty (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE,
            department TEXT,
            designation TEXT,
            college TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);


    // ===============================
    // ASSESSMENTS
    // ===============================

    db.run(`
        CREATE TABLE IF NOT EXISTS assessments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            faculty_id INTEGER,
            title TEXT NOT NULL,
            skill TEXT NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (faculty_id) REFERENCES faculty(id)
        )
    `);


    // ===============================
    // ASSESSMENT QUESTIONS
    // ===============================

    db.run(`
        CREATE TABLE IF NOT EXISTS assessment_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            assessment_id INTEGER NOT NULL,
            question TEXT NOT NULL,
            option_a TEXT NOT NULL,
            option_b TEXT NOT NULL,
            option_c TEXT NOT NULL,
            option_d TEXT NOT NULL,
            correct_answer TEXT NOT NULL,
            FOREIGN KEY (assessment_id)
                REFERENCES assessments(id)
        )
    `);


    // ===============================
    // ASSESSMENT RESULTS
    // ===============================

    db.run(`
        CREATE TABLE IF NOT EXISTS assessment_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            assessment_id INTEGER,
            student_id INTEGER,
            score INTEGER DEFAULT 0,
            FOREIGN KEY (assessment_id)
                REFERENCES assessments(id),
            FOREIGN KEY (student_id)
                REFERENCES users(id)
        )
    `);


    // ===============================
    // COURSE RECOMMENDATIONS
    // ===============================

    db.run(`
        CREATE TABLE IF NOT EXISTS course_recommendations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            faculty_id INTEGER,
            student_id INTEGER,
            course_id INTEGER,
            message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (faculty_id)
                REFERENCES faculty(id),
            FOREIGN KEY (student_id)
                REFERENCES users(id),
            FOREIGN KEY (course_id)
                REFERENCES courses(id)
        )
    `);

});


// ============================================================
// DEFAULT SKILLS
// ============================================================

db.serialize(() => {

    db.get(
        "SELECT id FROM users ORDER BY id LIMIT 1",
        (err, user) => {

            if (err || !user) {
                return;
            }

            const skills = [
                ["Java", 80],
                ["HTML & CSS", 75],
                ["Python", 65],
                ["JavaScript", 60],
                ["Machine Learning", 45]
            ];

            skills.forEach(([name, score]) => {

                db.run(
                    `INSERT INTO skills
                    (user_id, skill_name, skill_score)
                    SELECT ?, ?, ?
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM skills
                        WHERE user_id = ?
                        AND skill_name = ?
                    )`,
                    [
                        user.id,
                        name,
                        score,
                        user.id,
                        name
                    ]
                );

            });

        }
    );

});


// ============================================================
// DEFAULT OPPORTUNITIES
// ============================================================

db.serialize(() => {

    const opportunities = [

        [
            "Web Development Intern",
            "Technology Company",
            "Remote",
            "HTML • CSS • JavaScript",
            "3 Months",
            "Internship"
        ],

        [
            "AI / ML Intern",
            "AI Solutions Company",
            "Hybrid",
            "Python • Machine Learning",
            "6 Months",
            "Internship"
        ],

        [
            "Software Developer",
            "Software Solutions",
            "Bangalore",
            "Java • DSA",
            "Full Time",
            "Entry Level"
        ],

        [
            "Python Developer Intern",
            "Digital Technology Company",
            "Remote",
            "Python • SQL",
            "4 Months",
            "Internship"
        ]

    ];


    opportunities.forEach(opportunity => {

        db.run(
            `INSERT INTO opportunities
            (
                title,
                company,
                location,
                skills,
                duration,
                type
            )
            SELECT ?, ?, ?, ?, ?, ?
            WHERE NOT EXISTS (
                SELECT 1
                FROM opportunities
                WHERE title = ?
                AND company = ?
            )`,
            [
                opportunity[0],
                opportunity[1],
                opportunity[2],
                opportunity[3],
                opportunity[4],
                opportunity[5],
                opportunity[0],
                opportunity[1]
            ]
        );

    });

});


// ============================================================
// DEFAULT COURSES
// ============================================================

db.serialize(() => {

    const courses = [

        [
            "Java Fundamentals",
            "PROGRAMMING",
            "Beginner",
            "8 Weeks"
        ],

        [
            "Modern Web Development",
            "WEB DEVELOPMENT",
            "Beginner",
            "6 Weeks"
        ],

        [
            "Python for AI",
            "ARTIFICIAL INTELLIGENCE",
            "Beginner",
            "7 Weeks"
        ],

        [
            "Machine Learning Basics",
            "MACHINE LEARNING",
            "Intermediate",
            "10 Weeks"
        ]

    ];


    courses.forEach(course => {

        db.run(
            `INSERT INTO courses
            (
                title,
                category,
                level,
                duration
            )
            SELECT ?, ?, ?, ?
            WHERE NOT EXISTS (
                SELECT 1
                FROM courses
                WHERE title = ?
            )`,
            [
                course[0],
                course[1],
                course[2],
                course[3],
                course[0]
            ]
        );

    });

});


// ============================================================
// EXPORT DATABASE
// ============================================================

module.exports = db;