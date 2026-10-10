import User from "../models/User.js";
import { httpError } from "../middleware/errorHandler.js";
import { str } from "../utils/validate.js";
import { vapidPublicKey } from "../services/notify.js";

const MAX_DEVICES = 10;

export function getKey(req, res) {
  res.json({ publicKey: vapidPublicKey() });
}

export async function subscribe(req, res) {
  const subscription = req.body?.subscription;
  if (typeof subscription !== "object" || subscription === null) throw httpError(400, "Subscription is required");

  const endpoint = str(subscription.endpoint, "endpoint", { required: true, max: 1000 });
  if (!endpoint.startsWith("https://")) throw httpError(400, "Invalid push endpoint");
  const p256dh = str(subscription.keys?.p256dh, "p256dh", { required: true, max: 200 });
  const auth = str(subscription.keys?.auth, "auth", { required: true, max: 100 });

  // Replace any existing entry for this device, keep only the newest few devices
  await User.updateOne({ _id: req.user._id }, { $pull: { pushSubscriptions: { endpoint } } });
  await User.updateOne(
    { _id: req.user._id },
    { $push: { pushSubscriptions: { $each: [{ endpoint, keys: { p256dh, auth } }], $slice: -MAX_DEVICES } } }
  );
  res.json({ ok: true });
}

export async function unsubscribe(req, res) {
  const endpoint = str(req.body?.endpoint, "endpoint", { required: true, max: 1000 });
  await User.updateOne({ _id: req.user._id }, { $pull: { pushSubscriptions: { endpoint } } });
  res.json({ ok: true });
}
