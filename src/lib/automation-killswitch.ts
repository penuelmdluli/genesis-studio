/**
 * Master kill switch for all automated systems.
 * Set AUTOMATION_PAUSED=true in wrangler vars to pause all cron-driven automation.
 * Real user generation, webhooks, and health checks are NOT affected.
 */
export function isAutomationPaused(): boolean {
  return process.env.AUTOMATION_PAUSED === "true";
}
