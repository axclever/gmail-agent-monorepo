export function sortMessagesNewestFirst<
  T extends { gmailInternalDate: Date | null; createdAt: Date },
>(messages: T[]): T[] {
  return [...messages].sort((a, b) => {
    const ta = (a.gmailInternalDate ?? a.createdAt).getTime();
    const tb = (b.gmailInternalDate ?? b.createdAt).getTime();
    return tb - ta;
  });
}

export function formatRecipientEmailList(
  recipients: Array<{ type: "TO" | "CC" | "BCC"; person: { email: string } }>,
  type: "TO" | "CC" | "BCC",
): string {
  const rows = recipients.filter((r) => r.type === type).map((r) => r.person.email);
  return rows.length ? rows.join(", ") : "-";
}

export function formatThreadLastActivity(value: Date | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d);
  }
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return diffHr === 1 ? "1 hour ago" : `${diffHr} hours ago`;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** Prose thread summary from agent `GmailThread.threadAnalysisJson` (LLM thread analysis). */
export function getThreadAnalysisProseSummary(threadAnalysisJson: unknown): string {
  if (!threadAnalysisJson || typeof threadAnalysisJson !== "object" || Array.isArray(threadAnalysisJson)) {
    return "";
  }
  const s = (threadAnalysisJson as Record<string, unknown>).summary;
  return typeof s === "string" ? s.trim() : "";
}

/** Same shape as agent `persistence.js` thread summary line (category | intent | …). */
export function formatRulesSummaryLine(s: {
  category?: string;
  intent?: string;
  priority?: string;
  replyNeeded?: string | boolean;
  messageType?: string;
}): string {
  const parts: string[] = [];
  if (s.category) parts.push(`category: ${s.category}`);
  if (s.intent) parts.push(`intent: ${s.intent}`);
  if (s.priority) parts.push(`priority: ${s.priority}`);
  if (s.replyNeeded !== undefined && s.replyNeeded !== null && s.replyNeeded !== "") {
    parts.push(`reply_needed: ${typeof s.replyNeeded === "boolean" ? String(s.replyNeeded) : s.replyNeeded}`);
  }
  if (s.messageType) parts.push(`type: ${s.messageType}`);
  return parts.length ? parts.join(" | ") : "";
}

/** True when `GmailThread.summary` holds the persisted rules line (category: … | …), not a prose snippet. */
export function isRulesStyleThreadSummary(s: string | null | undefined): boolean {
  const t = s?.trim();
  return !!t && t.includes("category:");
}

export function isReplyRequired(replyNeeded: string | boolean | undefined | null): boolean {
  if (replyNeeded === true) return true;
  if (replyNeeded === false) return false;
  if (replyNeeded == null) return false;
  const s = String(replyNeeded).trim();
  if (!s) return false;
  const v = s.toLowerCase();
  if (["no", "n", "false", "0", "none", "not needed", "not_needed", "not-needed"].includes(v)) {
    return false;
  }
  return ["yes", "y", "true", "1", "required", "needed", "reply_needed", "reply needed"].includes(v);
}
