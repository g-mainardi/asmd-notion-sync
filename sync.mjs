// Keeps the "Pull Requests" database on Notion in step with the pull requests of the ASMD experiment fork:
// - every pull request gets a page with its title, number, type, state, author, branches, dates and link, written only
//   when one of them changed;
// - the Tasks relation belongs to Notion and is never written here, so the shared repo carries no Notion links;
// - when a pull request turns Merged, each of its tasks moves to Completato once none of the task's pull requests is
//   still open.
import { fileURLToPath } from 'node:url';

const REPO = 'g-mainardi/experiment-2025-llm-with-simulation-in-the-loop';
const PULLS = '424f720c-4b16-8184-965a-000b729684da'; // data source of the Pull Requests database
const DONE = 'Completato'; // the complete option of Stato in the tasks database

export function state(pr) {
  if (pr.merged_at) return 'Merged';
  if (pr.state === 'closed') return 'Closed';
  return pr.draft ? 'Draft' : 'Open';
}

// The Conventional Commits type in the title
export const type = (title) => title.match(/^([a-z]+)(?:\([^)]*\))?!?:/)?.[1] ?? null;

export function properties(pr) {
  return {
    Title: { title: [{ text: { content: `#${pr.number} ${pr.title}` } }] },
    Number: { number: pr.number },
    Type: { select: type(pr.title) && { name: type(pr.title) } },
    Link: { url: pr.html_url },
    State: { status: { name: state(pr) } },
    Author: { select: { name: pr.user.login } },
    Branch: { rich_text: [{ text: { content: pr.head.ref } }] },
    Base: { rich_text: [{ text: { content: pr.base.ref } }] },
    Opened: { date: { start: pr.created_at } },
    Merged: { date: pr.merged_at ? { start: pr.merged_at } : null },
  };
}

const plain = (rich) => rich.map((t) => t.plain_text ?? t.text.content).join('');
// Notion keeps date-times to the minute, GitHub to the second
const minute = (iso) => (iso ? Math.floor(Date.parse(iso) / 60000) : null);

// What properties() writes, read back from its payload or from a page of the database: equal means nothing to write
export function values(p) {
  return JSON.stringify([
    plain(p.Title.title),
    p.Number.number,
    p.Type.select?.name ?? null,
    p.Link.url,
    p.State.status?.name,
    p.Author.select?.name,
    plain(p.Branch.rich_text),
    plain(p.Base.rich_text),
    minute(p.Opened.date?.start),
    minute(p.Merged.date?.start),
  ]);
}

async function call(url, token, method = 'GET', body) {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  if (url.includes('notion.com')) headers['Notion-Version'] = '2026-03-11';
  const res = await fetch(url, { method, headers, body: body && JSON.stringify(body) });
  if (!res.ok) throw new Error(`${method} ${url}: ${res.status} ${await res.text()}`);
  return res.json();
}

const notion = (path, method, body) => call(`https://api.notion.com/v1/${path}`, process.env.NOTION_API_TOKEN, method, body);
const github = (path) => call(`https://api.github.com/${path}`, process.env.GH_TOKEN);

async function pulls() {
  const all = [];
  for (let page = 1; ; page++) {
    const batch = await github(`repos/${REPO}/pulls?state=all&per_page=100&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) return all;
  }
}

async function query(filter) {
  const pages = [];
  let cursor;
  do {
    const res = await notion(`data_sources/${PULLS}/query`, 'POST', { filter, start_cursor: cursor });
    pages.push(...res.results);
    cursor = res.next_cursor;
  } while (cursor);
  return pages;
}

async function complete(page) {
  for (const { id: task } of page.properties.Tasks.relation) {
    const open = await query({
      and: [
        { property: 'Tasks', relation: { contains: task } },
        { property: 'State', status: { does_not_equal: 'Merged' } },
        { property: 'State', status: { does_not_equal: 'Closed' } },
      ],
    });
    const others = open.filter((p) => p.id !== page.id).map((p) => p.url);
    if (others.length) console.log(`task ${task} stays: still open ${others.join(' ')}`);
    else {
      await notion(`pages/${task}`, 'PATCH', { properties: { Stato: { status: { name: DONE } } } });
      console.log(`task ${task} ${DONE}`);
    }
  }
}

async function main() {
  if (!process.env.NOTION_API_TOKEN) throw new Error('NOTION_API_TOKEN is not set');
  const pages = new Map((await query()).map((p) => [p.properties.Number.number, p]));
  for (const pr of await pulls()) {
    const props = properties(pr);
    const page = pages.get(pr.number);
    if (page && values(page.properties) === values(props)) continue;
    // Tasks before the page: if the run stops in between, the next one still sees the pull request turn Merged
    if (page && state(pr) === 'Merged' && page.properties.State.status?.name !== 'Merged') await complete(page);
    if (page) await notion(`pages/${page.id}`, 'PATCH', { properties: props });
    else await notion('pages', 'POST', { parent: { data_source_id: PULLS }, properties: props });
    console.log(`#${pr.number} ${page ? 'updated' : 'created'}: ${state(pr)}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
