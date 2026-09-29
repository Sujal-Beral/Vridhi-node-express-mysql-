const nodemailer = require('nodemailer');

/**
 * Helper: Format currency in standard Indian numbering system (INR)
 * e.g., 80000 -> ₹80,000 | 125000 -> ₹1,25,000
 */
function formatINR(val) {
    const num = Number(val) || 0;
    return '₹' + Math.round(num).toLocaleString('en-IN');
}

/**
 * Helper: Escape HTML to prevent injection in email templates
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Helper: Resolve base application URL from environment variables
 */
function getAppUrl() {
    return process.env.BASE_URL || process.env.APP_URL || 'http://localhost:3000';
}

/**
 * Helper: Mask email address for safe logging
 */
function maskEmail(email) {
    if (!email || typeof email !== 'string') return '[UNKNOWN]';
    const parts = email.split('@');
    if (parts.length !== 2) return '***';
    const [local, domain] = parts;
    const maskedLocal = local.length > 2 ? local.slice(0, 2) + '***' : (local[0] || '') + '***';
    return `${maskedLocal}@${domain}`;
}

/**
 * Safe backend logging for email events
 */
function logEmailEvent({ type, userId, recipient, status, messageId, error }) {
    console.log(`[Email] Type: ${type}`);
    if (userId !== undefined) console.log(`[Email] User ID: ${userId}`);
    if (recipient) console.log(`[Email] Recipient: ${maskEmail(recipient)}`);
    console.log(`[Email] Status: ${status}`);
    if (messageId) console.log(`[Email] Message ID: ${messageId}`);
    if (error) console.error(`[Email] Error: ${error}`);
}

/**
 * Log SMTP configuration diagnostics safely without exposing passwords
 */
function logTransporterDiagnostics() {
    const host = process.env.EMAIL_HOST;
    const port = process.env.EMAIL_PORT;
    const secure = process.env.EMAIL_SECURE;
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS;
    const from = process.env.EMAIL_FROM;
    const service = process.env.EMAIL_SERVICE;

    console.log('[Email Config] Diagnosing SMTP settings...');
    console.log(`[Email] EMAIL_HOST: ${host ? host : '[MISSING]'}`);
    console.log(`[Email] EMAIL_PORT: ${port ? port : '[MISSING] (default: 587)'}`);
    console.log(`[Email] EMAIL_SECURE: ${secure !== undefined ? secure : '[DEFAULT: false]'}`);
    console.log(`[Email] EMAIL_USER: ${user ? user : '[MISSING]'}`);
    console.log(`[Email] EMAIL_PASSWORD: ${pass ? `[SET: ${pass.length} chars]` : '[MISSING]'}`);
    console.log(`[Email] EMAIL_FROM: ${from ? from : (user ? `"Vridhi" <${user}>` : '[MISSING]')}`);
    if (service) console.log(`[Email] EMAIL_SERVICE: ${service}`);
}

/**
 * Create and configure the Nodemailer SMTP transporter.
 * Supports standard SMTP and service shortcuts.
 */
function createTransporter() {
    const host = process.env.EMAIL_HOST;
    const port = parseInt(process.env.EMAIL_PORT, 10) || 587;
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS;
    const service = process.env.EMAIL_SERVICE;

    if (!user || (!host && !service)) {
        return null;
    }

    const config = service
        ? {
            service,
            auth: { user, pass }
        }
        : {
            host,
            port,
            secure: process.env.EMAIL_SECURE === 'true' || port === 465,
            auth: { user, pass },
            tls: {
                rejectUnauthorized: process.env.EMAIL_TLS_REJECT_UNAUTHORIZED !== 'false'
            }
        };

    return nodemailer.createTransport(config);
}

/**
 * Verify SMTP connection
 */
async function verifyTransporter() {
    const transporter = createTransporter();
    if (!transporter) {
        console.warn('[Email] SMTP verification skipped: Credentials not fully configured in .env.');
        return { success: false, reason: 'smtp_not_configured' };
    }

    try {
        await transporter.verify();
        console.log('[Email] SMTP verification successful.');
        return { success: true };
    } catch (err) {
        console.error('[Email] SMTP verification failed.');
        console.error('Code:', err.code || 'N/A');
        console.error('Response:', err.response || 'N/A');
        console.error('Message:', err.message);
        if (err.stack) console.error('Stack:', err.stack);
        return {
            success: false,
            error: err.message,
            code: err.code,
            response: err.response
        };
    }
}

/**
 * Central Branded Email HTML Wrapper
 */
