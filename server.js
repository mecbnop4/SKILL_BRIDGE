const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const path = require("path");

const db = require("./database");

const app = express();
const PORT = 3000;

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "..")));


// ============================================================
// HOME
// ============================================================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "index.html"));
});


// ============================================================
// AUTHENTICATION
// ============================================================

// ============================================================
// SIGNUP
// ============================================================

app.post("/api/auth/signup", async (req, res) => {

    try {

        const {
            name,
            email,
            password,
            role,
            department,
            designation,
            college
        } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Name, email and password are required."
            });
        }

        const allowedRoles = [
            "student",
            "faculty",
            "university",
            "industry"
        ];

        const userRole = allowedRoles.includes(role)
            ? role
            : "student";

        const hashedPassword = await bcrypt.hash(password, 10);

        const sql = `
            INSERT INTO users
            (name, email, password, role)
            VALUES (?, ?, ?, ?)
        `;

        db.run(
            sql,
            [
                name.trim(),
                email.trim().toLowerCase(),
                hashedPassword,
                userRole
            ],
            function (err) {

                if (err) {

                    console.error("Signup error:", err.message);

                    if (
                        err.message.includes(
                            "UNIQUE constraint failed"
                        )
                    ) {
                        return res.status(400).json({
                            message:
                                "An account with this email already exists."
                        });
                    }

                    return res.status(500).json({
                        message:
                            "Failed to create account."
                    });
                }

                const userId = this.lastID;

                // ------------------------------------------------
                // FACULTY PROFILE
                // ------------------------------------------------

                if (userRole === "faculty") {

                    const facultySql = `
                        INSERT INTO faculty
                        (
                            user_id,
                            department,
                            designation,
                            college
                        )
                        VALUES (?, ?, ?, ?)
                    `;

                    db.run(
                        facultySql,
                        [
                            userId,
                            department || "",
                            designation || "",
                            college || ""
                        ],
                        (facultyErr) => {

                            if (facultyErr) {

                                console.error(
                                    "Faculty profile creation error:",
                                    facultyErr.message
                                );

                                return res.status(500).json({
                                    message:
                                        "Account created but faculty profile could not be created."
                                });
                            }

                            return res.status(201).json({
                                message:
                                    "Faculty account created successfully!",
                                user: {
                                    id: userId,
                                    name,
                                    email,
                                    role: userRole
                                }
                            });

                        }
                    );

                } else {

                    return res.status(201).json({
                        message:
                            "Account created successfully!",
                        user: {
                            id: userId,
                            name,
                            email,
                            role: userRole
                        }
                    });

                }

            }
        );

    } catch (error) {

        console.error(
            "Signup server error:",
            error
        );

        res.status(500).json({
            message:
                "Server error during signup."
        });
    }

});


// ============================================================
// LOGIN
// ============================================================

app.post("/api/auth/login", (req, res) => {

    const {
        email,
        password,
        role
    } = req.body;

    if (!email || !password) {

        return res.status(400).json({
            message:
                "Email and password are required."
        });

    }

    const sql = `
        SELECT *
        FROM users
        WHERE email = ?
    `;

    db.get(
        sql,
        [email.trim().toLowerCase()],
        async (err, user) => {

            if (err) {

                console.error(
                    "Login error:",
                    err.message
                );

                return res.status(500).json({
                    message:
                        "Login failed."
                });

            }

            if (!user) {

                return res.status(401).json({
                    message:
                        "Invalid email or password."
                });

            }

            const passwordMatch =
                await bcrypt.compare(
                    password,
                    user.password
                );

            if (!passwordMatch) {

                return res.status(401).json({
                    message:
                        "Invalid email or password."
                });

            }

            // Selected role must match account role
            if (role && role !== user.role) {

                return res.status(403).json({
                    message:
                        `This account is registered as ${user.role}. Please select the correct role.`
                });

            }

            res.json({
                message:
                    "Login successful!",
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            });

        }
    );

});


// ============================================================
// STUDENT PROFILE
// ============================================================

// GET STUDENT PROFILE

