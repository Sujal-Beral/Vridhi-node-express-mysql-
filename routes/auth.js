const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../db/connection');
const emailService = require('../services/emailService');

// Helper: SHA-256 Hash
function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

// POST /register (Phase 1)
router.post('/register', async (req, res) => {
    try {
        const { full_name, email, password } = req.body;

        // Validate presence of essential fields
        if (!full_name || !email || !password) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Default values for optional fields
        const category = req.body.category || 'Student';
        const age = req.body.age ? parseInt(req.body.age, 10) : null;
        const mobile = req.body.mobile || null;

        // Check if user already exists
        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
        if (existing && existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }

        // Hash password
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        // Generate email verification token (24 hour expiration)
        const rawVerificationToken = crypto.randomBytes(32).toString('hex');
        const hashedVerificationToken = hashToken(rawVerificationToken);
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Insert user
        const [result] = await pool.query(
            'INSERT INTO users (full_name, email, password_hash, age, mobile, category, email_verified, email_verification_token, email_verification_expires) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [full_name.trim(), normalizedEmail, password_hash, age, mobile, category, 0, hashedVerificationToken, verificationExpires]
        );

        const userId = result.insertId;

        // Initialize an empty financial profile for the user
        await pool.query(
            'INSERT INTO financial_profiles (user_id, monthly_income) VALUES (?, 0) ON DUPLICATE KEY UPDATE user_id = user_id',
            [userId]
        );

        // Initialize default user email preferences
        await pool.query(
            'INSERT INTO user_email_preferences (user_id, goal_notifications, milestone_emails, deadline_reminders, monthly_reports, quiz_emails, financial_alerts) VALUES (?, 1, 1, 1, 1, 1, 1) ON DUPLICATE KEY UPDATE user_id = user_id',
            [userId]
        );

        // Set session
        req.session.userId = userId;
        req.session.user = { id: userId, full_name: full_name.trim(), email: normalizedEmail, category };

        // Send Welcome / Verification Email in background (does not block registration response)
        const appUrl = process.env.BASE_URL || process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
        const verificationUrl = `${appUrl}/api/auth/verify-email?token=${rawVerificationToken}`;

        emailService.sendWelcomeEmail({
            user: { id: userId, full_name: full_name.trim(), email: normalizedEmail },
            verificationUrl
        }).catch(err => {
            console.error('[Auth] Failed to send welcome email:', err.message);
        });

        return res.status(201).json({
            success: true,
            message: 'Registration successful. A welcome email has been sent.',
            user: req.session.user
        });
    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// GET /verify-email (Phase 1)
router.get('/verify-email', async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) {
            return res.status(400).send(renderVerificationResultHtml({
                success: false,
                title: 'Invalid Verification Link',
                message: 'No verification token provided. Please check the link in your welcome email.'
            }));
        }

        const hashed = hashToken(token);
        const [users] = await pool.query(
            'SELECT id, full_name, email, email_verified, email_verification_expires FROM users WHERE email_verification_token = ?',
            [hashed]
        );

        if (users.length === 0) {
            // Check if already verified or token expired
            return res.status(400).send(renderVerificationResultHtml({
                success: false,
                title: 'Invalid or Expired Link',
                message: 'This email verification link is either invalid, expired, or has already been used.'
            }));
        }

        const user = users[0];
        const isExpired = new Date(user.email_verification_expires) < new Date();

        if (isExpired) {
            return res.status(400).send(renderVerificationResultHtml({
                success: false,
                title: 'Verification Link Expired',
                message: 'Your verification link has expired (valid for 24 hours). Please log in to request a new verification link.'
            }));
        }

        // Mark verified and clear token
        await pool.query(
            'UPDATE users SET email_verified = 1, email_verification_token = NULL, email_verification_expires = NULL WHERE id = ?',
            [user.id]
        );

        return res.status(200).send(renderVerificationResultHtml({
            success: true,
            title: 'Email Verified Successfully! 🎉',
            message: `Thank you, ${user.full_name || 'Member'}. Your email (${user.email}) has been verified. You can now access all Vridhi planning and notification features.`
        }));

    } catch (error) {
        console.error('Email verification error:', error);
        return res.status(500).send(renderVerificationResultHtml({
            success: false,
            title: 'Server Error',
            message: 'An unexpected error occurred during verification. Please try again later.'
        }));
    }
});

