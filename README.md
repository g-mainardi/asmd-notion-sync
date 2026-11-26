# asmd-notion-sync

Keeps the "Pull Requests" Notion database of the ASMD project in step with the pull requests of [g-mainardi/experiment-2025-llm-with-simulation-in-the-loop](https://github.com/g-mainardi/experiment-2025-llm-with-simulation-in-the-loop). It lives in a repository of its own so that the experiment repository, which will be shared, carries no Notion workflow, token or link.

Every 15 minutes [`notion-sync.yml`](.github/workflows/notion-sync.yml) runs [`sync.mjs`](sync.mjs), which:

- creates or updates one page per pull request (title, number, Conventional Commits type, state, author, branch, base branch, dates, link), writing only when something changed;
- leaves the Tasks relation alone: tasks are linked to pull requests from Notion;
- when a pull request turns Merged, moves each of its tasks to Completato once none of the task's pull requests is still open.

## Setup

One repository secret, `NOTION_API_TOKEN`: the token of a Notion integration connected to the page that holds the databases. The pull requests are read with the workflow's own `GITHUB_TOKEN`, since the experiment repository is public.

Run it by hand from the Actions tab (Run workflow) or with `gh workflow run notion-sync.yml -R g-mainardi/asmd-notion-sync`. Tests: `node --test`.

GitHub can pause scheduled workflows after 60 days without repository activity. Re-enable Sync from the Actions tab if that happens.