app.get("/api/profile/:userId", (req, res) => {

    const userId = req.params.userId;

    const sql = `
        SELECT
            users.id,
            users.name,
            users.email,
            profiles.phone,
            profiles.location,
            profiles.degree,
            profiles.specialization,
            profiles.college,
            profiles.graduation_year,
            profiles.target_career,
            profiles.preferred_industry
        FROM users
        LEFT JOIN profiles
            ON users.id = profiles.user_id
        WHERE users.id = ?
    `;

    db.get(
        sql,
        [userId],
        (err, row) => {

            if (err) {

                console.error(
                    "Profile fetch error:",
                    err.message
                );

                return res.status(500).json({
                    message:
                        "Failed to fetch profile."
                });

            }

            if (!row) {

                return res.status(404).json({
                    message:
                        "Profile not found."
                });

            }

            res.json(row);

        }
    );

});


// UPDATE STUDENT PROFILE

app.put("/api/profile/:userId", (req, res) => {

    const userId = req.params.userId;

    const {
        name,
        email,
        phone,
        location,
        degree,
        specialization,
        college,
        graduation_year,
        target_career,
        preferred_industry
    } = req.body;

    if (!name || !email) {

        return res.status(400).json({
            message:
                "Name and email are required."
        });

    }

    const updateUserSql = `
        UPDATE users
        SET
            name = ?,
            email = ?
        WHERE id = ?
    `;

    db.run(
        updateUserSql,
        [
            name.trim(),
            email.trim().toLowerCase(),
            userId
        ],
        function (userErr) {

            if (userErr) {

                console.error(
                    "Student user update error:",
                    userErr.message
                );

                if (
                    userErr.message.includes(
                        "UNIQUE constraint failed"
                    )
                ) {
                    return res.status(400).json({
                        message:
                            "That email is already being used."
                    });
                }

                return res.status(500).json({
                    message:
                        "Failed to update account."
                });

            }

            const updateProfileSql = `
                INSERT INTO profiles
                (
                    user_id,
                    phone,
                    location,
                    degree,
                    specialization,
                    college,
                    graduation_year,
                    target_career,
                    preferred_industry
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)

                ON CONFLICT(user_id)
                DO UPDATE SET
                    phone = excluded.phone,
                    location = excluded.location,
                    degree = excluded.degree,
                    specialization = excluded.specialization,
                    college = excluded.college,
                    graduation_year = excluded.graduation_year,
                    target_career = excluded.target_career,
                    preferred_industry = excluded.preferred_industry
            `;

            db.run(
                updateProfileSql,
                [
                    userId,
                    phone || "",
                    location || "",
                    degree || "",
                    specialization || "",
                    college || "",
                    graduation_year || null,
                    target_career || "",
                    preferred_industry || ""
                ],
                function (profileErr) {

                    if (profileErr) {

                        console.error(
                            "Student profile update error:",
                            profileErr.message
                        );

                        return res.status(500).json({
                            message:
                                "Failed to update profile."
                        });

                    }

                    res.json({
                        message:
                            "Profile saved successfully!"
                    });

                }
            );

        }
    );

});


// ============================================================
// SKILLS
// ============================================================

app.get("/api/skills/:userId", (req, res) => {

    db.all(
        `
            SELECT *
            FROM skills
            WHERE user_id = ?
        `,
        [req.params.userId],
        (err, rows) => {

            if (err) {

                return res.status(500).json({
                    message:
                        "Failed to fetch skills."
                });

            }

            res.json(rows);

        }
    );

});


// ============================================================
// OPPORTUNITIES
// ============================================================

app.get("/api/opportunities", (req, res) => {

    db.all(
        `
            SELECT *
            FROM opportunities
        `,
        [],
        (err, rows) => {

            if (err) {

                return res.status(500).json({
                    message:
                        "Failed to fetch opportunities."
                });

            }

            res.json(rows);

        }
    );

});


// ============================================================
// COURSES
// ============================================================

app.get("/api/courses", (req, res) => {

    db.all(
        `
            SELECT *
            FROM courses
        `,
        [],
        (err, rows) => {

            if (err) {

                return res.status(500).json({
                    message:
                        "Failed to fetch courses."
                });

            }

            res.json(rows);

        }
    );

});


// ============================================================
// SKILL GAPS
// ============================================================

