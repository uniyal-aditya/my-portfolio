// netlify/functions/sendFeedback.js
const sg = require('@sendgrid/mail');

const FROM_EMAIL = process.env.FROM_EMAIL || 'no-reply@adityauniyal.dev';
const TO_EMAIL = process.env.TO_EMAIL; // set in Netlify env
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

exports.handler = async function (event, context) {
    if (!SENDGRID_API_KEY || !TO_EMAIL) {
        console.error('Missing SENDGRID_API_KEY or TO_EMAIL env variables.');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server not configured. Contact admin.' })
        };
    }

    sg.setApiKey(SENDGRID_API_KEY);

    let payload;
    try {
        payload = JSON.parse(event.body);
    } catch (err) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const { name = 'Anonymous', email = '', rating = '', message = '', project = '' } = payload;

    // basic validation
    if (!message || !rating) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing rating or message' }) };
    }

    const subject = `New website feedback — ${rating}★ — ${project || 'general'}`;
    const html = `
    <h3>New feedback received</h3>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Rating:</strong> ${escapeHtml(rating)}</p>
    <p><strong>Project:</strong> ${escapeHtml(project)}</p>
    <h4>Message</h4>
    <p>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>
    <hr/>
    <small>Received at ${new Date().toLocaleString()}</small>
  `;

    const msg = {
        to: TO_EMAIL,
        from: FROM_EMAIL,
        subject,
        html
    };

    try {
        await sg.send(msg);
        return {
            statusCode: 200,
            body: JSON.stringify({ ok: true, message: 'Email sent' })
        };
    } catch (err) {
        console.error('SendGrid error', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to send email' })
        };
    }
};

// basic HTML escape for safety
function escapeHtml(unsafe) {
    return String(unsafe || '')
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