// POST /forgot-password (Phase 2)
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || typeof email !== 'string' || !email.trim()) {
            return res.status(400).json({ success: false, error: 'Valid email address is required' });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Always return generic success message to prevent user enumeration
        const genericResponse = {
            success: true,
            message: 'If that email address is registered with Vridhi, you will receive a password reset link shortly.'
        };

        const [users] = await pool.query('SELECT id, full_name, email FROM users WHERE email = ?', [normalizedEmail]);
        if (users.length === 0) {
            return res.status(200).json(genericResponse);
        }

        const user = users[0];

        // Generate single-use reset token (valid for 1 hour)
        const rawToken = crypto.randomBytes(32).toString('hex');
        const hashed = hashToken(rawToken);
        const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await pool.query(
            'UPDATE users SET reset_password_token = ?, reset_password_expires = ? WHERE id = ?',
            [hashed, expires, user.id]
        );

        const appUrl = process.env.BASE_URL || process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
        const resetUrl = `${appUrl}/reset-password.html?token=${rawToken}`;

        emailService.sendPasswordResetEmail({
            user,
            resetUrl
        }).catch(err => {
            console.error('[Auth] Failed to send password reset email:', err.message);
        });

        return res.status(200).json(genericResponse);

    } catch (error) {
        console.error('Forgot password error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// POST /reset-password (Phase 2)
router.post('/reset-password', async (req, res) => {
    try {
        const { token, new_password } = req.body;

        if (!token || typeof token !== 'string') {
            return res.status(400).json({ success: false, error: 'Reset token is required' });
        }
        if (!new_password || typeof new_password !== 'string' || new_password.length < 6) {
            return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long' });
        }

        const hashed = hashToken(token);
        const [users] = await pool.query(
            'SELECT id, email, reset_password_expires FROM users WHERE reset_password_token = ?',
            [hashed]
        );

        if (users.length === 0) {
            return res.status(400).json({ success: false, error: 'Invalid or already used password reset link.' });
        }

        const user = users[0];
        const isExpired = new Date(user.reset_password_expires) < new Date();
        if (isExpired) {
            return res.status(400).json({ success: false, error: 'Password reset link has expired. Please request a new one.' });
        }

        // Hash new password and invalidate token
        const password_hash = await bcrypt.hash(new_password, 10);
        await pool.query(
            'UPDATE users SET password_hash = ?, reset_password_token = NULL, reset_password_expires = NULL WHERE id = ?',
            [password_hash, user.id]
        );

        return res.status(200).json({
            success: true,
            message: 'Your password has been successfully reset. You can now log in with your new password.'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// POST /login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password are required' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
        if (users.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        req.session.userId = user.id;
        req.session.user = { id: user.id, full_name: user.full_name, email: user.email, category: user.category };

        const { password_hash, email_verification_token, reset_password_token, ...userInfo } = user;
        return res.status(200).json({ success: true, data: userInfo });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// POST /logout
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ success: false, error: 'Failed to log out' });
        }
        res.clearCookie('connect.sid');
        return res.status(200).json({ success: true, message: 'Logged out successfully' });
    });
});

// GET /check
router.get('/check', async (req, res) => {
    try {
        if (req.session && req.session.userId) {
            const [users] = await pool.query(
                'SELECT id, full_name, email, age, mobile, category, email_verified, created_at FROM users WHERE id = ?',
                [req.session.userId]
            );
            if (users.length > 0) {
                return res.status(200).json({ success: true, data: users[0] });
            }
        }
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    } catch (error) {
        console.error('Check auth error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * Helper: HTML Template for Verification Result Page
 */
function renderVerificationResultHtml({ success, title, message }) {
    const icon = success ? '✅' : '⚠️';
    const color = success ? '#15803d' : '#b91c1c';
    const bgColor = success ? '#dcfce7' : '#fee2e2';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | Vridhi</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f1f5f9;
            margin: 0;
            padding: 40px 15px;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 80vh;
        }
        .box {
            background: #ffffff;
            max-width: 520px;
            width: 100%;
            border-radius: 14px;
            box-shadow: 0 10px 30px rgba(10,35,66,0.1);
            overflow: hidden;
            text-align: center;
        }
        .header {
            background: #0A2342;
            color: #fff;
            padding: 24px;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        .header span {
            color: #50C878;
        }
        .body-card {
            padding: 36px 28px;
        }
        .icon-circle {
            width: 68px;
            height: 68px;
            border-radius: 50%;
            background: ${bgColor};
            color: ${color};
            font-size: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
        }
        h2 {
            margin: 0 0 12px;
            color: #0A2342;
            font-size: 22px;
        }
        p {
            color: #475569;
            font-size: 15px;
            line-height: 1.6;
            margin: 0 0 26px;
        }
        .btn {
            display: inline-block;
            background: #50C878;
            color: #ffffff;
            text-decoration: none;
            padding: 12px 28px;
            border-radius: 8px;
            font-weight: 700;
            font-size: 15px;
        }
    </style>
</head>
<body>
    <div class="box">
        <div class="header">
            <h1>Vridhi <span>वृद्धि</span></h1>
        </div>
        <div class="body-card">
            <div class="icon-circle">${icon}</div>
            <h2>${title}</h2>
            <p>${message}</p>
            <a href="/" class="btn">Go to Vridhi Login &rarr;</a>
        </div>
    </div>
</body>
</html>
    `;
}

module.exports = router;