app.get("/api/skill-gaps/:userId", (req, res) => {

    const userId = req.params.userId;

    db.all(
        `
            SELECT
                skill_name,
                skill_score
            FROM skills
            WHERE user_id = ?
        `,
        [userId],
        (err, rows) => {

            if (err) {

                console.error(
                    "Skill gap error:",
                    err.message
                );

                return res.status(500).json({
                    message:
                        "Failed to calculate skill gaps."
                });

            }

            const gaps = rows.map(skill => ({

                skill:
                    skill.skill_name,

                score:
                    skill.skill_score,

                gap:
                    Math.max(
                        0,
                        100 - skill.skill_score
                    )

            }));

            res.json(gaps);

        }
    );

});


// ============================================================
// COURSE RECOMMENDATIONS
// ============================================================

app.get(
    "/api/recommendations/:userId",
    (req, res) => {

        db.all(
            `
                SELECT *
                FROM courses
                ORDER BY id
            `,
            [],
            (err, rows) => {

                if (err) {

                    return res.status(500).json({
                        message:
                            "Failed to fetch recommendations."
                    });

                }

                res.json(rows);

            }
        );

    }
);


// ============================================================
// FACULTY
// ============================================================

// ============================================================
// FACULTY STATS
// ============================================================

app.get("/api/faculty/stats", (req, res) => {

    const totalStudentsSql = `
        SELECT COUNT(*) AS total_students
        FROM users
        WHERE role = 'student'
    `;

    const averageSkillSql = `
        SELECT
            ROUND(AVG(skill_score)) AS average_skill_score
        FROM skills
    `;

    const skillGapsSql = `
        SELECT COUNT(*) AS skill_gaps
        FROM skills
        WHERE skill_score < 70
    `;

    const careerReadySql = `
        SELECT COUNT(DISTINCT user_id)
        AS career_ready_students
        FROM skills
        WHERE skill_score >= 80
    `;

    db.get(
        totalStudentsSql,
        [],
        (err, students) => {

            if (err) {

                return res.status(500).json({
                    message:
                        "Failed to fetch student statistics."
                });

            }

            db.get(
                averageSkillSql,
                [],
                (err, average) => {

                    if (err) {

                        return res.status(500).json({
                            message:
                                "Failed to fetch skill statistics."
                        });

                    }

                    db.get(
                        skillGapsSql,
                        [],
                        (err, gaps) => {

                            if (err) {

                                return res.status(500).json({
                                    message:
                                        "Failed to fetch skill gap statistics."
                                });

                            }

                            db.get(
                                careerReadySql,
                                [],
                                (err, ready) => {

                                    if (err) {

                                        return res.status(500).json({
                                            message:
                                                "Failed to fetch career-ready statistics."
                                        });

                                    }

                                    const total =
                                        students.total_students || 0;

                                    const readyCount =
                                        ready.career_ready_students || 0;

                                    const percentage =
                                        total > 0
                                            ? Math.round(
                                                (readyCount / total) * 100
                                            )
                                            : 0;

                                    res.json({

                                        total_students:
                                            total,

                                        average_skill_score:
                                            average.average_skill_score || 0,

                                        skill_gaps:
                                            gaps.skill_gaps || 0,

                                        career_ready_students:
                                            readyCount,

                                        career_ready_percentage:
                                            percentage

                                    });

                                }
                            );

                        }
                    );

                }
            );

        }
    );

});


// ============================================================
// FACULTY STUDENTS
// ============================================================

app.get("/api/faculty/students", (req, res) => {

    const sql = `
        SELECT
            users.id,
            users.name,
            users.email,

            COALESCE(
                ROUND(AVG(skills.skill_score)),
                0
            ) AS average_score

        FROM users

        LEFT JOIN skills
            ON users.id = skills.user_id

        WHERE users.role = 'student'

        GROUP BY users.id

        ORDER BY users.name
    `;

    db.all(
        sql,
        [],
        (err, rows) => {

            if (err) {

                console.error(
                    "Faculty students error:",
                    err.message
                );

                return res.status(500).json({
                    message:
                        "Failed to fetch students."
                });

            }

            res.json(rows);

        }
    );

});


// ============================================================
// SINGLE STUDENT
// ============================================================