function buildEmailHtml({ title, badge, greetingName, bodyContent, ctaButton, recipientEmail }) {
    const appUrl = getAppUrl();
    const cleanGreeting = escapeHtml(greetingName || 'Vridhi Member');
    const cleanBadge = badge ? `<span class="badge">${badge}</span>` : '';
    const cleanCta = ctaButton ? `
        <div style="text-align: center; margin: 28px 0 16px;">
            <a href="${ctaButton.url || appUrl}" class="cta-btn">${escapeHtml(ctaButton.text || 'Open Vridhi')} &rarr;</a>
        </div>
    ` : '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: #f1f5f9;
            color: #1e293b;
            margin: 0;
            padding: 24px 12px;
            line-height: 1.6;
        }
        .container {
            max-width: 580px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 14px;
            overflow: hidden;
            box-shadow: 0 4px 18px rgba(10, 35, 66, 0.08);
            border: 1px solid #e2e8f0;
        }
        .header {
            background: linear-gradient(135deg, #0A2342 0%, #173b6c 100%);
            padding: 26px 24px;
            text-align: center;
            color: #ffffff;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 800;
            letter-spacing: 0.5px;
        }
        .header .tagline {
            color: #50C878;
            font-size: 13px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-top: 4px;
        }
        .content {
            padding: 30px 28px;
        }
        .badge {
            display: inline-block;
            background: #dcfce7;
            color: #15803d;
            font-size: 13px;
            font-weight: 700;
            padding: 4px 12px;
            border-radius: 20px;
            margin-bottom: 12px;
        }
        .badge-warning {
            background: #fef3c7;
            color: #b45309;
        }
        .badge-info {
            background: #e0f2fe;
            color: #0369a1;
        }
        .badge-alert {
            background: #fee2e2;
            color: #b91c1c;
        }
        .greeting {
            font-size: 18px;
            font-weight: 700;
            color: #0A2342;
            margin-bottom: 12px;
        }
        .card-box {
            background: #f8fafc;
            border: 1.5px solid #cbd5e1;
            border-left: 5px solid #50C878;
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
        }
        .card-box.warning {
            border-left-color: #f59e0b;
        }
        .card-box.info {
            border-left-color: #0284c7;
        }
        .card-box.alert {
            border-left-color: #ef4444;
        }
        .data-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            font-size: 15px;
        }
        .data-row:last-child {
            margin-bottom: 0;
        }
        .data-label {
            color: #64748b;
            font-weight: 600;
        }
        .data-value {
            color: #0A2342;
            font-weight: 800;
            font-size: 15px;
        }
        .progress-bar-bg {
            background: #e2e8f0;
            height: 10px;
            border-radius: 5px;
            overflow: hidden;
            margin: 10px 0 6px;
        }
        .progress-bar-fill {
            background: #50C878;
            height: 100%;
            border-radius: 5px;
        }
        .cta-btn {
            display: inline-block;
            background: #50C878;
            color: #ffffff !important;
            text-decoration: none;
            padding: 13px 26px;
            border-radius: 8px;
            font-weight: 700;
            font-size: 15px;
            box-shadow: 0 4px 12px rgba(80, 200, 120, 0.35);
        }
        .footer {
            background: #f8fafc;
            padding: 20px 24px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            font-size: 12px;
            color: #64748b;
            line-height: 1.5;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Vridhi <span style="color: #50C878;">वृद्धि</span></h1>
            <div class="tagline">From Earnings to Wealth</div>
        </div>
        <div class="content">
            ${cleanBadge}
            <div class="greeting">Hello ${cleanGreeting},</div>
            ${bodyContent}
            ${cleanCta}
        </div>
        <div class="footer">
            <strong>Vridhi (वृद्धि)</strong> — Financial Planning &amp; Literacy Platform<br>
            <i>This notification was sent to ${escapeHtml(recipientEmail || 'your account')}.</i>
        </div>
    </div>
</body>
</html>
    `;
}

/**
 * Generic Mail Dispatcher
 */
async function sendMailHelper({ type, userId, recipient, subject, text, html, attachments }) {
    if (!recipient) {
        console.warn(`[EmailService] No recipient provided for ${type}. Skipping.`);
        return { success: false, reason: 'missing_recipient' };
    }

    const transporter = createTransporter();
    if (!transporter) {
        console.warn(`[EmailService] SMTP credentials not configured in .env for ${type}. Skipping delivery.`);
        return { success: false, reason: 'smtp_not_configured' };
    }

    const fromAddress = process.env.EMAIL_FROM || (process.env.EMAIL_USER ? `"Vridhi" <${process.env.EMAIL_USER}>` : 'no-reply@vridhi.org');

    try {
        const mailOptions = {
            from: fromAddress,
            to: recipient,
            subject,
            text,
            html
        };
        if (attachments && Array.isArray(attachments)) {
            mailOptions.attachments = attachments;
        }

        const info = await transporter.sendMail(mailOptions);

        logEmailEvent({
            type,
            userId,
            recipient,
            status: 'SENT',
            messageId: info.messageId
        });

        return { success: true, messageId: info.messageId };
    } catch (err) {
        logEmailEvent({
            type,
            userId,
            recipient,
            status: 'FAILED',
            error: err.message
        });
        return {
            success: false,
            error: err.message,
            code: err.code,
            response: err.response
        };
    }
}

// ============================================================================
// PHASE 1: Welcome / Email Verification
// ============================================================================

async function sendWelcomeEmail({ user, verificationUrl }) {
    const recipient = user.email;
    const name = user.full_name || 'Vridhi Member';
    const appUrl = getAppUrl();
    const verifyLink = verificationUrl || `${appUrl}/api/auth/verify-email`;

    const subject = '👋 Welcome to Vridhi — From Earnings to Wealth';
    const text = `Hello ${name},

Welcome to Vridhi (वृद्धि)! 🎉

We are excited to help you take charge of your personal finances with structured financial planning, goal milestones, and interactive financial literacy tools.

To verify your email address and activate all features, please click the link below:
${verifyLink}

Get started today:
- Set up your 20-20-30-30 Monthly Budget
- Calculate your Emergency Reserve Buffer
- Create your first Milestone Goal

Regards,
Vridhi Team
${appUrl}
`;

    const bodyContent = `
        <p style="font-size: 15px; color: #334155;">
            Welcome to <strong>Vridhi (वृद्धि)</strong>! We are thrilled to partner with you on your journey from earnings to sustainable wealth.
        </p>
        <div class="card-box info">
            <h4 style="margin: 0 0 10px; color: #0A2342; font-size: 16px;">🚀 Quick Steps to Get Started</h4>
            <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.8;">
                <li><strong>Verify your email</strong> by clicking the button below.</li>
                <li><strong>Set your Monthly Income</strong> to calculate your 20-20-30-30 allocation.</li>
                <li><strong>Build your Emergency Fund</strong> target (3-6 months buffer).</li>
                <li><strong>Create Financial Goals</strong> and track your milestones.</li>
            </ul>
        </div>
        <p style="font-size: 14px; color: #475569;">
            Please verify your email address to ensure you receive goal updates, milestone alerts, and monthly summaries:
        </p>
    `;

    const html = buildEmailHtml({
        title: subject,
        badge: '👋 Welcome to Vridhi',
        greetingName: name,
        bodyContent,
        ctaButton: { text: 'Verify Email & Get Started', url: verifyLink },
        recipientEmail: recipient
    });

    return sendMailHelper({
        type: 'WELCOME_VERIFICATION',
        userId: user.id,
        recipient,
        subject,
        text,
        html
    });
}

// ============================================================================
// PHASE 2: Password Reset Email
// ============================================================================

async function sendPasswordResetEmail({ user, resetUrl }) {
    const recipient = user.email;
    const name = user.full_name || 'Vridhi Member';
    const appUrl = getAppUrl();

    const subject = '🔒 Reset Your Vridhi Password';
    const text = `Hello ${name},

We received a request to reset your password for your Vridhi account.

Click the link below to set a new password (valid for 1 hour):
${resetUrl}

If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.

Regards,
Vridhi Team
${appUrl}
`;

    const bodyContent = `
        <p style="font-size: 15px; color: #334155;">
            We received a request to reset your password for your Vridhi account.
        </p>
        <div class="card-box warning">
            <div style="font-size: 14px; color: #92400e;">
                <strong>⚠️ Note:</strong> This password reset link is valid for <strong>1 hour</strong> and can only be used once.
            </div>
        </div>
        <p style="font-size: 14px; color: #475569;">
            Click the button below to choose a new password:
        </p>
    `;

    const html = buildEmailHtml({
        title: subject,
        badge: '🔒 Password Reset',
        greetingName: name,
        bodyContent,
        ctaButton: { text: 'Reset My Password', url: resetUrl },
        recipientEmail: recipient
    });

    return sendMailHelper({
        type: 'PASSWORD_RESET',
        userId: user.id,
        recipient,
        subject,
        text,
        html
    });
}

// ============================================================================
// PHASE 3: Goal Created Email
// ============================================================================

async function sendGoalCreatedEmail({ user, goal }) {
    const recipient = user.email;
    const name = user.full_name || 'Vridhi Member';
    const appUrl = getAppUrl();

    const goalName = goal.name || 'Financial Goal';
    const targetAmount = Number(goal.target_amount) || 0;
    const savedAmount = Number(goal.saved_amount) || 0;
    const remaining = Math.max(0, targetAmount - savedAmount);
    const pct = targetAmount > 0 ? Math.min(100, (savedAmount / targetAmount) * 100).toFixed(1) : 0;
    const deadlineText = goal.deadline ? new Date(goal.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No deadline set';

    const subject = `🎯 Goal Created: ${goalName}`;
    const text = `Hello ${name},

Your new financial goal has been created on Vridhi!

Goal: ${goalName}
Target Amount: ${formatINR(targetAmount)}
Initial Saved: ${formatINR(savedAmount)}
Remaining: ${formatINR(remaining)}
Progress: ${pct}%
Target Deadline: ${deadlineText}

Track your progress anytime on Vridhi:
${appUrl}

Regards,
Vridhi Team
`;

    const bodyContent = `
        <p style="font-size: 15px; color: #334155;">
            You have successfully created a new financial milestone in Vridhi!
        </p>
        <div class="card-box info">
            <div class="data-row">
                <span class="data-label">Goal Name:</span>
                <span class="data-value">${escapeHtml(goalName)}</span>
            </div>
            <div class="data-row">
                <span class="data-label">Target Amount:</span>
                <span class="data-value">${formatINR(targetAmount)}</span>
            </div>
            <div class="data-row">
                <span class="data-label">Initial Saved:</span>
                <span class="data-value">${formatINR(savedAmount)}</span>
            </div>
            <div class="data-row">
                <span class="data-label">Remaining:</span>
                <span class="data-value" style="color: #0284c7;">${formatINR(remaining)}</span>
            </div>
            <div class="data-row">
                <span class="data-label">Target Date:</span>
                <span class="data-value">${escapeHtml(deadlineText)}</span>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${pct}%;"></div>
            </div>
            <div style="font-size: 13px; color: #64748b; text-align: right; margin-top: 4px;">
                Initial Progress: <strong>${pct}%</strong>
            </div>
        </div>
        <p style="font-size: 14px; color: #475569;">
            Consistent monthly saving is the key to achieving financial freedom. Keep progressing!
        </p>
    `;

    const html = buildEmailHtml({
        title: subject,
        badge: '🎯 New Goal Created',
        greetingName: name,
        bodyContent,
        ctaButton: { text: 'View Goal on Vridhi', url: appUrl },
        recipientEmail: recipient
    });

    return sendMailHelper({
        type: 'GOAL_CREATED',
        userId: user.id,
        recipient,
        subject,
        text,
        html
    });
}

// ============================================================================
// PHASE 4: Goal Progress Milestone Email (25%, 50%, 75%)
// ============================================================================

async function sendGoalMilestoneEmail({ user, goal, milestonePct }) {
    const recipient = user.email;
    const name = user.full_name || 'Vridhi Member';
    const appUrl = getAppUrl();

    const goalName = goal.name || 'Financial Goal';
    const targetAmount = Number(goal.target_amount) || 0;
    const savedAmount = Number(goal.saved_amount) || 0;
    const remaining = Math.max(0, targetAmount - savedAmount);

    let emoji = '🌱';
    let milestoneTitle = `${milestonePct}% Milestone Reached`;
    if (milestonePct === 50) {
        emoji = '⚡';
        milestoneTitle = `Halfway There! 50% Milestone Reached`;
    } else if (milestonePct === 75) {
        emoji = '🔥';
        milestoneTitle = `Almost There! 75% Milestone Reached`;
    }

    const subject = `${emoji} ${milestoneTitle}: ${goalName}`;
    const text = `Hello ${name},

Great progress! You have achieved ${milestonePct}% of your goal "${goalName}".

Goal: ${goalName}
Target Amount: ${formatINR(targetAmount)}
Current Saved: ${formatINR(savedAmount)}
Remaining: ${formatINR(remaining)}
Progress: ${milestonePct}%

Keep up the disciplined savings habit!

View your progress:
${appUrl}

Regards,
Vridhi Team
`;

    const bodyContent = `
        <p style="font-size: 15px; color: #334155;">
            ${emoji} Fantastic job! You have crossed the <strong>${milestonePct}% milestone</strong> for your goal <strong>${escapeHtml(goalName)}</strong>.
        </p>
        <div class="card-box">
            <div class="data-row">
                <span class="data-label">Goal Name:</span>
                <span class="data-value">${escapeHtml(goalName)}</span>
            </div>
            <div class="data-row">
                <span class="data-label">Target Amount:</span>
                <span class="data-value">${formatINR(targetAmount)}</span>
            </div>
            <div class="data-row">
                <span class="data-label">Current Saved:</span>
                <span class="data-value" style="color: #15803d;">${formatINR(savedAmount)}</span>
            </div>
            <div class="data-row">
                <span class="data-label">Remaining:</span>
                <span class="data-value">${formatINR(remaining)}</span>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${milestonePct}%;"></div>
            </div>
            <div style="font-size: 13px; color: #15803d; text-align: right; font-weight: 700; margin-top: 4px;">
                ${milestonePct}% Completed ✅
            </div>
        </div>
        <p style="font-size: 14px; color: #475569;">
            You are steadily closing in on your target. Keep the momentum going!
        </p>
    `;

    const html = buildEmailHtml({
        title: subject,
        badge: `${emoji} ${milestonePct}% Milestone`,
        greetingName: name,
        bodyContent,
        ctaButton: { text: 'View Goal Progress', url: appUrl },
        recipientEmail: recipient
    });

    return sendMailHelper({
        type: `GOAL_MILESTONE_${milestonePct}`,
        userId: user.id,
        recipient,
        subject,
        text,
        html
    });
}

// ============================================================================
// PHASE 10: Goal Completed Email (PRESERVED IMPLEMENTATION)
// ============================================================================

async function sendGoalCompletedEmail(params) {
    // Normalize parameters for dual signature support
    let recipientEmail = '';
    let userName = 'Vridhi User';
    let goalName = 'Financial Goal';
    let targetAmount = 0;
    let userId = undefined;

    if (params.user && params.goal) {
        recipientEmail = params.user.email;
        userName = params.user.full_name || 'Vridhi User';
        goalName = params.goal.name || 'Financial Goal';
        targetAmount = params.goal.target_amount;
        userId = params.user.id;
    } else if (params.to) {
        recipientEmail = params.to;
        userName = params.name || 'Vridhi User';
        goalName = params.goalName || 'Financial Goal';
        targetAmount = params.targetAmount;
        userId = params.userId;
    }

    if (!recipientEmail) {
        console.warn('[EmailService] No recipient email address provided. Skipping.');
        return { success: false, reason: 'missing_recipient' };
    }

    const transporter = createTransporter();
    if (!transporter) {
        console.warn('[EmailService] SMTP credentials not configured in .env (EMAIL_USER / EMAIL_HOST / EMAIL_PASSWORD). Skipping email delivery.');
        return { success: false, reason: 'smtp_not_configured' };
    }

    const targetFormatted = formatINR(targetAmount);
    const fromAddress = process.env.EMAIL_FROM || (process.env.EMAIL_USER ? `"Vridhi" <${process.env.EMAIL_USER}>` : 'no-reply@vridhi.org');
    const appUrl = getAppUrl();

    const subject = '🎉 Congratulations! You completed your Vridhi goal';

    const textContent = `Hello ${userName},

Congratulations! 🎉

You have successfully completed your financial goal:

Goal: ${goalName}
Target Amount: ${targetFormatted}

You reached your goal through consistent financial planning and saving.

Keep growing with Vridhi — From Earnings to Wealth.

Regards,
Vridhi Team
${appUrl}
`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: #f1f5f9;
            color: #1e293b;
            margin: 0;
            padding: 24px 12px;
            line-height: 1.6;
        }
        .container {
            max-width: 580px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 14px;
            overflow: hidden;
            box-shadow: 0 4px 18px rgba(10, 35, 66, 0.08);
            border: 1px solid #e2e8f0;
        }
        .header {
            background: linear-gradient(135deg, #0A2342 0%, #173b6c 100%);
            padding: 28px 24px;
            text-align: center;
            color: #ffffff;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 800;
            letter-spacing: 0.5px;
        }
        .header .tagline {
            color: #50C878;
            font-size: 13px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-top: 4px;
        }
        .content {
            padding: 32px 28px;
        }
        .badge {
            display: inline-block;
            background: #dcfce7;
            color: #15803d;
            font-size: 13px;
            font-weight: 700;
            padding: 4px 12px;
            border-radius: 20px;
            margin-bottom: 12px;
        }
        .greeting {
            font-size: 18px;
            font-weight: 700;
            color: #0A2342;
            margin-bottom: 12px;
        }
        .goal-card {
            background: #f8fafc;
            border: 1.5px solid #cbd5e1;
            border-left: 5px solid #50C878;
            border-radius: 10px;
            padding: 20px;
            margin: 22px 0;
        }
        .goal-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            font-size: 15px;
        }
        .goal-row:last-child {
            margin-bottom: 0;
        }
        .goal-label {
            color: #64748b;
            font-weight: 600;
        }
        .goal-value {
            color: #0A2342;
            font-weight: 800;
            font-size: 16px;
        }
        .cta-btn {
            display: block;
            text-align: center;
            background: #50C878;
            color: #ffffff !important;
            text-decoration: none;
            padding: 14px 28px;
            border-radius: 8px;
            font-weight: 700;
            font-size: 15px;
            margin: 26px 0 16px;
            box-shadow: 0 4px 12px rgba(80, 200, 120, 0.35);
        }
        .footer {
            background: #f8fafc;
            padding: 20px 24px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            font-size: 12px;
            color: #64748b;
            line-height: 1.5;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Vridhi <span style="color: #50C878;">वृद्धि</span></h1>
            <div class="tagline">From Earnings to Wealth</div>
        </div>
        <div class="content">
            <span class="badge">🎯 Goal Milestone Achieved</span>
            <div class="greeting">Hello ${userName},</div>
            <p style="margin: 0 0 16px; font-size: 15px; color: #334155;">
                Congratulations! You have successfully completed your financial goal.
            </p>
            
            <div class="goal-card">
                <div class="goal-row">
                    <span class="goal-label">Goal Name:</span>
                    <span class="goal-value">${goalName}</span>
                </div>
                <div class="goal-row">
                    <span class="goal-label">Target Amount:</span>
                    <span class="goal-value" style="color: #15803d;">${targetFormatted}</span>
                </div>
                <div class="goal-row">
                    <span class="goal-label">Status:</span>
                    <span class="goal-value" style="color: #15803d;">100% Completed ✅</span>
                </div>
            </div>

            <p style="font-size: 14px; color: #475569; margin: 0 0 16px;">
                You reached this milestone through consistent financial planning and saving discipline. Ready to plan your next milestone?
            </p>

            <a href="${appUrl}" class="cta-btn">View Your Financial Plan on Vridhi &rarr;</a>
        </div>
        <div class="footer">
            <strong>Vridhi (वृद्धि)</strong> — Financial Planning & Literacy Platform<br>
            <i>This is an automated educational milestone notification for your account (${recipientEmail}).</i>
        </div>
    </div>
</body>
</html>
`;

    try {
        const info = await transporter.sendMail({
            from: fromAddress,
            to: recipientEmail,
            subject: subject,
            text: textContent,
            html: htmlContent
        });

        logEmailEvent({
            type: 'GOAL_COMPLETED',
            userId,
            recipient: recipientEmail,
            status: 'SENT',
            messageId: info.messageId
        });
        return { success: true, messageId: info.messageId };
    } catch (error) {
        logEmailEvent({
            type: 'GOAL_COMPLETED',
            userId,
            recipient: recipientEmail,
            status: 'FAILED',
            error: error.message
        });
        return {
            success: false,
            error: error.message,
            code: error.code,
            response: error.response
        };
    }
}

