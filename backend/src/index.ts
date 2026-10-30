import { app } from "./app.js";
import { seedIfEmpty } from "../prisma/seed.js";

const port = Number(process.env.PORT ?? 4000);
const bindHost = process.env.BIND_HOST || (process.env.NODE_ENV === "production" ? "127.0.0.1" : "0.0.0.0");

async function start() {
  await seedIfEmpty();
  app.listen(port, bindHost, () => {
    console.log(`MCW API listening on http://127.0.0.1:${port}`);
  });
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("index.ts") || process.argv[1].endsWith("index.js"));

if (isMain) {
  start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { app };