app.get(
    "/api/faculty/students/:studentId",
    (req, res) => {

        const studentId =
            req.params.studentId;

        const sql = `
            SELECT
                users.id,
                users.name,
                users.email,

                profiles.phone,
                profiles.location,
                profiles.degree,
                profiles.specialization,
                profiles.college,
                profiles.graduation_year,
                profiles.target_career,
                profiles.preferred_industry

            FROM users

            LEFT JOIN profiles
                ON users.id = profiles.user_id

            WHERE users.id = ?
            AND users.role = 'student'
        `;

        db.get(
            sql,
            [studentId],
            (err, row) => {

                if (err) {

                    return res.status(500).json({
                        message:
                            "Failed to fetch student."
                    });

                }

                if (!row) {

                    return res.status(404).json({
                        message:
                            "Student not found."
                    });

                }

                res.json(row);

            }
        );

    }
);


// ============================================================
// FACULTY PERFORMANCE
// ============================================================

app.get(
    "/api/faculty/performance",
    (req, res) => {

        const sql = `
            SELECT
                skill_name,
                ROUND(AVG(skill_score)) AS average_score

            FROM skills

            GROUP BY skill_name

            ORDER BY average_score DESC
        `;

        db.all(
            sql,
            [],
            (err, rows) => {

                if (err) {

                    return res.status(500).json({
                        message:
                            "Failed to fetch performance."
                    });

                }

                res.json(rows);

            }
        );

    }
);


// ============================================================
// FACULTY SKILL GAPS
// ============================================================

app.get(
    "/api/faculty/skill-gaps",
    (req, res) => {

        const sql = `
            SELECT
                skill_name,
                ROUND(AVG(skill_score)) AS average_score

            FROM skills

            GROUP BY skill_name

            HAVING average_score < 70

            ORDER BY average_score ASC
        `;

        db.all(
            sql,
            [],
            (err, rows) => {

                if (err) {

                    return res.status(500).json({
                        message:
                            "Failed to fetch skill gaps."
                    });

                }

                const result =
                    rows.map(row => ({

                        skill:
                            row.skill_name,

                        score:
                            row.average_score,

                        gap:
                            100 - row.average_score

                    }));

                res.json(result);

            }
        );

    }
);


// ============================================================
// ASSESSMENTS
// ============================================================

// ============================================================
// CREATE ASSESSMENT
// ============================================================

app.post(
    "/api/faculty/assessments",
    (req, res) => {

        const {
            faculty_id,
            title,
            skill,
            description,
            questions
        } = req.body;

        if (
            !faculty_id ||
            !title ||
            !skill
        ) {

            return res.status(400).json({
                message:
                    "Faculty ID, title and skill are required."
            });

        }

        const insertAssessmentSql = `
            INSERT INTO assessments
            (
                faculty_id,
                title,
                skill,
                description
            )
            VALUES (?, ?, ?, ?)
        `;

        db.run(
            insertAssessmentSql,
            [
                faculty_id,
                title.trim(),
                skill.trim(),
                description || ""
            ],
            function (err) {

                if (err) {

                    console.error(
                        "Assessment creation error:",
                        err.message
                    );

                    return res.status(500).json({
                        message:
                            "Failed to create assessment."
                    });

                }

                const assessmentId = this.lastID;

                // ------------------------------------------------
                // INSERT QUESTIONS
                // ------------------------------------------------

                if (
                    !Array.isArray(questions) ||
                    questions.length === 0
                ) {

                    return res.status(201).json({
                        message:
                            "Assessment created successfully!",
                        assessment_id:
                            assessmentId
                    });

                }

                let completed = 0;
                let failed = false;

                questions.forEach(question => {

                    const questionSql = `
                        INSERT INTO assessment_questions
                        (
                            assessment_id,
                            question,
                            option_a,
                            option_b,
                            option_c,
                            option_d,
                            correct_answer
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `;

                    db.run(
                        questionSql,
                        [
                            assessmentId,
                            question.question || "",
                            question.option_a || "",
                            question.option_b || "",
                            question.option_c || "",
                            question.option_d || "",
                            question.correct_answer || ""
                        ],
                        questionErr => {

                            if (failed) return;

                            if (questionErr) {

                                failed = true;

                                console.error(
                                    "Question insertion error:",
                                    questionErr.message
                                );

                                return res.status(500).json({
                                    message:
                                        "Assessment created but questions could not be saved."
                                });

                            }

                            completed++;

                            if (
                                completed ===
                                questions.length
                            ) {

                                res.status(201).json({

                                    message:
                                        "Assessment created successfully!",

                                    assessment_id:
                                        assessmentId,

                                    question_count:
                                        questions.length

                                });

                            }

                        }
                    );

                });

            }
        );

    }
);


