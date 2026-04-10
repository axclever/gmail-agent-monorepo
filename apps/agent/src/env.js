const fs = require("fs");
const path = require("path");

const SKIP_SENDERS = new Set(["no-reply@partnerpage.io"]);
const GMAIL_EXCLUDE_QUERY = "-from:no-reply@partnerpage.io";
const OPENAI_MINI_MODEL = process.env.OPENAI_MINI_MODEL || "gpt-4o-mini";
const OPENAI_STRONG_MODEL = process.env.OPENAI_STRONG_MODEL || "gpt-4o";
const CLASSIFIER_CONFIDENCE_THRESHOLD = 0.72;

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
  OPENAI_MINI_MODEL,
  OPENAI_STRONG_MODEL,
  CLASSIFIER_CONFIDENCE_THRESHOLD,
  ensureLocalEnvLoaded,
};

