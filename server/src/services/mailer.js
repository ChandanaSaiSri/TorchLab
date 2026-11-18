import nodemailer from 'nodemailer';

// Configure with SMTP_URL (for example smtps://user:pass@smtp.gmail.com:465) and MAIL_FROM.
// Without SMTP_URL nothing is sent: the message is printed in the API window instead, which is
// what you want while developing on your own machine.
const SMTP_URL = process.env.SMTP_URL || '';
const FROM = process.env.MAIL_FROM || 'TorchLab <no-reply@torchlab.local>';
export const mailEnabled = Boolean(SMTP_URL);
export const appUrl = () => (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');

let transport;
const getTransport = () => (transport ||= nodemailer.createTransport(SMTP_URL));

/** Never throws: a mail problem must not break sign-up or the reset form. Returns true if handed to SMTP. */
export async function sendMail({ to, subject, text }) {
  if (!mailEnabled) {
    console.log(`\n--- Email (SMTP not configured, so not sent) -------------\nTo: ${to}\nSubject: ${subject}\n\n${text}\n----------------------------------------------------------\n`);
    return false;
  }
  try {
    await getTransport().sendMail({ from: FROM, to, subject, text });
    return true;
  } catch (e) {
    console.error(`Could not send email to ${to}: ${e.message}`);
    return false;
  }
}
