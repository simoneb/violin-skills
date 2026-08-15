// Regenerates the attribution data shown on the in-app "Open-source licenses"
// screen. Distributing the app is distributing its dependencies, so this list
// has to stay truthful — re-run it whenever production dependencies change:
//
//   npm run licenses:generate
//
// Output: src/constants/licenses.generated.json
//
// Per package we keep the name, version, SPDX id and the copyright lines from
// its own license file. The full license body is stored once per SPDX id
// rather than once per package — ~700 near-identical copies of the MIT text
// would dominate the bundle for no added information.

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUTPUT = 'src/constants/licenses.generated.json';
const LICENSE_FILE = /^(LICEN[CS]E|COPYING)(\.(md|txt))?$/i;
// Anchored at the start of the line: an unanchored match also pulls in the
// "IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE" clause that
// sits inside every MIT body.
const COPYRIGHT_LINE = /^[ \t]*(?:[#*/;-]+[ \t]*)?copyright\b.*$/gim;

function productionPackagePaths() {
  const stdout = execFileSync(
    'npm',
    ['ls', '--omit=dev', '--all', '--parseable', '--long=false'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: process.platform === 'win32' },
  );
  const paths = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes('node_modules'));
  return [...new Set(paths)];
}

function readLicenseText(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return null;
  }
  const match = entries.find((entry) => LICENSE_FILE.test(entry));
  if (!match) return null;
  try {
    return readFileSync(join(dir, match), 'utf8').trim();
  } catch {
    return null;
  }
}

// A license id can be an SPDX expression ("MIT OR Apache-2.0") or, in old
// packages, an object or array. Normalise to a single displayable string.
function normaliseLicense(pkg) {
  if (typeof pkg.license === 'string') return pkg.license;
  if (pkg.license?.type) return pkg.license.type;
  if (Array.isArray(pkg.licenses)) {
    return pkg.licenses.map((l) => l.type ?? l).join(' OR ');
  }
  return 'UNKNOWN';
}

function copyrightLines(text) {
  if (!text) return [];
  const lines = text.match(COPYRIGHT_LINE) ?? [];
  return [
    ...new Set(
      lines
        .map((line) => line.trim())
        // Skip the boilerplate "copyright notice shall be included" sentence
        // that appears inside the MIT permission text itself.
        .filter((line) => !/shall be included|copyright notice and this/i.test(line))
        // Drop shouted boilerplate; real notices are mixed case.
        .filter((line) => line !== line.toUpperCase())
        .filter((line) => line.length > 0 && line.length < 200),
    ),
  ].slice(0, 4);
}

const packages = [];
const licenseTexts = {};
const unknown = [];

for (const dir of productionPackagePaths()) {
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  } catch {
    continue;
  }
  if (!pkg.name || pkg.private) continue;

  const license = normaliseLicense(pkg);
  const text = readLicenseText(dir);

  if (license === 'UNKNOWN' && !text) unknown.push(pkg.name);
  // Keep the first full body seen for each license id as the canonical text.
  if (text && !licenseTexts[license] && text.length < 60_000) {
    licenseTexts[license] = text;
  }

  packages.push({
    name: pkg.name,
    version: pkg.version ?? '',
    license,
    copyright: copyrightLines(text),
  });
}

// One entry per name: duplicated versions of the same package deep in the tree
// are the same attribution.
const byName = new Map();
for (const pkg of packages) {
  if (!byName.has(pkg.name)) byName.set(pkg.name, pkg);
}
const unique = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));

writeFileSync(
  OUTPUT,
  `${JSON.stringify({ packages: unique, licenseTexts }, null, 0)}\n`,
  'utf8',
);

const counts = unique.reduce((acc, p) => {
  acc[p.license] = (acc[p.license] ?? 0) + 1;
  return acc;
}, {});

console.log(`Wrote ${OUTPUT}: ${unique.length} packages`);
console.log(
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => `  ${n.toString().padStart(4)}  ${id}`)
    .join('\n'),
);
if (unknown.length > 0) {
  console.warn(
    `\nNo license id or license file for ${unknown.length} package(s) — check these by hand:\n  ${unknown.join('\n  ')}`,
  );
}
