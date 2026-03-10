#!/usr/bin/env node
/**
 * Восстановить question_ru и answers_ru из коммита 287950d (Initial commit)
 * и объединить с текущим questions.json (сохраняя page, categories и т.д.)
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");
const dataPath = path.join(root, "data", "questions.json");

const oldJson = execSync("git show 287950d:data/questions.json", {
  encoding: "utf-8",
  cwd: root,
});
const oldQuestions = JSON.parse(oldJson);
const oldById = {};
for (const q of oldQuestions) {
  oldById[q.id] = q;
}

const current = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
let restored = 0;
for (const q of current) {
  const old = oldById[q.id];
  if (old && (old.question_ru || Object.keys(old.answers_ru || {}).length >= 3)) {
    q.question_ru = old.question_ru || q.question_ru || "";
    q.answers_ru = old.answers_ru && Object.keys(old.answers_ru).length >= 3
      ? old.answers_ru
      : (q.answers_ru || {});
    restored++;
  }
}

fs.writeFileSync(dataPath, JSON.stringify(current, null, 2), "utf-8");
console.log(`Restored translations for ${restored} questions`);
