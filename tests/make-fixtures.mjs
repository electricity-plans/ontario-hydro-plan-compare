// Writes the made-up Green Button test files to a folder, for the optional Python checks.
// The Node and browser tests don't need this: they create the same files in memory or in a temp folder.
// Usage: node tests/make-fixtures.mjs [folder]      (default: a folder in your system's temp directory)
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { syntheticFiles } from './synthetic.js';
const dir = process.argv[2] || join(tmpdir(), 'pricecompare-fixtures');
mkdirSync(dir, { recursive: true });
const files = syntheticFiles();
for (const [name, xml] of Object.entries(files)) writeFileSync(join(dir, name), xml);
console.log(dir);
