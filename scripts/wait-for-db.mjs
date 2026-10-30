// Cross-platform "wait until Postgres accepts connections" used by CI.
import pg from "pg";

const url = process.env.DATABASE_URL;
const deadline = Date.now() + 60_000;

while (true) {
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    await client.query("select 1");
    await client.end();
    console.log("Postgres is ready");
    break;
  } catch {
    await client.end().catch(() => {});
    if (Date.now() > deadline) {
      console.error("Timed out waiting for Postgres");
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}