// ============================================================
// GET ALL ASSESSMENTS
// ============================================================

app.get(
    "/api/faculty/assessments",
    (req, res) => {

        const sql = `
            SELECT
                assessments.*,
                faculty.user_id,
                users.name AS faculty_name

            FROM assessments

            LEFT JOIN faculty
                ON assessments.faculty_id = faculty.id

            LEFT JOIN users
                ON faculty.user_id = users.id

            ORDER BY assessments.created_at DESC
        `;

        db.all(
            sql,
            [],
            (err, rows) => {

                if (err) {

                    console.error(
                        "Assessment fetch error:",
                        err.message
                    );

                    return res.status(500).json({
                        message:
                            "Failed to fetch assessments."
                    });

                }

                res.json(rows);

            }
        );

    }
);


// ============================================================
// GET ONE ASSESSMENT WITH QUESTIONS
// ============================================================

app.get(
    "/api/faculty/assessments/:assessmentId",
    (req, res) => {

        const assessmentId =
            req.params.assessmentId;

        const assessmentSql = `
            SELECT
                assessments.*,
                users.name AS faculty_name

            FROM assessments

            LEFT JOIN faculty
                ON assessments.faculty_id = faculty.id

            LEFT JOIN users
                ON faculty.user_id = users.id

            WHERE assessments.id = ?
        `;

        db.get(
            assessmentSql,
            [assessmentId],
            (err, assessment) => {

                if (err) {

                    return res.status(500).json({
                        message:
                            "Failed to fetch assessment."
                    });

                }

                if (!assessment) {

                    return res.status(404).json({
                        message:
                            "Assessment not found."
                    });

                }

                const questionsSql = `
                    SELECT
                        id,
                        assessment_id,
                        question,
                        option_a,
                        option_b,
                        option_c,
                        option_d

                    FROM assessment_questions

                    WHERE assessment_id = ?

                    ORDER BY id
                `;

                db.all(
                    questionsSql,
                    [assessmentId],
                    (questionErr, questions) => {

                        if (questionErr) {

                            return res.status(500).json({
                                message:
                                    "Failed to fetch assessment questions."
                            });

                        }

                        res.json({
                            assessment,
                            questions
                        });

                    }
                );

            }
        );

    }
);


// ============================================================
// STUDENT ASSESSMENTS
// ============================================================

app.get(
    "/api/student/assessments",
    (req, res) => {

        const sql = `
            SELECT
                assessments.id,
                assessments.title,
                assessments.skill,
                assessments.description,
                assessments.created_at,
                users.name AS faculty_name

            FROM assessments

            LEFT JOIN faculty
                ON assessments.faculty_id = faculty.id

            LEFT JOIN users
                ON faculty.user_id = users.id

            ORDER BY assessments.created_at DESC
        `;

        db.all(
            sql,
            [],
            (err, rows) => {

                if (err) {

                    return res.status(500).json({
                        message:
                            "Failed to fetch student assessments."
                    });

                }

                res.json(rows);

            }
        );

    }
);


// ============================================================
// STUDENT TAKE ASSESSMENT
// ============================================================

// ============================================================
// STUDENT ASSESSMENTS
// ============================================================

app.get("/api/student/assessments", (req, res) => {

    const sql = `
        SELECT
            assessments.id,
            assessments.title,
            assessments.skill,
            assessments.description,
            assessments.created_at,
            users.name AS faculty_name,
            COUNT(assessment_questions.id) AS question_count

        FROM assessments

        LEFT JOIN faculty
            ON assessments.faculty_id = faculty.id

        LEFT JOIN users
            ON faculty.user_id = users.id

        LEFT JOIN assessment_questions
            ON assessments.id = assessment_questions.assessment_id

        GROUP BY
            assessments.id,
            assessments.title,
            assessments.skill,
            assessments.description,
            assessments.created_at,
            users.name

        ORDER BY assessments.created_at DESC
    `;

    db.all(sql, [], (err, rows) => {

        if (err) {

            console.error(
                "Student assessments error:",
                err.message
            );

            return res.status(500).json({
                message:
                    "Failed to fetch student assessments.",
                error:
                    err.message
            });

        }

        res.json(rows);

    });

});
// ============================================================
// GET SINGLE STUDENT ASSESSMENT
// ============================================================

