# Vridhi (वृद्धि) — From Earnings to Wealth

> **Community Engagement Project | B.Tech Computer Science & Engineering**
> Course Code: **CS310CEP01**

---

## 📌 Project Overview

**Vridhi** (वृद्धि, meaning *Growth*) is a full-stack community financial literacy web application built as a college Community Engagement Project. It provides educational financial planning tools to students, salaried employees, business owners, farmers, and homemakers, helping them understand budgeting, savings, goal-setting, and investment basics.

> ⚠️ **Disclaimer:** Vridhi is an educational tool. Nothing in this application constitutes professional financial advice.

---

## 🎯 Problem Statement

A significant portion of India's population — especially students and young adults — lack basic financial literacy. They struggle with budgeting, emergency preparedness, and understanding savings vs. investment trade-offs. This project aims to provide an accessible, multilingual, community-driven financial planning platform.

---

## 🏆 Objectives

1. Build a simple, beginner-friendly educational financial planning web application.
2. Assess community financial awareness through before/after surveys.
3. Provide personalised (educational) guidance through the 20-20-30-30 framework.
4. Collect user feedback to measure project impact.
5. Demonstrate a full-stack REST API project using Node.js, Express.js, and MySQL.

---

## ✅ Features

### Phase 1 — Core
- User Registration & Login (bcrypt hashing + session-based auth)
- Dashboard with real MySQL data
- Monthly income input & update
- **20-20-30-30 Allocation Framework** (educational default)
- Goals: Create, View, Update saved amount, Delete
- Chart.js doughnut chart for allocation visualisation

### Phase 2 — Smarter
- Financial Profile (income, expenses, savings, debt, risk tolerance)
- Emergency Fund Calculator (3-month and 6-month estimates)
- Financial Health Score (out of 100, calculated on the server)
- Personalised allocation suggestions (based on debt/savings)

### Phase 3 — Community Engagement
- Financial Awareness Survey (Before Vridhi / After Vridhi)
- Community Results — real aggregated data from MySQL
- User Feedback with ratings
- Impact Dashboard — actual user counts, goal counts, awareness scores

### Phase 4 — Polish
- Language Support: **English / मराठी / हिंदी** (persisted in localStorage)
- Responsive Design (desktop + tablet + mobile)
- Frontend + Server-side form validation
- SQL injection protection via parameterised queries

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript, Chart.js |
| Backend | Node.js, Express.js |
| Database | MySQL (via mysql2/promise) |
| Authentication | bcrypt + express-session |
| Environment | dotenv |

> ❌ No React, Angular, MongoDB, Firebase, or PHP.

---

## 🏗️ Architecture

```
Browser (HTML + CSS + Vanilla JS)
        ↓  fetch() API calls
Node.js + Express.js (index.js + routes/)
        ↓  mysql2 parameterised queries
MySQL Database (vridhi)
```

---

## 📁 Folder Structure

```
Vridhi/
├── public/                  ← Frontend (served statically by Express)
│   ├── index.html           ← Main SPA
│   ├── learn.html           ← Vridhi Learn page
│   ├── css/
│   │   ├── global.css
│   │   ├── animations.css
│   │   ├── navbar.css
│   │   ├── auth.css
│   │   ├── dashboard.css
│   │   ├── goals.css
│   │   ├── investments.css
│   │   ├── profile.css
│   │   ├── survey.css
│   │   ├── community.css
│   │   └── responsive.css
│   ├── js/
│   │   ├── i18n.js          ← Language support (EN / MR / HI)
│   │   ├── navigation.js    ← SPA routing + session check
│   │   ├── auth.js          ← Login / Register / Userinfo
│   │   ├── dashboard.js     ← Dashboard rendering
│   │   ├── charts.js        ← Chart.js wrappers
│   │   ├── goals.js         ← Goals CRUD
│   │   ├── investments.js   ← Investment explorer (educational)
│   │   ├── profile.js       ← Financial profile + health score
│   │   ├── survey.js        ← Community survey submission + results
│   │   └── community.js     ← Feedback + impact dashboard
│   └── images/
│       ├── Vridhi_logo.jpeg
│       └── bg_image.png
├── routes/
│   ├── auth.js              ← POST /register, /login, /logout, GET /check
│   ├── dashboard.js         ← GET /dashboard
│   ├── profile.js           ← GET/PATCH /profile
│   ├── goals.js             ← GET/POST/PATCH/DELETE /goals
│   ├── survey.js            ← POST /survey, GET /survey/results
│   ├── feedback.js          ← POST /feedback, GET /feedback/results
│   └── community.js         ← GET /community/impact
├── middleware/
│   └── auth.js              ← Session authentication middleware
├── db/
│   ├── connection.js        ← MySQL connection pool
│   └── schema.sql           ← Database schema (run once to set up)
├── index.js                 ← Express server entry point
├── package.json
├── .env                     ← Database credentials (NOT committed to git)
├── .gitignore               ← Excludes node_modules/, .env
└── README.md
```

