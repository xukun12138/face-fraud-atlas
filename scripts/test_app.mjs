/**
 * Behavior checks for the actual static application's export and risk functions.
 * Run from the repository root: node scripts/test_app.mjs
 * No browser, network, npm package, or production-source modification is required.
 * The minimal DOM captures the Blob passed to a clicked download anchor.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appPath = resolve(root, 'site/app.js');
const catalog = JSON.parse(await readFile(resolve(root, 'site/data/catalog.json'), 'utf8'));
const source = await readFile(appPath, 'utf8');
const downloads = [], timers = [], blobs = new Map();
let blobSequence = 0;

class Element {
  constructor(tag = 'input') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attributes = new Map();
    this.dataset = {};
    this.value = '';
    this.checked = false;
    this.removed = false;
    this._text = '';
  }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent ?? String(child)).join(''); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this._text = ''; this.children = [...children]; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  remove() { this.removed = true; }
  click() {
    assert.equal(this.tagName, 'A', 'Only download anchors should be clicked in this harness');
    assert.ok(blobs.has(this.href), 'Clicked anchor must reference its actual created Blob');
    downloads.push({ filename: this.download, blob: blobs.get(this.href), anchor: this });
  }
}

const inputs = new Map();
for (const selector of ['#paper-search', '#role-filter', '#year-filter', '#type-filter', '#show-official',
  '#risk-prevalence', '#risk-recall', '#risk-fpr', '#risk-sessions', '#protocol-workflow', '#protocol-entry']) {
  inputs.set(selector, new Element());
}
const riskResults = new Element('div');
inputs.set('#risk-results', riskResults);
const axes = ['identity', 'source', 'generator', 'device', 'time'].map(axis => {
  const input = new Element();
  input.checked = true;
  input.dataset.protocolAxis = axis;
  return input;
});
const document = {
  readyState: 'loading',
  baseURI: 'http://localhost:8765/',
  body: new Element('body'),
  addEventListener() { /* Leave DOMContentLoaded pending: do not boot an artificial UI. */ },
  querySelector(selector) { return inputs.get(selector) ?? null; },
  querySelectorAll(selector) { return selector === '[data-protocol-axis]' ? axes : []; },
  createElement(tag) { return new Element(tag); },
  createElementNS(namespace, tag) { const node = new Element(tag); node.namespaceURI = namespace; return node; },
};

class CapturedURL extends URL {
  static createObjectURL(blob) {
    assert.ok(blob instanceof Blob);
    const url = `blob:atlas-test-${++blobSequence}`;
    blobs.set(url, blob);
    return url;
  }
  static revokeObjectURL(url) { blobs.delete(url); }
}

const context = vm.createContext({
  document, URL: CapturedURL, Blob, console,
  window: { setTimeout(callback, delay) { timers.push({ callback, delay }); return timers.length; } },
  __MODULE_URL__: pathToFileURL(appPath).href,
});

// vm.Script parses classic JavaScript, so only the unused module-URL syntax is
// adapted. Every export, filter, CSV encoder, protocol, and risk implementation
// below is executed from the production source, not copied into this test.
assert.equal((source.match(/import\.meta\.url/g) ?? []).length, 1, 'Review harness if module URL usage changes');
const bridge = `\n;globalThis.atlasTest = {
  seed(records) { state.papers = records; },
  filteredPapers, exportCSV, exportBib, exportProtocol, protocolPlan, riskInputs, renderRisk
};`;
new vm.Script(source.replace('import.meta.url', '__MODULE_URL__') + bridge, { filename: appPath }).runInContext(context);
const app = context.atlasTest;
app.seed(catalog.papers);

function captureDownload(callback, filename) {
  const before = downloads.length;
  callback();
  assert.equal(downloads.length, before + 1, 'Function must create and click one download anchor');
  const item = downloads.at(-1);
  assert.equal(item.filename, filename);
  assert.equal(item.anchor.removed, true, 'Temporary anchor must be removed');
  return item.blob;
}

// Independent CSV reader: parse records and delimiters instead of duplicating
// the application's encoder. Newlines inside quoted cells remain cell content.
function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') {
      assert.equal(cell, '', 'Quoted CSV field starts at a field boundary');
      quoted = true;
    } else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\r' || char === '\n') {
      row.push(cell); rows.push(row); row = []; cell = '';
      if (char === '\r' && text[i + 1] === '\n') i++;
    } else cell += char;
  }
  assert.equal(quoted, false, 'No unclosed quoted cell');
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

