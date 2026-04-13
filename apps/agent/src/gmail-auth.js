const { google } = require("googleapis");

/**
 * @param {{ refreshToken?: string | null; accessToken?: string | null }} mailbox
 * @returns {{ gmail: import("googleapis").gmail_v1.Gmail; latestAccessToken: string | null; latestRefreshToken: string | null }}
 */
function createGmailForMailbox(mailbox) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET");
  }
  if (!mailbox.refreshToken && !mailbox.accessToken) {
    throw new Error("Mailbox has no OAuth tokens");
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({
    refresh_token: mailbox.refreshToken || undefined,
    access_token: mailbox.accessToken || undefined,
  });

  let latestAccessToken = mailbox.accessToken;
  let latestRefreshToken = mailbox.refreshToken;
  oauth2.on("tokens", (tokens) => {
    if (tokens.access_token) latestAccessToken = tokens.access_token;
    if (tokens.refresh_token) latestRefreshToken = tokens.refresh_token;
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2 });
  return { gmail, latestAccessToken, latestRefreshToken };
}

module.exports = {
  createGmailForMailbox,
};
