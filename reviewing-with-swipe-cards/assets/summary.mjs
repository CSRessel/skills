// Print a plain-text summary of a swipe-card review.
// Usage: node summary.mjs <deck.json> [answers.json]
import { readFileSync, existsSync } from 'node:fs';
const deckPath = process.argv[2];
if (!deckPath || deckPath === '--help') { console.log('Usage: node summary.mjs <deck.json> [answers.json]'); process.exit(deckPath ? 0 : 2); }
const answersPath = process.argv[3] ?? deckPath.replace(/\.json$/, '') + '.answers.json';
const deck = JSON.parse(readFileSync(deckPath, 'utf8'));
const answers = existsSync(answersPath) ? (JSON.parse(readFileSync(answersPath, 'utf8')).answers ?? {}) : {};
const counts = { agree: 0, disagree: 0, open: 0 };
deck.items.forEach((it, i) => {
  const a = answers[it.id];
  const d = a?.decision ?? 'open';
  counts[d] = (counts[d] ?? 0) + 1;
  console.log(`${String(i + 1).padStart(2)}. [${d.toUpperCase()}] ${it.id}: ${it.title}`);
  if (a?.note) console.log(`    note: ${a.note.replace(/\n/g, '\n          ')}`);
});
console.log(`\n${counts.agree} agree · ${counts.disagree} disagree · ${counts.open} open`);
