const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../frontend/js/catalog.js'), 'utf8');
const context = vm.createContext({console});
vm.runInContext(`${source}\nthis.dedupe = dedupeCatalogObjects;`, context);

const obj = (n, a = '', source = 'openngc_ngc') => ({n, a, source});

test('NGC/IC component suffixes remain distinct', () => {
  const rows = [obj('IC 186'), obj('IC 186A'), obj('IC 186B'), obj('IC 186NED03')];
  assert.equal(context.dedupe(rows).length, rows.length);
});

test('exact Messier aliases merge with OpenNGC entries', () => {
  const rows = [
    obj('M31', 'NGC 224 · Andromeda Galaxy', 'messier'),
    obj('NGC 224', 'M31 · Andromeda Galaxy'),
    obj('M45', 'Melotte 22 · Pleiades', 'messier'),
    obj('Melotte 22', 'M45 · Pleiades', 'openngc_addendum'),
  ];
  assert.equal(context.dedupe(rows).length, 2);
});
