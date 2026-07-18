const { spawnSync } = require("node:child_process");

function run(args) {
  console.log(`> next ${args.join(" ")}`);
  return spawnSync("npx", ["next", ...args], {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
}

let result = run(["build", "--webpack"]);
if (result.status !== 0) {
  console.warn(
    "next build --webpack failed; retrying with default bundler (install next@16.2.9 for --webpack).",
  );
  result = run(["build"]);
}
process.exit(result.status ?? 1);
