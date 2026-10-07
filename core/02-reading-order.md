# Reading order

Everything below lives in the monorepo at `docs/guidance/engineering/`, except where noted.

**You do not have to read them end to end.** Every governed document at Gambit opens with an
executive summary and a numbered **"How we act and think from today"** — the operative bottom
lines, imperative, no rationale. Read those two sections of each and you have what you need to act;
dig into the detail sections when a specific question comes up.

That is a rule, not a convention: a document ordered any other way is considered badly written
here. See the doc structure standard in `gambit-ai-config/docs/doc-structure.md`.

---

## Day one — about 40 minutes

| Order | Document | Why | Read |
|---|---|---|---|
| 1 | [`core/01-how-we-work.md`](./01-how-we-work.md) | This repo. The whole loop in one read | All of it |
| 2 | `gambit-thesis.md` | What the company is betting on | All of it |
| 3 | `cto-manifest.md` §1 | Why we ship thin things fast, and the one exception | §1 only |
| 4 | `hapi-manifest.md` | The planning contract — the rules behind the Human Plan / AI Plan split | Summary + "How we act" |

## First week

| Document | Why |
|---|---|
| `human-ai-workflow-vision.md` | The stages in full, the archetypes, worked examples of each |
| `engineering-manifest.md` | The short daily checklist |
| `cto-product-manifest.md` §3–§4 | Typed TBDs, and the audience/approval tags every document carries |
| `cto-manifest.md` §3–§4 | Roles and accountability; autonomous loops (Done · Delegate · Escalate); the process OS |
| `docs/adr/README.md` | How decisions get recorded, and why accepted ADRs are never edited |

## When you hit it

| Document | When |
|---|---|
| `engineering-manifest-agents.md` | You are writing instructions *for* an agent rather than for a person |
| `gambit-ai-config` skills | Before running a stage — each stage names its skills |
| `claude-features-cheatsheet-new-engineers.md` | You want more out of the tooling |
| `docs/adr/` | You are about to make a decision someone already made |

---

## Two conventions that will confuse you if nobody says them out loud

**Every section carries two tags.** One for authorship → audience (`🤖→🧑` means an agent wrote it
for a human to read), one for state (`⬜ draft`, `✅ verified: <name>`, `🔒 approved: <name>`).

They exist because most of our documents are written by agents, and **nobody should be asked to
read unverified agent output.** `✅ verified` means a responsible human read it and vouches it is
correct — it says nothing about whether they agree with it. `🔒 approved` is agreement.

The practical rule: **if you ask someone to review something, you verified it first.** Verification
is the price of asking for someone's attention.

**A gap is never a bare blank.** Write a typed TBD with an owner — `#TBD-HL` (fine to leave open at
high level), `#TBD-BUILD` (must be resolved before this section is built), `#TBD-DECISION` (needs a
human call). A gap you named is one people can see. A gap you guessed at is one they find after it
ships.
