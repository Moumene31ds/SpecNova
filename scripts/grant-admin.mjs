import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const env = readFileSync(".env.local", "utf8");
const m = env.match(/FIREBASE_SERVICE_ACCOUNT_JSON=(.*)/);
if (!m) throw new Error("no service account");
const raw = m[1].trim();
const sa = raw.startsWith('"') ? JSON.parse(raw) : JSON.parse(decodeURIComponent(raw));

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const email = "attouabdelkarim2@gmail.com";
let user;
try {
  user = await admin.auth().getUserByEmail(email);
  console.log("USER FOUND: uid =", user.uid, "| disabled =", user.disabled);
} catch (e) {
  console.log("USER NOT FOUND:", e.message);
  process.exit(1);
}

await admin.auth().setCustomUserClaims(user.uid, {
  admin: true,
  editor: true,
  roles: { admin: true, editor: true },
});
console.log("ADMIN CLAIMS SET for", email, "->", user.uid);
process.exit(0);
