import { handleReminderCron } from "./handler.js";

Deno.serve(request => handleReminderCron(request, {
  edgeSecret: Deno.env.get("EDGE_CRON_SECRET"),
  apiSecret: Deno.env.get("CRON_SECRET"),
  apiUrl: Deno.env.get("REMINDER_API_URL"),
}));