---

## 🗄️ MySQL Database Structure

**Database name:** `vridhi`

### Table: `users`
| Column | Type | Notes |
|---|---|---|
| id | INT AUTO_INCREMENT PK | |
| full_name | VARCHAR(100) NOT NULL | |
| email | VARCHAR(255) UNIQUE NOT NULL | |
| password_hash | VARCHAR(255) NOT NULL | bcrypt hashed |
| age | INT | |
| mobile | VARCHAR(15) | |
| category | ENUM | Student/Employee/Business/Housewife/Farmer |
| created_at | TIMESTAMP | Auto |

### Table: `financial_profiles`
| Column | Type | Notes |
|---|---|---|
| id | INT AUTO_INCREMENT PK | |
| user_id | INT UNIQUE FK → users.id | Cascade delete |
| monthly_income | DECIMAL(12,2) | |
| essential_expenses | DECIMAL(12,2) | |
| current_savings | DECIMAL(12,2) | |
| existing_debt | DECIMAL(12,2) | |
| risk_preference | ENUM | Low/Medium/High |
| updated_at | TIMESTAMP | Auto-update |

### Table: `goals`
| Column | Type | Notes |
|---|---|---|
| id | INT AUTO_INCREMENT PK | |
| user_id | INT FK → users.id | Cascade delete |
| name | VARCHAR(100) NOT NULL | |
| target_amount | DECIMAL(12,2) NOT NULL | |
| saved_amount | DECIMAL(12,2) DEFAULT 0 | |
| monthly_allocation | DECIMAL(12,2) | |
| deadline | DATE | Optional |
| created_at | TIMESTAMP | Auto |

### Table: `community_surveys`
| Column | Type | Notes |
|---|---|---|
| id | INT AUTO_INCREMENT PK | |
| user_id | INT FK → users.id | SET NULL on delete |
| maintains_budget | BOOLEAN | |
| saves_regularly | BOOLEAN | |
| has_emergency_fund | BOOLEAN | |
| has_financial_goal | BOOLEAN | |
| understands_investing | BOOLEAN | |
| biggest_difficulty | TEXT | |
| awareness_rating | INT | 1–10 |
| survey_type | ENUM | before/after |
| created_at | TIMESTAMP | Auto |

### Table: `feedback`
| Column | Type | Notes |
|---|---|---|
| id | INT AUTO_INCREMENT PK | |
| user_id | INT FK → users.id | SET NULL on delete |
| ease_of_use | INT | 1–5 |
| usefulness | INT | 1–5 |
| most_useful_feature | VARCHAR(255) | |
| suggestions | TEXT | |
| problems | TEXT | |
| created_at | TIMESTAMP | Auto |

---

## 🔌 REST API Endpoints

### Authentication
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register new user |
| POST | `/api/auth/login` | Public | Login, create session |
| POST | `/api/auth/logout` | Public | Destroy session |
| GET | `/api/auth/check` | Public | Check if session active |

### Dashboard
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/dashboard` | 🔒 Required | Get dashboard data (user + profile + goals + allocation) |

### Profile
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/profile` | 🔒 Required | Get profile + health score + emergency fund |
| PATCH | `/api/profile` | 🔒 Required | Update income, expenses, savings, debt, risk |

### Goals
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/goals` | 🔒 Required | List all user's goals |
| POST | `/api/goals` | 🔒 Required | Create a new goal |
| PATCH | `/api/goals/:id` | 🔒 Required | Update a goal (ownership verified) |
| DELETE | `/api/goals/:id` | 🔒 Required | Delete a goal (ownership verified) |

### Community
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/survey` | 🔒 Required | Submit a community survey |
| GET | `/api/survey/results` | Public | Get aggregate survey results |
| POST | `/api/feedback` | 🔒 Required | Submit feedback |
| GET | `/api/feedback/results` | Public | Get aggregate feedback results |
| GET | `/api/community/impact` | Public | Get impact dashboard metrics |

