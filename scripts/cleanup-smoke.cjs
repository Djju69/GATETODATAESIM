const { default: postgres } = require("postgres");
const fs = require("fs");
const url = fs.readFileSync(".env", "utf8").split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="))?.split("=").slice(1).join("=").trim();
const sql = postgres(url, { prepare: false, max: 1 });
(async () => {
  const ids = await sql`SELECT id FROM orders WHERE email = 'smoke@test.local'`;
  for (const o of ids) {
    await sql`DELETE FROM order_events WHERE order_id = ${o.id}`;
    await sql`DELETE FROM payments WHERE order_id = ${o.id}`;
    await sql`DELETE FROM orders WHERE id = ${o.id}`;
  }
  console.log("cleaned:", ids.length);
  await sql.end();
})();