app.get("/api/student/assessments/:assessmentId", (req, res) => {

    const assessmentId = req.params.assessmentId;

    const sql = `
        SELECT
            assessments.id,
            assessments.title,
            assessments.skill,
            assessments.description,
            assessments.created_at,
            users.name AS faculty_name
        FROM assessments
        LEFT JOIN faculty
            ON assessments.faculty_id = faculty.id
        LEFT JOIN users
            ON faculty.user_id = users.id
        WHERE assessments.id = ?
    `;

    db.get(sql, [assessmentId], (err, assessment) => {

        if (err) {
            console.error(
                "Student assessment detail error:",
                err.message
            );

            return res.status(500).json({
                message: "Failed to fetch assessment.",
                error: err.message
            });
        }

        if (!assessment) {
            return res.status(404).json({
                message: "Assessment not found."
            });
        }

        const questionSql = `
            SELECT
                id,
                question,
                option_a,
                option_b,
                option_c,
                option_d
            FROM assessment_questions
            WHERE assessment_id = ?
            ORDER BY id ASC
        `;

        db.all(
            questionSql,
            [assessmentId],
            (questionErr, questions) => {

                if (questionErr) {
                    console.error(
                        "Assessment questions error:",
                        questionErr.message
                    );

                    return res.status(500).json({
                        message: "Failed to fetch assessment questions.",
                        error: questionErr.message
                    });
                }

                res.json({
                    ...assessment,
                    questions
                });

            }
        );

    });

});

// ============================================================
// SUBMIT ASSESSMENT
// ============================================================

app.post(
    "/api/student/assessments/:assessmentId/submit",
    (req, res) => {

        const assessmentId =
            req.params.assessmentId;

        const {
            student_id,
            answers
        } = req.body;

        if (!student_id) {

            return res.status(400).json({
                message:
                    "Student ID is required."
            });

        }

        if (
            !answers ||
            typeof answers !== "object"
        ) {

            return res.status(400).json({
                message:
                    "Assessment answers are required."
            });

        }

        // Get correct answers
        const sql = `
            SELECT
                id,
                correct_answer

            FROM assessment_questions

            WHERE assessment_id = ?
        `;

        db.all(
            sql,
            [assessmentId],
            (err, questions) => {

                if (err) {

                    return res.status(500).json({
                        message:
                            "Failed to evaluate assessment."
                    });

                }

                if (!questions.length) {

                    return res.status(400).json({
                        message:
                            "This assessment has no questions."
                    });

                }

                let correct = 0;

                questions.forEach(question => {

                    const studentAnswer =
                        answers[question.id];

                    if (
                        studentAnswer &&
                        studentAnswer.toString().trim().toLowerCase() ===
                        question.correct_answer.toString().trim().toLowerCase()
                    ) {

                        correct++;

                    }

                });

                const total =
                    questions.length;

                const score =
                    Math.round(
                        (correct / total) * 100
                    );

                // Save result
                const resultSql = `
                    INSERT INTO assessment_results
                    (
                        assessment_id,
                        student_id,
                        score
                    )
                    VALUES (?, ?, ?)
                `;

                db.run(
                    resultSql,
                    [
                        assessmentId,
                        student_id,
                        score
                    ],
                    function (resultErr) {

                        if (resultErr) {

                            console.error(
                                "Assessment result error:",
                                resultErr.message
                            );

                            return res.status(500).json({
                                message:
                                    "Assessment evaluated but result could not be saved."
                            });

                        }

                        res.status(201).json({

                            message:
                                "Assessment submitted successfully!",

                            assessment_id:
                                assessmentId,

                            student_id:
                                student_id,

                            correct_answers:
                                correct,

                            total_questions:
                                total,

                            score:
                                score,

                            result_id:
                                this.lastID

                        });

                    }
                );

            }
        );

    }
);


// ============================================================
// FACULTY ASSESSMENT RESULTS
// ============================================================

