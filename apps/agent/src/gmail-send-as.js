function normalizeSendAsEmails(sendAs) {
  const out = new Set();
  for (const row of sendAs || []) {
    const email = row.sendAsEmail?.trim().toLowerCase();
    if (!email) continue;
    const st = row.verificationStatus?.toLowerCase();
    if (st && st !== "accepted") continue;
    out.add(email);
  }
  return [...out];
}

async function listSendAsEmailsFromGmail(gmail) {
  const res = await gmail.users.settings.sendAs.list({ userId: "me" });
  return normalizeSendAsEmails(res.data.sendAs);
}

function isOutboundFrom(fromEmail, profileEmail, sendAsEmails) {
  if (!fromEmail) return false;
  const from = fromEmail.toLowerCase();
  if (from === profileEmail) return true;
  return (sendAsEmails || []).some((e) => e === from);
}

module.exports = {
  normalizeSendAsEmails,
  listSendAsEmailsFromGmail,
  isOutboundFrom,
};
