export function renderEmailTemplate(
  subjectTemplate: string,
  bodyTemplate: string,
  view: Record<string, unknown>,
): { subject: string; body: string };
