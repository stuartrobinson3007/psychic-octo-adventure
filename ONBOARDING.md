# Gambit onboarding

How Gambit works, and how to start working here. Two tracks over one shared core.

---

## Start here, whichever track you are on

| | |
|---|---|
| **[`core/01-how-we-work.md`](./core/01-how-we-work.md)** | The whole loop in one read — HAPI, the values, the stages, the AI PRD, and the rule that ties them together. ~15 min |
| **[`core/02-reading-order.md`](./core/02-reading-order.md)** | What to read next, in what order, and how much of each |

---

## Then pick your track

### Candidate

You are doing the design-and-build exercise.

**→ [`gambit-onboarding-task.md`](./gambit-onboarding-task.md)** — the brief, the learning
materials, the task, and what to deliver.

Everything you need is in this repository. The task is a chat-first interface over a trade-builder
GUI, delivered as a live demo plus a pull request **in your own copy of this repo**.

| Supporting material | |
|---|---|
| [`git-workshop.html`](./git-workshop.html) | Git + AI workshop slides — open in a browser |
| [`gambit-claude-guide.md`](./gambit-claude-guide.md) | Claude + Git primer |
| [`bball-gm-engine-teardown.md`](./bball-gm-engine-teardown.md) | API + GUI reference for the exercise |
| [`claude-git-workshop/`](./claude-git-workshop/) | Workshop exercises, handouts, sample repos |

> **This repository is a GitHub template.** Don't fork it. Click **"Use this template" → "Create a
> new repository"**, keep it public, and do your work there. Open your pull request **inside your
> own repo** — feature branch → your `main` — and send us the link. Do not open a PR against this
> repository; those get closed.

### Employee

You've joined. This is day one through your first capability.

**→ [`employee/README.md`](./employee/README.md)** — access, the repos, the first small thing you
take all the way through, how the shared workspace works, and what "senior" looks like here.

---

## Why one repository for both

The candidate exercise and the employee onboarding teach the same thing — the loop — and differ
only in what you do with it. Keeping them apart meant two descriptions of how Gambit works, and two
descriptions means one of them is out of date. `core/` is written once; both tracks point at it.

**This repository is public.** Nothing in it names a customer, an environment, a credential or an
internal URL. The employee track carries process and pointers; anything specific lives in the
internal docs and the workspace.

## Quick open

```bash
git clone https://github.com/gambit-lab/gambit-hapi-onboarding.git
cd gambit-hapi-onboarding

open git-workshop.html          # slides (macOS)
# or serve locally if your browser blocks file:// assets
python3 -m http.server 8080     # then http://localhost:8080/git-workshop.html
```

---

*Gambit Labs · HAPI onboarding*
