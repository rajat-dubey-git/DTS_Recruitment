import nodemailer from 'nodemailer'

function mailConfig() {
  const host = process.env.SMTP_HOST?.trim()
  const port = Number(process.env.SMTP_PORT)
  const from = process.env.MAIL_FROM?.trim()
  const user = process.env.SMTP_USER?.trim()
  const password = process.env.SMTP_PASSWORD

  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !from) {
    return null
  }
  if ((user && !password) || (!user && password)) {
    throw Object.assign(new Error('SMTP_USER and SMTP_PASSWORD must both be configured.'), { statusCode: 500 })
  }

  return {
    host,
    port,
    from,
    secure: process.env.SMTP_SECURE === 'true',
    ...(user ? { auth: { user, pass: password } } : {}),
  }
}

export function isEmailConfigured() {
  return Boolean(mailConfig())
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
}

export async function sendEmail({ to, subject, text, html }) {
  const config = mailConfig()
  if (!config) {
    throw Object.assign(new Error('Email delivery is not configured. Set SMTP_HOST, SMTP_PORT and MAIL_FROM.'), { statusCode: 503 })
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      ...(config.auth ? { auth: config.auth } : {}),
    })
    await transporter.sendMail({ from: config.from, to, subject, text, html })
  } catch (error) {
    console.error('Email delivery failed:', error?.code ?? error?.name ?? 'unknown error')
    throw Object.assign(new Error('Email delivery failed. Check the SMTP configuration and try again.'), { statusCode: 502 })
  }
}

export async function sendInvitationEmail({ to, fullName, invitationUrl, expiresAt }) {
  const safeName = escapeHtml(fullName)
  const safeUrl = escapeHtml(invitationUrl)
  const expiry = new Date(expiresAt).toLocaleString()
  await sendEmail({
    to,
    subject: 'Set up your DTS Recruitment account',
    text: `Hello ${fullName},\n\nSet your password using this one-time link:\n${invitationUrl}\n\nThe link expires at ${expiry}. If you did not expect this invitation, you can ignore this email.`,
    html: `<p>Hello ${safeName},</p><p>Set your password using this one-time link:</p><p><a href="${safeUrl}">Set up your account</a></p><p>This link expires at ${escapeHtml(expiry)}. If you did not expect this invitation, you can ignore this email.</p>`,
  })
}

export async function sendRequirementIntakeEmail({ to, companyName, intakeUrl, expiresAt }) {
  const safeCompany = escapeHtml(companyName)
  const safeUrl = escapeHtml(intakeUrl)
  const expiry = new Date(expiresAt).toLocaleString()
  await sendEmail({
    to,
    subject: 'Hiring requirement form',
    text: `Please submit your hiring requirement for ${companyName} using this secure link:\n${intakeUrl}\n\nThe link expires at ${expiry}.`,
    html: `<p>Please submit your hiring requirement for ${safeCompany} using this secure link:</p><p><a href="${safeUrl}">Open requirement form</a></p><p>The link expires at ${escapeHtml(expiry)}.</p>`,
  })
}
