/**
 * PM2 process file for production.
 * `time: true` prefixes every log line with an ISO timestamp (needed to
 * bucket document-AI hangs / cascade failures by hour).
 *
 * Secrets (CRON_SECRET, etc.) stay in the server `.env` / existing env —
 * do not hardcode them here.
 */
module.exports = {
  apps: [
    {
      name: "magazin",
      time: true,
      cwd: __dirname,
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
