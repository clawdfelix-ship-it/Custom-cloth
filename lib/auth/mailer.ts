/**
 * Transactional email.
 *
 * Two transports, selected by env at send time:
 *
 *  - `RESEND_API_KEY` -> Resend HTTP API (preferred, no dependency).
 *  - `SMTP_USER` + `SMTP_PASS` -> Zoho Mail over SMTP via nodemailer.
 *
 * The SMTP path exists because production runs on Zoho Mail (a regular
 * mailbox, not a transactional API product), so there is no Resend key in
 * this deployment. nodemailer is imported lazily so the dependency only
 * loads when an SMTP send actually happens.
 *
 * When neither is configured the code is generated and logged to the server
 * console so local development still works.
 */

export interface MailResult {
  delivered: boolean;
  /** Set when the message was only logged (development mode). */
  devCode?: string;
}

function fromAddress(): string {
  return (
    process.env.MAIL_FROM ??
    process.env.SMTP_FROM ??
    process.env.SMTP_USER ??
    "Zenex Sports <no-reply@zenexsports.com>"
  );
}

async function sendViaResend(
  to: string,
  subject: string,
  text: string,
): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY!;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [to],
      subject,
      text,
    }),
  });
  if (!response.ok) {
    throw new Error(`Resend delivery failed: ${response.status}`);
  }
}

async function sendViaSmtp(
  to: string,
  subject: string,
  text: string,
): Promise<void> {
  const { default: nodemailer } = await import("nodemailer");

  const port = Number(process.env.SMTP_PORT || 465);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.zoho.com",
    port,
    // 465 = implicit SSL; anything else (e.g. 587) uses STARTTLS.
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: fromAddress(),
    to,
    subject,
    text,
  });
}

export async function sendTwoFactorCode(
  to: string,
  username: string,
  code: string,
): Promise<MailResult> {
  const subject = "Your Zenex Sports verification code";
  const text = `Hi ${username},\n\nYour verification code is ${code}.\nIt expires in 10 minutes.\n\nIf you did not request this code you can ignore this email.`;

  if (process.env.RESEND_API_KEY) {
    await sendViaResend(to, subject, text);
    return { delivered: true };
  }

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    await sendViaSmtp(to, subject, text);
    return { delivered: true };
  }

  console.info(`[2FA] ${to} -> ${code}`);
  return { delivered: false, devCode: code };
}
