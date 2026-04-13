const Mustache = require("mustache");

/**
 * Renders subject and body with Mustache ({{var}} and {{{html}}}, sections {{#x}}…{{/x}}).
 * @param {string} subjectTemplate
 * @param {string} bodyTemplate
 * @param {Record<string, unknown>} view
 * @returns {{ subject: string; body: string }}
 */
function renderEmailTemplate(subjectTemplate, bodyTemplate, view) {
  const safeView = view && typeof view === "object" && !Array.isArray(view) ? view : {};
  return {
    subject: Mustache.render(String(subjectTemplate ?? ""), safeView),
    body: Mustache.render(String(bodyTemplate ?? ""), safeView),
  };
}

module.exports = {
  renderEmailTemplate,
};
