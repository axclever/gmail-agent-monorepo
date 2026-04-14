const fs = require("fs");
const path = require("path");

const SKIP_SENDERS = new Set(["no-reply@partnerpage.io"]);
const GMAIL_EXCLUDE_QUERY = "-from:no-reply@partnerpage.io";
const GMAIL_POLL_WINDOW_MINUTES = Number(process.env.GMAIL_POLL_WINDOW_MINUTES || 30);
const OPENAI_MINI_MODEL = process.env.OPENAI_MINI_MODEL || "gpt-4o-mini";
const OPENAI_STRONG_MODEL = process.env.OPENAI_STRONG_MODEL || "gpt-4o";
const CLASSIFIER_CONFIDENCE_THRESHOLD = 0.72;
const TELEGRAM_BOT_URL = String(process.env.TELEGRAM_BOT_URL || "").trim();
const TELEGRAM_BOT_API_TOKEN = String(process.env.TELEGRAM_BOT_API_TOKEN || "").trim();
const TELEGRAM_BOT_TARGET = String(process.env.TELEGRAM_BOT_TARGET || "onpro-logs-channel").trim();
const GMAIL_AGENT_ADMIN_URL = String(process.env.GMAIL_AGENT_ADMIN_URL || "").trim();

/** When false, the agent only creates `GmailAction` rows; it does not send mail or run side effects. */
const EXECUTE_PENDING_ACTIONS = process.env.EXECUTE_PENDING_ACTIONS === "true";

function ensureLocalEnvLoaded() {
  if (process.env.NODE_ENV === "production") return;

  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "../../../.env"),
    path.resolve(__dirname, "../../../../.env"),
  ];

  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    // eslint-disable-next-line global-require
    require("dotenv").config({ path: envPath });
    break;
  }
}

module.exports = {
  SKIP_SENDERS,
  GMAIL_EXCLUDE_QUERY,
  GMAIL_POLL_WINDOW_MINUTES,
  OPENAI_MINI_MODEL,
  OPENAI_STRONG_MODEL,
  CLASSIFIER_CONFIDENCE_THRESHOLD,
  TELEGRAM_BOT_URL,
  TELEGRAM_BOT_API_TOKEN,
  TELEGRAM_BOT_TARGET,
  GMAIL_AGENT_ADMIN_URL,
  EXECUTE_PENDING_ACTIONS,
  ensureLocalEnvLoaded,
};

