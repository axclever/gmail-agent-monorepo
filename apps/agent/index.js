const { prisma } = require("@gmail-agent/db");

exports.handler = async function handler() {
  try {
    const count = await prisma.person.count();
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Hello from Gmail agent (Lambda) - upd",
        personCount: count,
      }),
    };
  } catch (err) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Hello from Gmail agent (Lambda)",
        personCount: null,
        dbError: err instanceof Error ? err.message : String(err),
      }),
    };
  }
};
