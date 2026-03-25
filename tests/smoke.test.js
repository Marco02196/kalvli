const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const js = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

const requiredIds = [
  "openCameraBtn",
  "recognizeBtn",
  "recognizeList",
  "retryBtn",
  "apiEndpointInput",
  "debugOutput",
  "correctionList"
];

requiredIds.forEach((id) => {
  assert(
    new RegExp(`id=\"${id}\"`).test(html),
    `index.html missing required id: ${id}`
  );
});

const requiredStrings = [
  "DEFAULT_RECOGNITION_ENDPOINT",
  "renderRecognizeList",
  "updateMealItemsFromSource",
  "correctionHistory"
];

requiredStrings.forEach((token) => {
  assert(js.includes(token), `app.js missing expected token: ${token}`);
});

assert(
  css.includes(".recognize__edit") && css.includes(".debug__output"),
  "styles.css missing expected debug or edit styles"
);

console.log("Smoke test passed: core elements and scripts are present.");