app.get(
    "/api/faculty/assessment-results",
    (req, res) => {

        const sql = `
            SELECT
                assessment_results.id,
                assessment_results.assessment_id,
                assessment_results.student_id,
                assessment_results.score,

                assessments.title AS assessment_title,
                assessments.skill AS assessment_skill,

                users.name AS student_name,
                users.email AS student_email

            FROM assessment_results

            JOIN assessments
                ON assessment_results.assessment_id =
                   assessments.id

            JOIN users
                ON assessment_results.student_id =
                   users.id

            ORDER BY assessment_results.id DESC
        `;

        db.all(
            sql,
            [],
            (err, rows) => {

                if (err) {

                    return res.status(500).json({
                        message:
                            "Failed to fetch assessment results."
                    });

                }

                res.json(rows);

            }
        );

    }
);


// ============================================================
// STUDENT'S OWN ASSESSMENT RESULTS
// ============================================================

app.get(
    "/api/student/assessment-results/:studentId",
    (req, res) => {

        const studentId =
            req.params.studentId;

        const sql = `
            SELECT
                assessment_results.id,
                assessment_results.score,

                assessments.id AS assessment_id,
                assessments.title,
                assessments.skill,
                assessments.description

            FROM assessment_results

            JOIN assessments
                ON assessment_results.assessment_id =
                   assessments.id

            WHERE assessment_results.student_id = ?

            ORDER BY assessment_results.id DESC
        `;

        db.all(
            sql,
            [studentId],
            (err, rows) => {

                if (err) {

                    return res.status(500).json({
                        message:
                            "Failed to fetch assessment results."
                    });

                }

                res.json(rows);

            }
        );

    }
);


// ============================================================
// LEGACY ASSESSMENT RESULT ROUTE
// ============================================================

app.post(
    "/api/faculty/assessment-results",
    (req, res) => {

        const {
            assessment_id,
            student_id,
            score
        } = req.body;

        if (
            !assessment_id ||
            !student_id
        ) {

            return res.status(400).json({
                message:
                    "Assessment ID and student ID are required."
            });

        }

        const sql = `
            INSERT INTO assessment_results
            (
                assessment_id,
                student_id,
                score
            )
            VALUES (?, ?, ?)
        `;

        db.run(
            sql,
            [
                assessment_id,
                student_id,
                score || 0
            ],
            function (err) {

                if (err) {

                    return res.status(500).json({
                        message:
                            "Failed to save assessment result."
                    });

                }

                res.status(201).json({

                    message:
                        "Assessment result saved successfully!",

                    id:
                        this.lastID

                });

            }
        );

    }
);


// ============================================================
// COURSE RECOMMENDATIONS BY FACULTY
// ============================================================

app.post(
    "/api/faculty/recommend-course",
    (req, res) => {

        const {
            faculty_id,
            student_id,
            course_id,
            message
        } = req.body;

        if (
            !faculty_id ||
            !student_id ||
            !course_id
        ) {

            return res.status(400).json({
                message:
                    "Faculty ID, student ID and course ID are required."
            });

        }

        const sql = `
            INSERT INTO course_recommendations
            (
                faculty_id,
                student_id,
                course_id,
                message
            )
            VALUES (?, ?, ?, ?)
        `;

        db.run(
            sql,
            [
                faculty_id,
                student_id,
                course_id,
                message || ""
            ],
            function (err) {

                if (err) {

                    return res.status(500).json({
                        message:
                            "Failed to recommend course."
                    });

                }

                res.status(201).json({

                    message:
                        "Course recommended successfully!",

                    id:
                        this.lastID

                });

            }
        );

    }
);


// ============================================================
// GET COURSE RECOMMENDATIONS FOR STUDENT
// ============================================================

app.get(
    "/api/faculty/course-recommendations/:studentId",
    (req, res) => {

        const studentId =
            req.params.studentId;

        const sql = `
            SELECT

                course_recommendations.id,
                course_recommendations.message,
                course_recommendations.created_at,

                courses.id AS course_id,
                courses.title,
                courses.category,
                courses.level,
                courses.duration,

                users.name AS faculty_name

            FROM course_recommendations

            JOIN courses
                ON course_recommendations.course_id =
                   courses.id

            LEFT JOIN faculty
                ON course_recommendations.faculty_id =
                   faculty.id

            LEFT JOIN users
                ON faculty.user_id =
                   users.id

            WHERE course_recommendations.student_id = ?

            ORDER BY course_recommendations.created_at DESC
        `;

        db.all(
            sql,
            [studentId],
            (err, rows) => {

                if (err) {

                    return res.status(500).json({
                        message:
                            "Failed to fetch course recommendations."
                    });

                }

                res.json(rows);

            }
        );

    }
);


