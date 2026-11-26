import assert from 'node:assert/strict';
import { test } from 'node:test';
import { properties, state, type, values } from './sync.mjs';

const pr = {
  number: 28,
  title: 'feat(server): oracle for line, square and V formations',
  html_url: 'https://github.com/g-mainardi/experiment-2025-llm-with-simulation-in-the-loop/pull/28',
  state: 'open',
  draft: false,
  merged_at: null,
  user: { login: 'g-mainardi' },
  head: { ref: 'feat/shape-oracle' },
  base: { ref: 'exp/feedback-comparison' },
  created_at: '2026-11-13T04:19:38Z',
};

test('type and state come from the pull request', () => {
  assert.equal(type(pr.title), 'feat');
  assert.equal(type('refactor!: migrate to Scala 3 and Alchemist 49.1.0'), 'refactor');
  assert.equal(type('Update README'), null);
  assert.equal(state(pr), 'Open');
  assert.equal(state({ ...pr, draft: true }), 'Draft');
  assert.equal(state({ ...pr, state: 'closed' }), 'Closed');
  assert.equal(state({ ...pr, state: 'closed', merged_at: '2026-11-14T10:00:00Z' }), 'Merged');
});

test('a page stored by Notion to the minute needs no update, a merge does', () => {
  const page = structuredClone(properties(pr));
  page.Opened.date.start = '2026-11-13T04:19:00.000+00:00';
  assert.equal(values(page), values(properties(pr)));
  assert.notEqual(values(properties({ ...pr, merged_at: '2026-11-14T10:00:00Z' })), values(page));
});
