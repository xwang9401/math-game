import fs from 'node:fs';

function replaceOnce(path, oldText, newText) {
  const content = fs.readFileSync(path, 'utf8');
  const count = content.split(oldText).length - 1;
  if (count !== 1) {
    throw new Error(`${path}: expected exactly one match, found ${count}\n--- expected ---\n${oldText}`);
  }
  // A replacement callback keeps `$$` literal instead of treating it as the
  // String.replace token for a single dollar sign.
  fs.writeFileSync(path, content.replace(oldText, () => newText), 'utf8');
}

replaceOnce(
  'kids.js',
  "    $('#kChoices .bubble').forEach((button) => {\n",
  "    $$('#kChoices .bubble').forEach((button) => {\n",
);

replaceOnce(
  'tests/review-regressions.test.mjs',
  "assert.match(kids, /q\\.interactionComplete = true;\\s*setNumberChoicesEnabled\\(true\\)/);\n\n// ---------- Share follow-up stays aligned with q.ask ----------\n",
  "assert.match(kids, /q\\.interactionComplete = true;\\s*setNumberChoicesEnabled\\(true\\)/);\nassert.match(kids, /\\$\\$\\('#kChoices \\.bubble'\\)\\.forEach/);\n\n// ---------- Share follow-up stays aligned with q.ask ----------\n",
);

console.log('apply-latest-kids-fixes.mjs: selector guard applied');