// ============================================================
// FACULTY REPORTS
// ============================================================

app.get(
    "/api/faculty/reports",
    (req, res) => {

        const sql = `
            SELECT

                COUNT(DISTINCT users.id)
                AS total_students,

                COALESCE(
                    ROUND(AVG(skills.skill_score)),
                    0
                ) AS average_score,

                COUNT(
                    CASE
                        WHEN skills.skill_score < 70
                        THEN 1
                    END
                ) AS skill_gaps,

                COUNT(
                    CASE
                        WHEN skills.skill_score >= 80
                        THEN 1
                    END
                ) AS strong_skill_records

            FROM users

            LEFT JOIN skills
                ON users.id = skills.user_id

            WHERE users.role = 'student'
        `;

        db.get(
            sql,
            [],
            (err, row) => {

                if (err) {

                    return res.status(500).json({
                        message:
                            "Failed to generate report."
                    });

                }

                res.json(row);

            }
        );

    }
);


// ============================================================
// FACULTY PROFILE
// ============================================================

// GET FACULTY PROFILE

app.get(
    "/api/faculty/:userId",
    (req, res) => {

        const userId =
            req.params.userId;

        const sql = `
            SELECT

                users.id AS user_id,
                users.name,
                users.email,
                users.role,

                faculty.id AS faculty_id,
                faculty.department,
                faculty.designation,
                faculty.college

            FROM users

            LEFT JOIN faculty
                ON users.id = faculty.user_id

            WHERE users.id = ?
            AND users.role = 'faculty'
        `;

        db.get(
            sql,
            [userId],
            (err, row) => {

                if (err) {

                    console.error(
                        "Faculty profile fetch error:",
                        err.message
                    );

                    return res.status(500).json({
                        message:
                            "Failed to fetch faculty profile."
                    });

                }

                if (!row) {

                    return res.status(404).json({
                        message:
                            "Faculty profile not found."
                    });

                }

                res.json(row);

            }
        );

    }
);


// ============================================================
// UPDATE FACULTY PROFILE
// ============================================================

app.put(
    "/api/faculty/:userId",
    (req, res) => {

        const userId =
            req.params.userId;

        const {
            name,
            email,
            department,
            designation,
            college
        } = req.body;

        if (!name || !email) {

            return res.status(400).json({
                message:
                    "Name and email are required."
            });

        }

        const updateUserSql = `
            UPDATE users
            SET
                name = ?,
                email = ?
            WHERE id = ?
            AND role = 'faculty'
        `;

        db.run(
            updateUserSql,
            [
                name.trim(),
                email.trim().toLowerCase(),
                userId
            ],
            function (userErr) {

                if (userErr) {

                    console.error(
                        "Faculty account update error:",
                        userErr.message
                    );

                    if (
                        userErr.message.includes(
                            "UNIQUE constraint failed"
                        )
                    ) {

                        return res.status(400).json({
                            message:
                                "That email is already being used."
                        });

                    }

                    return res.status(500).json({
                        message:
                            "Failed to update faculty account."
                    });

                }

                const updateFacultySql = `
                    UPDATE faculty
                    SET
                        department = ?,
                        designation = ?,
                        college = ?
                    WHERE user_id = ?
                `;

                db.run(
                    updateFacultySql,
                    [
                        department || "",
                        designation || "",
                        college || "",
                        userId
                    ],
                    function (facultyErr) {

                        if (facultyErr) {

                            console.error(
                                "Faculty profile update error:",
                                facultyErr.message
                            );

                            return res.status(500).json({
                                message:
                                    "Failed to update faculty information."
                            });

                        }

                        res.json({
                            message:
                                "Faculty profile saved successfully!"
                        });

                    }
                );

            }
        );

    }
);


// ============================================================
// API 404
// ============================================================

app.use(
    "/api",
    (req, res) => {

        res.status(404).json({
            message:
                "API endpoint not found."
        });

    }
);


// ============================================================
// START SERVER
// ============================================================

app.listen(
    PORT,
    () => {

        console.log(
            `SkillBridge server running at http://localhost:${PORT}`
        );

    }
);