---

## 🔐 Authentication Flow

1. User registers → password hashed with **bcrypt (10 rounds)** → stored in MySQL.
2. Login → bcrypt.compare → session created with `express-session`.
3. All protected routes use `middleware/auth.js` which checks `req.session.userId`.
4. Unauthorized requests receive **HTTP 401**.
5. Goal ownership is verified on PATCH/DELETE — users cannot modify each other's data.
6. Logout → `req.session.destroy()` + cookie cleared.

---

## 📐 The 20-20-30-30 Educational Framework

> **Vridhi's default educational financial allocation model — not universal financial advice.**

| Pillar | Allocation | Purpose |
|---|---|---|
| 🟢 Secure Savings | 20% | Short-term goals, planned purchases |
| 🟠 Emergency Shield | 20% | Liquid safety net (3–6 months expenses) |
| 🔵 Home & Essentials | 30% | Rent, bills, groceries, loan EMIs |
| 🟣 Wealth Generation | 30% | Investments, SIPs, long-term growth |

The allocation is calculated dynamically from `monthly_income` in the database.
Users can customise percentages during setup (must total 100%).

---

## 🌐 Language Support

Vridhi supports three languages:
- **EN** — English (default)
- **MR** — मराठी (Marathi)
- **HI** — हिंदी (Hindi)

Language is selected via buttons in the navigation bar and login screen.
The selection persists across page refreshes using `localStorage`.
All translations are maintained in `public/js/i18n.js` using `data-i18n` attributes.

---

## 🚀 Setup Instructions

### Prerequisites
- Node.js (v16+)
- MySQL (v8+ recommended)
- A terminal (Command Prompt / PowerShell / Terminal)

### Step 1: Clone / Download the Project
```
Place the Vridhi folder on your machine.
```

### Step 2: Create the MySQL Database
Open MySQL Workbench or MySQL Command Line and run:
```bash
mysql -u root -p < db/schema.sql
```
Or manually paste the contents of `db/schema.sql` in MySQL Workbench and execute.

### Step 3: Configure Environment Variables
Open the `.env` file and set your MySQL password:
```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=YOUR_ACTUAL_MYSQL_PASSWORD
DB_NAME=vridhi
DB_PORT=3306
SESSION_SECRET=vridhi-secret-key-change-this-in-production
```

### Step 4: Install Dependencies
```bash
npm install
```

### Step 5: Start the Server
```bash
npm start
```
Or for development with auto-restart:
```bash
npm run dev
```

### Step 6: Open in Browser
```
http://localhost:3000
```

---

## 🧪 How to Test the Application

1. **Register** a new account on the login screen.
2. **Set up profile** — select your category and enter monthly income.
3. **View Dashboard** — check 20-20-30-30 allocation is calculated correctly.
4. **Add a Goal** — click "My Goals" → "+ Add Goal".
5. **Update Saved Amount** — on a goal card, enter an amount and click Update.
6. **Delete a Goal** — click the 🗑️ button.
7. **Financial Profile** — click "Financial Profile" in the navbar, fill in all fields.
8. **Emergency Fund** — see the calculator update after saving profile.
9. **Community Survey** — click "Community" → "Survey", answer questions, submit.
10. **Survey Results** — click "Results" tab to see real aggregated data.
11. **Feedback** — click "Feedback" tab, rate the app, submit.
12. **Impact Dashboard** — click "Impact Dashboard" to see real metrics.
13. **Language Switch** — click EN / MR / HI buttons in the navbar.
14. **Logout** — click Sign Out, then log back in and verify data persists.

---

## 🏫 Community Engagement Methodology

1. **Needs Assessment** — Survey before using Vridhi (baseline financial awareness).
2. **Solution Design** — Built educational tools based on identified gaps.
3. **Community Testing** — Users from different backgrounds test the platform.
4. **Feedback Collection** — Users rate ease-of-use and usefulness.
5. **Impact Measurement** — Before/after survey comparison shows real change.

> All impact metrics displayed in Vridhi use **only real data from the database**. No fake numbers are generated.

---

## 👥 Team

B.Tech CSE — Community Engagement Project

---

## 📄 License

Academic Project — For educational and demonstration purposes only.
Not for commercial use.
# Vridhi-node-express-mysql-
