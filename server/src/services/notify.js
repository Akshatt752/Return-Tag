import nodemailer from "nodemailer";
import webpush from "web-push";
import User from "../models/User.js";
import { publicAppUrl } from "../utils/codes.js";
import { decrypt } from "../utils/crypto.js";

// Notifications are fire-and-forget: a slow mail server must never block a finder's report
const isTest = () => process.env.NODE_ENV === "test";

let transporter;
function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 465;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendEmail({ to, subject, text }) {
  if (isTest()) return;
  const mailer = getTransporter();
  if (!mailer) {
    // No SMTP configured (local development): print the email so links can still be followed
    console.log(`\n[email] To: ${to}\nSubject: ${subject}\n\n${text}\n`);
    return;
  }
  try {
    await mailer.sendMail({ from: process.env.EMAIL_FROM || process.env.SMTP_USER, to, subject, text });
  } catch (err) {
    console.error("Email failed:", err.message);
  }
}

let vapidConfigured = null;
function pushEnabled() {
  if (vapidConfigured === null) {
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
    vapidConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
    if (vapidConfigured) {
      webpush.setVapidDetails(VAPID_SUBJECT || "mailto:admin@returntag.app", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    }
  }
  return vapidConfigured;
}

export const vapidPublicKey = () => (pushEnabled() ? process.env.VAPID_PUBLIC_KEY : null);

async function sendPush(user, payload) {
  const expired = [];
  await Promise.all(
    user.pushSubscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
          JSON.stringify(payload),
          { TTL: 24 * 60 * 60 }
        );
      } catch (err) {
        // 404/410 mean the browser dropped the subscription
        if (err.statusCode === 404 || err.statusCode === 410) expired.push(sub.endpoint);
        else console.error("Push failed:", err.message);
      }
    })
  );
  if (expired.length) {
    await User.updateOne({ _id: user._id }, { $pull: { pushSubscriptions: { endpoint: { $in: expired } } } });
  }
}

// Tells an owner something happened. Never includes anything about the finder.
// `path` is an app route like /inbox/<id>; `email: false` sends push only.
export async function notifyOwner(ownerId, { subject, text, path, email = true }) {
  if (isTest()) return;
  try {
    const user = await User.findById(ownerId).select("+pushSubscriptions");
    if (!user) return;
    const jobs = [];
    if (email && user.notify?.email !== false) {
      jobs.push(
        sendEmail({
          to: user.email,
          subject,
          text: `Hi ${user.name},\n\n${text}\n\nOpen ReturnTag: ${publicAppUrl()}${path}\n\nReturnTag never shares your contact details with finders.`,
        })
      );
    }
    if (user.notify?.push !== false && user.pushSubscriptions.length && pushEnabled()) {
      jobs.push(sendPush(user, { title: subject, body: text, url: path }));
    }
    await Promise.all(jobs);
  } catch (err) {
    console.error("Owner notification failed:", err.message);
  }
}

// Emails a finder who left an address. `report` must be loaded with +finderEmailEnc +finderTokenEnc.
export async function notifyFinder(report, { subject, text }) {
  if (isTest() || !report.finderEmailEnc || !report.finderTokenEnc) return;
  try {
    const link = `${publicAppUrl()}/r/${report._id}#${decrypt(report.finderTokenEnc)}`;
    await sendEmail({
      to: decrypt(report.finderEmailEnc),
      subject,
      text: `${text}\n\nYour private conversation link: ${link}\n\nYour email is never shown to the owner. Keep this link private, since anyone with it can read the conversation.`,
    });
  } catch (err) {
    console.error("Finder notification failed:", err.message);
  }
}
