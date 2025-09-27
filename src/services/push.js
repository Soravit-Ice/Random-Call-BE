import webpush from "web-push";
import { config } from "../config.js";

export function setupVapid() {
  if (!config.vapid.publicKey || !config.vapid.privateKey || !config.vapid.subject) {
    console.warn("VAPID keys missing. Push notifications disabled.");
    return;
  }

  webpush.setVapidDetails(config.vapid.subject, config.vapid.publicKey, config.vapid.privateKey);
}

export async function sendPush(subscription, payload) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
  } catch (err) {
    console.warn("webpush error", err?.statusCode || err?.message);
  }
}