inputs.get('#role-filter').value = 'morph';
const expectedMorphIDs = ['S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10', 'S11', 'S12'];
assert.deepEqual(Array.from(app.filteredPapers(), paper => paper.id).sort(), expectedMorphIDs);
const csvBlob = captureDownload(() => app.exportCSV(), 'face-fraud-selected-papers.csv');
assert.equal(csvBlob.type, 'text/csv;charset=utf-8');
assert.deepEqual(Array.from(new Uint8Array(await csvBlob.arrayBuffer()).slice(0, 3)), [0xEF, 0xBB, 0xBF]);
const csv = parseCSV(await csvBlob.text());
assert.equal(csv.length - 1, 9);
assert.ok(csv.every(row => row.length === 11), 'Every selected row preserves the CSV column count');
assert.deepEqual(csv.slice(1).map(row => row[0]).sort(), expectedMorphIDs);
const bibBlob = captureDownload(() => app.exportBib(), 'face-fraud-selected-references.bib');
const bibText = await bibBlob.text();
const bibIDs = Array.from(bibText.matchAll(/^@\w+\s*\{\s*([\w-]+)\s*,/gm), match => match[1]);
assert.equal(bibIDs.length, 9);
assert.deepEqual(bibIDs.sort(), expectedMorphIDs, 'BibTeX and CSV export exactly the same filtered IDs');

// Synthetic hostile punctuation exists only inside this VM fixture; the actual
// catalog is neither changed nor supplemented by invented bibliographic data.
const original = catalog.papers.find(paper => paper.id === 'S04');
const fixture = {
  ...original, id: 'TEST_CSV', title: 'A "quoted", title\r\nwith a second line\n中文',
  authors: ['O\'Neil, "Ann"\nsecond line', '作者'],
  venue: 'Venue, with "quotes"', source_url: 'https://example.invalid/?a=1,2&b="q"',
};
app.seed([fixture]);
const escapedCSV = parseCSV(await captureDownload(() => app.exportCSV(), 'face-fraud-selected-papers.csv').text());
assert.equal(escapedCSV.length, 2);
assert.equal(escapedCSV[1].length, escapedCSV[0].length);
const fixtureRecord = Object.fromEntries(escapedCSV[0].map((field, index) => [field, escapedCSV[1][index]]));
assert.equal(fixtureRecord.title, fixture.title);
assert.equal(fixtureRecord.authors, fixture.authors.join('; '));
assert.equal(fixtureRecord.venue, fixture.venue);
assert.equal(fixtureRecord.source_url, fixture.source_url);
app.seed(catalog.papers);

function setRisk(prevalence, recall, fpr, sessions) {
  for (const [key, value] of Object.entries({ prevalence, recall, fpr, sessions })) {
    inputs.get(`#risk-${key}`).value = String(value);
  }
}
function metricValues() {
  return riskResults.children[0].children.map(metric => metric.children[1].textContent);
}

setRisk(0.1, 90, 1, 100000);
inputs.get('#protocol-workflow').value = 'onboarding';
inputs.get('#protocol-entry').value = 'injection';
const protocolBlob = captureDownload(() => app.exportProtocol(), 'face-fraud-protocol-design.json');
const protocol = JSON.parse(await protocolBlob.text());
assert.equal(protocol.schema_version, '1.0');
assert.equal(protocol.status, 'study_design_not_completed_evaluation');
assert.equal(protocol.protected_workflow, 'onboarding');
assert.equal(protocol.attacker_entry, 'injection');
assert.deepEqual(protocol.held_out_axes, ['identity', 'source', 'generator', 'device', 'time']);
const assumptions = protocol.validated_threshold_assumptions;
assert.equal(assumptions.status, 'requires_independent_validation');
assert.equal(assumptions.choose_threshold_on_validation_only, true);
assert.equal(assumptions.freeze_before_test, true);
assert.equal(assumptions.reuse_test_data_for_calibration, false);
assert.equal(assumptions.numerical_inputs_are_hypothetical, true);
assert.deepEqual(assumptions.proposed_operating_point, { prevalence: 0.1, recall: 90, fpr: 1, sessions: 100000 });
assert.equal(assumptions.uncertainty_unit, 'independent_identity_or_session_as_appropriate');
assert.ok(protocol.grouping_requirements.length && protocol.event_requirements.length);
assert.match(protocol.interpretation, /not an automated evaluation/);
assert.ok(Number.isFinite(Date.parse(protocol.exported_at)));

const riskCases = [
  { name: 'illustrative default', values: [0.1, 90, 1, 100000], expected: ['90', '999', '1,089', '8.26%', '10', '98,901'] },
  { name: 'zero prevalence and zero false alarms', values: [0, 100, 0, 100], expected: ['0', '0', '0', '无告警，未定义', '0', '100'] },
  { name: 'all attacks detected', values: [100, 100, 0, 10], expected: ['10', '0', '10', '100%', '0', '0'] },
  { name: 'all legitimate sessions alerted', values: [0, 100, 100, 10], expected: ['0', '10', '10', '0%', '0', '0'] },
  { name: 'all attacks missed and no alerts', values: [100, 0, 0, 10], expected: ['0', '0', '0', '无告警，未定义', '10', '0'] },
];
for (const test of riskCases) {
  setRisk(...test.values);
  app.renderRisk();
  assert.deepEqual(metricValues(), test.expected, test.name);
  assert.doesNotMatch(metricValues().join(' '), /NaN|Infinity/);
}
setRisk(0.0001, 100, 0, 100);
app.renderRisk();
assert.equal(metricValues()[0], '0.0001', 'A small positive expected count must not be displayed as zero');
assert.equal(metricValues()[3], '100%');
setRisk('', 90, 1, 100000);
assert.ok(Array.from(app.riskInputs().invalid).includes('prevalence'));
app.renderRisk();
assert.equal(riskResults.children[0].getAttribute('role'), 'alert');
assert.equal(app.protocolPlan().validated_threshold_assumptions.proposed_operating_point, null);

for (const timer of timers) { assert.equal(timer.delay, 1500); timer.callback(); }
assert.equal(blobs.size, 0, 'All created object URLs are eventually revoked');
console.log(JSON.stringify({
  result: 'passed',
  morph_csv_rows: csv.length - 1,
  morph_bib_entries: bibIDs.length,
  csv_punctuation_round_trip: 'quotes, commas, CRLF, LF and Unicode preserved',
  protocol_axes: protocol.held_out_axes.length,
  protocol_status: protocol.status,
  risk_cases: riskCases.length + 2,
  captured_blob_downloads: downloads.length,
  boundary: 'Actual production functions executed in a Node VM. Browser/OS download events were not tested.',
}, null, 2));
