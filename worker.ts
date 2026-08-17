import { workerLoop } from "./src/lib/jobs/queue";

console.log("Blip worker starting...");
workerLoop().catch((err) => {
  console.error("Worker crashed:", err);
  process.exit(1);
});
