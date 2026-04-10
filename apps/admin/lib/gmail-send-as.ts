type GmailSendAsRow = {
  sendAsEmail?: string | null;
  verificationStatus?: string | null;
};

type GmailSendAsResponse = {
  sendAs?: GmailSendAsRow[];
};

/** Gmail `users.settings.sendAs` — addresses this account may send as (aliases). Requires `gmail.settings.basic`. */
export function normalizeSendAsEmails(sendAs: GmailSendAsRow[] | undefined): string[] {
  const out = new Set<string>();
  for (const row of sendAs || []) {
    const email = row.sendAsEmail?.trim().toLowerCase();
    if (!email) continue;
    const st = row.verificationStatus?.toLowerCase();
    if (st && st !== "accepted") continue;
    out.add(email);
  }
  return [...out];
}

export async function fetchGmailSendAsEmails(accessToken: string): Promise<string[]> {
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gmail sendAs ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as GmailSendAsResponse;
  return normalizeSendAsEmails(data.sendAs);
}
