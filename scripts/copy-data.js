const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");
const dataSrc = path.join(root, "data", "questions.json");
const dataDst = path.join(publicDir, "data");
const imagesSrc = path.join(root, "images");
const imagesDst = path.join(publicDir, "images");

if (fs.existsSync(dataSrc)) {
  fs.mkdirSync(dataDst, { recursive: true });
  fs.copyFileSync(dataSrc, path.join(dataDst, "questions.json"));
  console.log("Copied data/questions.json to public");
}
if (fs.existsSync(imagesSrc)) {
  fs.mkdirSync(imagesDst, { recursive: true });
  for (const f of fs.readdirSync(imagesSrc)) {
    if (f.endsWith(".png") || f.endsWith(".jpg") || f.endsWith(".jpeg")) {
      fs.copyFileSync(path.join(imagesSrc, f), path.join(imagesDst, f));
    }
  }
  console.log("Copied images to public");
}
