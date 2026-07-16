import fs from "node:fs/promises";

const reportPath = new URL(
  "../coverage/coverage-summary.json",
  import.meta.url
);

let report;
try {
  report = JSON.parse(await fs.readFile(reportPath, "utf8"));
} catch (error) {
  if (error?.code === "ENOENT") {
    console.log("## Unit-test coverage\n\nNo coverage report was produced.");
    process.exit(0);
  }
  throw error;
}

const metrics = [
  ["Statements", report.total.statements],
  ["Branches", report.total.branches],
  ["Functions", report.total.functions],
  ["Lines", report.total.lines],
];

console.log("## Unit-test coverage");
console.log("");
console.log("| Metric | Covered | Total | Coverage |");
console.log("|---|---:|---:|---:|");
for (const [name, value] of metrics) {
  console.log(
    `| ${name} | ${value.covered} | ${value.total} | ${value.pct}% |`
  );
}
console.log("");
console.log(
  "The downloadable `unit-test-coverage` artifact contains the full HTML and LCOV reports."
);
