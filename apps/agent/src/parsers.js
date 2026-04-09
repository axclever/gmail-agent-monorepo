function decodeBase64Url(value) {
  if (!value) return "";
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf-8");
}

function headerMap(headers = []) {
  const map = new Map();
  for (const h of headers) {
    if (!h?.name) continue;
    map.set(h.name.toLowerCase(), h.value || "");
  }
  return map;
}

function extractEmail(raw = "") {
  const match = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : null;
}

function extractEmails(raw = "") {
  const matches = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return [...new Set(matches.map((m) => m.toLowerCase()))];
}

function extractBodies(payload) {
  let textBody = "";
  let htmlBody = "";

  const walk = (part) => {
    if (!part) return;
    const mime = part.mimeType || "";

    if (mime === "text/plain" && part.body?.data && !textBody) {
      textBody = decodeBase64Url(part.body.data);
    }
    if (mime === "text/html" && part.body?.data && !htmlBody) {
      htmlBody = decodeBase64Url(part.body.data);
    }

    if (Array.isArray(part.parts)) {
      for (const child of part.parts) walk(child);
    }
  };

  walk(payload);
  return { textBody, htmlBody };
}

module.exports = {
  headerMap,
  extractEmail,
  extractEmails,
  extractBodies,
};