// ============================================================================
// PHASE 5: Goal Deadline Reminder Email (~7 Days Prior)
// ============================================================================

async function sendGoalDeadlineEmail({ user, goal, daysRemaining }) {
    const recipient = user.email;
    const name = user.full_name || 'Vridhi Member';
    const appUrl = getAppUrl();

    const goalName = goal.name || 'Financial Goal';
    const targetAmount = Number(goal.target_amount) || 0;
    const savedAmount = Number(goal.saved_amount) || 0;
    const remaining = Math.max(0, targetAmount - savedAmount);
    const pct = targetAmount > 0 ? Math.min(100, (savedAmount / targetAmount) * 100).toFixed(1) : 0;
    const deadlineText = goal.deadline ? new Date(goal.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Soon';

    const daysText = daysRemaining !== undefined ? `${daysRemaining} days` : '1 week';
    const subject = `⏰ Reminder: Goal "${goalName}" deadline in ${daysText}`;
    const text = `Hello ${name},

This is a friendly reminder that the target deadline for your goal "${goalName}" is approaching in ${daysText} (${deadlineText}).

Goal: ${goalName}
Target Amount: ${formatINR(targetAmount)}
Current Saved: ${formatINR(savedAmount)}
Remaining: ${formatINR(remaining)}
Progress: ${pct}%
Deadline: ${deadlineText}

Review and update your savings on Vridhi:
${appUrl}

Regards,
Vridhi Team
`;

    const bodyContent = `
        <p style="font-size: 15px; color: #334155;">
            Your financial goal <strong>${escapeHtml(goalName)}</strong> has its target deadline in <strong>${escapeHtml(daysText)}</strong> (${escapeHtml(deadlineText)}).
        </p>
        <div class="card-box warning">
            <div class="data-row">
                <span class="data-label">Goal:</span>
                <span class="data-value">${escapeHtml(goalName)}</span>
            </div>
            <div class="data-row">
                <span class="data-label">Target Amount:</span>
                <span class="data-value">${formatINR(targetAmount)}</span>
            </div>
            <div class="data-row">
                <span class="data-label">Current Saved:</span>
                <span class="data-value">${formatINR(savedAmount)}</span>
            </div>
            <div class="data-row">
                <span class="data-label">Remaining:</span>
                <span class="data-value" style="color: #b45309;">${formatINR(remaining)}</span>
            </div>
            <div class="data-row">
                <span class="data-label">Deadline Date:</span>
                <span class="data-value">${escapeHtml(deadlineText)}</span>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${pct}%; background: #f59e0b;"></div>
            </div>
            <div style="font-size: 13px; color: #64748b; text-align: right; margin-top: 4px;">
                Current Progress: <strong>${pct}%</strong>
            </div>
        </div>
        <p style="font-size: 14px; color: #475569;">
            Consider topping up your savings or adjusting your monthly allocation to reach your milestone on schedule.
        </p>
    `;

    const html = buildEmailHtml({
        title: subject,
        badge: `⏰ Deadline Reminder (${daysText} left)`,
        greetingName: name,
        bodyContent,
        ctaButton: { text: 'Update Goal on Vridhi', url: appUrl },
        recipientEmail: recipient
    });

    return sendMailHelper({
        type: 'GOAL_DEADLINE_REMINDER',
        userId: user.id,
        recipient,
        subject,
        text,
        html
    });
}

// ============================================================================
// PHASE 6: Monthly Financial Report Email
// ============================================================================

async function sendMonthlyReportEmail({ user, profile, goals, allocation, healthScore, emergencyFund, monthYear }) {
    const recipient = user.email;
    const name = user.full_name || 'Vridhi Member';
    const appUrl = getAppUrl();

    const reportMonth = monthYear || new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const income = Number(profile.monthly_income) || 0;
    const expenses = Number(profile.essential_expenses) || 0;
    const savings = Number(profile.current_savings) || 0;
    const debt = Number(profile.existing_debt) || 0;
    const score = healthScore !== undefined ? healthScore : 50;

    const secureAmt = allocation ? Number(allocation.secureSavings) : income * 0.20;
    const emergencyAmt = allocation ? Number(allocation.emergencyShield) : income * 0.20;
    const homeAmt = allocation ? Number(allocation.homeEssentials) : income * 0.30;
    const wealthAmt = allocation ? Number(allocation.wealthGeneration) : income * 0.30;

    const goalsList = Array.isArray(goals) ? goals : [];
    const activeGoalsCount = goalsList.length;

    const subject = `📊 Your Vridhi Monthly Financial Report — ${reportMonth}`;
    const text = `Hello ${name},

Here is your Monthly Financial Report summary for ${reportMonth} on Vridhi.

FINANCIAL SNAPSHOT:
- Monthly Income: ${formatINR(income)}
- Essential Expenses: ${formatINR(expenses)}
- Current Savings: ${formatINR(savings)}
- Existing Debt: ${formatINR(debt)}
- Financial Health Score: ${score}/100

20-20-30-30 ALLOCATION:
- Secure Savings (20%): ${formatINR(secureAmt)}
- Emergency Buffer (20%): ${formatINR(emergencyAmt)}
- Home & Essentials (30%): ${formatINR(homeAmt)}
- Wealth Generation (30%): ${formatINR(wealthAmt)}

Active Goals: ${activeGoalsCount}

View your complete interactive plan on Vridhi:
${appUrl}

Regards,
Vridhi Team
`;

    let goalsSummaryHtml = '';
    if (goalsList.length > 0) {
        goalsSummaryHtml = `
            <div style="margin-top: 15px;">
                <strong style="font-size: 14px; color: #0A2342;">🎯 Active Milestones (${goalsList.length})</strong>
                <ul style="margin: 6px 0 0; padding-left: 20px; font-size: 13px; color: #475569;">
                    ${goalsList.slice(0, 4).map(g => `<li>${escapeHtml(g.name)}: ${formatINR(g.saved_amount)} / ${formatINR(g.target_amount)}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    const bodyContent = `
        <p style="font-size: 15px; color: #334155;">
            Here is your personalized monthly financial health summary for <strong>${escapeHtml(reportMonth)}</strong>:
        </p>
        
        <div class="card-box info">
            <h4 style="margin: 0 0 12px; color: #0A2342; font-size: 15px;">📊 Monthly Financial Snapshot</h4>
            <div class="data-row">
                <span class="data-label">Monthly Income:</span>
                <span class="data-value">${formatINR(income)}</span>
            </div>
            <div class="data-row">
                <span class="data-label">Essential Expenses:</span>
                <span class="data-value">${formatINR(expenses)}</span>
            </div>
            <div class="data-row">
                <span class="data-label">Current Savings:</span>
                <span class="data-value">${formatINR(savings)}</span>
            </div>
            <div class="data-row">
                <span class="data-label">Existing Debt:</span>
                <span class="data-value">${formatINR(debt)}</span>
            </div>
            <div class="data-row" style="border-top: 1px dashed #cbd5e1; padding-top: 8px; margin-top: 8px;">
                <span class="data-label">Financial Health Score:</span>
                <span class="data-value" style="color: #0284c7;">${score} / 100</span>
            </div>
        </div>

        <div class="card-box">
            <h4 style="margin: 0 0 10px; color: #0A2342; font-size: 15px;">⚖️ 20-20-30-30 Budget Framework</h4>
            <div class="data-row">
                <span class="data-label">Secure Savings (20%):</span>
                <span class="data-value">${formatINR(secureAmt)}</span>
            </div>
            <div class="data-row">
                <span class="data-label">Emergency Buffer (20%):</span>
                <span class="data-value">${formatINR(emergencyAmt)}</span>
            </div>
            <div class="data-row">
                <span class="data-label">Home & Essentials (30%):</span>
                <span class="data-value">${formatINR(homeAmt)}</span>
            </div>
            <div class="data-row">
                <span class="data-label">Wealth Growth (30%):</span>
                <span class="data-value">${formatINR(wealthAmt)}</span>
            </div>
            ${goalsSummaryHtml}
        </div>

        <p style="font-size: 14px; color: #475569;">
            Log in to Vridhi to download your high-resolution PDF financial plan or adjust your monthly targets:
        </p>
    `;

    const html = buildEmailHtml({
        title: subject,
        badge: `📊 Monthly Report — ${reportMonth}`,
        greetingName: name,
        bodyContent,
        ctaButton: { text: 'Open Financial Report in Vridhi', url: appUrl },
        recipientEmail: recipient
    });

    return sendMailHelper({
        type: 'MONTHLY_REPORT',
        userId: user.id,
        recipient,
        subject,
        text,
        html
    });
}

// ============================================================================
// PHASE 7: Quiz Score / Improvement Email
// ============================================================================

async function sendQuizResultEmail({ user, survey_type, score, total, percentage, previousAttempt, improvementPoints }) {
    const recipient = user.email;
    const name = user.full_name || 'Vridhi Member';
    const appUrl = getAppUrl();

    const isAfterQuiz = survey_type === 'after';
    const quizTitle = isAfterQuiz ? 'After Learning Assessment' : 'Before Learning Baseline';
    const scorePct = Number(percentage).toFixed(1);

    const subject = isAfterQuiz
        ? `🎓 Quiz Results: ${scorePct}% on After Learning Assessment`
        : `📝 Quiz Completed: Your Financial Literacy Baseline Score`;

    let improvementText = '';
    let improvementHtml = '';

    if (isAfterQuiz && improvementPoints !== null && improvementPoints !== undefined) {
        const sign = Number(improvementPoints) >= 0 ? '+' : '';
        improvementText = `Improvement: ${sign}${improvementPoints} percentage points`;
        improvementHtml = `
            <div class="data-row" style="border-top: 1px dashed #cbd5e1; padding-top: 8px; margin-top: 8px;">
                <span class="data-label">Knowledge Growth:</span>
                <span class="data-value" style="color: #15803d;">${sign}${improvementPoints} % Points 🚀</span>
            </div>
        `;
    }

    const text = `Hello ${name},

You have completed the ${quizTitle} on Vridhi!

Quiz: ${quizTitle}
Score: ${score} / ${total}
Percentage: ${scorePct}%
${improvementText}

Continue your financial education with Vridhi's video crash courses and guides:
${appUrl}

Regards,
Vridhi Team
`;

    const bodyContent = `
        <p style="font-size: 15px; color: #334155;">
            You have successfully completed the <strong>${escapeHtml(quizTitle)}</strong> in Vridhi Learn!
        </p>
        <div class="card-box ${isAfterQuiz ? '' : 'info'}">
            <div class="data-row">
                <span class="data-label">Quiz Type:</span>
                <span class="data-value">${escapeHtml(quizTitle)}</span>
            </div>
            <div class="data-row">
                <span class="data-label">Correct Answers:</span>
                <span class="data-value">${score} / ${total}</span>
            </div>
            <div class="data-row">
                <span class="data-label">Score Percentage:</span>
                <span class="data-value" style="color: #15803d; font-size: 17px;">${scorePct}%</span>
            </div>
            ${improvementHtml}
        </div>
        <p style="font-size: 14px; color: #475569;">
            Financial literacy is the foundation of long-term wealth building. Keep exploring our video crash courses and research summaries!
        </p>
    `;

    const html = buildEmailHtml({
        title: subject,
        badge: `🎓 Quiz Completion Summary`,
        greetingName: name,
        bodyContent,
        ctaButton: { text: 'Explore Vridhi Learn', url: `${appUrl}/learn.html` },
        recipientEmail: recipient
    });

    return sendMailHelper({
        type: `QUIZ_${survey_type.toUpperCase()}`,
        userId: user.id,
        recipient,
        subject,
        text,
        html
    });
}

// ============================================================================
// PHASE 8: Financial Health / Emergency Fund Alert Email
// ============================================================================

async function sendFinancialAlertEmail({ user, alertType, alertData }) {
    const recipient = user.email;
    const name = user.full_name || 'Vridhi Member';
    const appUrl = getAppUrl();

    let title = 'Financial Health Alert';
    let subject = '⚠️ Vridhi Financial Health Alert';
    let description = '';
    let detailsHtml = '';

    if (alertType === 'low_emergency_fund') {
        subject = '🛡️ Action Recommended: Boost Your Emergency Buffer';
        title = 'Low Emergency Fund Buffer';
        const coverageMonths = alertData.coverageMonths || '0.0';
        const target3mo = formatINR(alertData.target3mo || 0);
        const currentSavings = formatINR(alertData.currentSavings || 0);

        description = `Your current emergency buffer covers ${coverageMonths} months of essential expenses. Financial experts recommend maintaining at least 3 months (${target3mo}) in liquid savings before high-risk investments.`;
        detailsHtml = `
            <div class="data-row">
                <span class="data-label">Current Savings:</span>
                <span class="data-value">${currentSavings}</span>
            </div>
            <div class="data-row">
                <span class="data-label">Current Coverage:</span>
                <span class="data-value" style="color: #b91c1c;">${coverageMonths} months</span>
            </div>
            <div class="data-row">
                <span class="data-label">Recommended 3-Mo Target:</span>
                <span class="data-value" style="color: #15803d;">${target3mo}</span>
            </div>
        `;
    } else if (alertType === 'overdue_goal') {
        const goalName = alertData.goalName || 'Financial Goal';
        const deadline = alertData.deadline || 'Recent Date';
        const remaining = formatINR(alertData.remaining || 0);

        subject = `🎯 Milestone Update: Goal "${goalName}" Target Date Passed`;
        title = 'Goal Target Date Passed';
        description = `The target deadline for "${goalName}" was ${deadline}. You have ${remaining} remaining to reach 100%.`;
        detailsHtml = `
            <div class="data-row">
                <span class="data-label">Goal:</span>
                <span class="data-value">${escapeHtml(goalName)}</span>
            </div>
            <div class="data-row">
                <span class="data-label">Remaining:</span>
                <span class="data-value" style="color: #b91c1c;">${remaining}</span>
            </div>
            <div class="data-row">
                <span class="data-label">Original Deadline:</span>
                <span class="data-value">${escapeHtml(deadline)}</span>
            </div>
        `;
    } else if (alertType === 'behind_schedule') {
        const goalName = alertData.goalName || 'Financial Goal';
        const monthsNeeded = alertData.monthsNeeded || 0;
        const monthsLeft = alertData.monthsLeft || 0;

        subject = `⚡ Savings Pace Alert: Goal "${goalName}"`;
        title = 'Savings Pace Adjustment';
        description = `At your current monthly allocation, goal "${goalName}" will require ~${monthsNeeded} months, but the target deadline is in ~${monthsLeft} months. Consider increasing your monthly allocation.`;
        detailsHtml = `
            <div class="data-row">
                <span class="data-label">Goal:</span>
                <span class="data-value">${escapeHtml(goalName)}</span>
            </div>
            <div class="data-row">
                <span class="data-label">Time Remaining:</span>
                <span class="data-value">${monthsLeft} months</span>
            </div>
            <div class="data-row">
                <span class="data-label">Time Needed at Current Pace:</span>
                <span class="data-value" style="color: #b91c1c;">${monthsNeeded} months</span>
            </div>
        `;
    } else {
        description = alertData.message || 'Please review your financial health summary on Vridhi.';
    }

    const text = `Hello ${name},

${title}

${description}

Review your financial profile and goals on Vridhi:
${appUrl}

Regards,
Vridhi Team
`;

    const bodyContent = `
        <p style="font-size: 15px; color: #334155;">
            ${escapeHtml(description)}
        </p>
        <div class="card-box alert">
            <h4 style="margin: 0 0 10px; color: #991b1b; font-size: 15px;">⚠️ Alert Details</h4>
            ${detailsHtml}
        </div>
        <p style="font-size: 14px; color: #475569;">
            Log in to Vridhi to adjust your financial allocation or review personalized insights.
        </p>
    `;

    const html = buildEmailHtml({
        title: subject,
        badge: `⚠️ ${title}`,
        greetingName: name,
        bodyContent,
        ctaButton: { text: 'Review on Vridhi', url: appUrl },
        recipientEmail: recipient
    });

    return sendMailHelper({
        type: `ALERT_${alertType.toUpperCase()}`,
        userId: user.id,
        recipient,
        subject,
        text,
        html
    });
}

// ============================================================================
// Module Exports
// ============================================================================

module.exports = {
    formatINR,
    escapeHtml,
    maskEmail,
    logEmailEvent,
    logTransporterDiagnostics,
    createTransporter,
    verifyTransporter,
    sendWelcomeEmail,
    sendVerificationEmail: sendWelcomeEmail,
    sendPasswordResetEmail,
    sendGoalCreatedEmail,
    sendGoalMilestoneEmail,
    sendGoalCompletedEmail,
    sendGoalCompletionEmail: sendGoalCompletedEmail, // Alias
    sendGoalDeadlineEmail,
    sendMonthlyReportEmail,
    sendQuizResultEmail,
    sendFinancialAlertEmail
};
