import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlayerNames } from './utils.js';

describe('parsePlayerNames', () => {
  it('parses newline-separated names', () => {
    assert.deepEqual(parsePlayerNames('Sardor\nAziz\nBekzod'), [
      'Sardor',
      'Aziz',
      'Bekzod',
    ]);
  });

  it('parses comma-separated names', () => {
    assert.deepEqual(parsePlayerNames('Sardor, Aziz, Bekzod'), [
      'Sardor',
      'Aziz',
      'Bekzod',
    ]);
  });

  it('parses mixed comma and newline', () => {
    assert.deepEqual(parsePlayerNames('Sardor, Aziz\nBekzod\nJasur, Temur'), [
      'Sardor',
      'Aziz',
      'Bekzod',
      'Jasur',
      'Temur',
    ]);
  });

  it('trims whitespace', () => {
    assert.deepEqual(parsePlayerNames('  Sardor  ,  Aziz \n Bekzod  '), [
      'Sardor',
      'Aziz',
      'Bekzod',
    ]);
  });

  it('ignores empty values', () => {
    assert.deepEqual(parsePlayerNames('Sardor,\n, Aziz\n\n'), ['Sardor', 'Aziz']);
  });

  it('preserves multi-word names', () => {
    assert.deepEqual(parsePlayerNames('Muhammad Ali\nSardor Karimov'), [
      'Muhammad Ali',
      'Sardor Karimov',
    ]);
  });
});
