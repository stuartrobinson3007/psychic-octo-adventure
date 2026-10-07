# How we work

Read this first, whichever track you are on. It is the shortest complete description of how
Gambit ships.

---

## The belief

The future of product teams is not "humans vs. AI" and not "AI replaces humans." It is
**Human & Artificial Planning Intelligence** — **HAPI**. Humans own judgment and the quality bar.
AI owns the heavy lifting in between.

That is not a slogan about being nice to robots. It is a claim about where mistakes come from.
An agent given a vague goal produces something coherent, well-argued, and **adjacent to what you
wanted** — and the better it looks, the less likely you are to notice the substitution. The risk
was never bad code. It is arriving somewhere you did not choose.

Everything below is defence against that.

---

## What we optimise for right now

Four values, in the order we actually trade them off:

| | |
|---|---|
| **Value** | Does a user get something they can react to? |
| **Impact** | Did it change a decision, not just a screen? |
| **Throughput** | How fast did we learn, not how much did we build? |
| **Accountability** | One named human owns the outcome, always |

> We deliver fast so users can try things hands-on — measuring value and impact with minimum
> effort. Humans stay accountable end to end, controlling the AI and the process.

**We are in an exploration phase**, and it changes what "good engineering" means here. We
deliberately do **not** build for scale we don't have, abstractions for a second case that doesn't
exist, or extensibility nobody asked for. We ship the thinnest thing a user can react to and watch
what they do with it. A rewrite later beats a design decision now.

This is the hardest part to live, because it is exactly where good engineers are most comfortable.
Building the durable version *feels* like the responsible choice. At our stage it is the expensive
one.

**One exception, and it is absolute: correctness of what we show.** If a user sees a result in
Gambit, they can trust it — verified, even when not exhaustive. Correctness-bearing surfaces keep
their deep review at any speed. Everything else is negotiable.

---

## The flow

Ten stages describe the loop:

> **Idea → Human Thinking → Human Plan → AI Plan → AI Execute → Human Guidance → AI PR → AI Review
> → Human Review & QA → AI Deploy**

A unit of work moves through **eight** of them, because two are continuous loops rather than states
you sit in, and one — Reconcile — is the stage everybody skips and the one that makes the rest
worth doing:

| Stage | What happens | Who leads |
|---|---|---|
| **Idea** | Someone writes down what they think. Nobody has picked it up yet | Anyone |
| **Human Plan** | Humans agree what "achieved" means, with agents assisting. Ends frozen | Human |
| **AI Plan** | The agreement becomes executable: tech and design spec, files, steps, risks, tests | AI, human approves |
| **Execute** | Build it. Stay available — you are watching for *goal drift*, not only mistakes | AI, human steers |
| **Review** | Code review, plus the eval gate | AI + reviewer |
| **QA** | Exercise the running system. Break it on purpose | Human |
| **Deploy** | Shipping is a decision, not a side effect of green checks | Human gates |
| **Reconcile** | Make the doc true to what shipped. Record every deviation and why | AI, human confirms |

**"Thinking" is not a stage.** It has no approver and produces nothing separate — it *is* the
Human Plan while it is still vague. A plan can be marked `#maturity/high-level` (fast transfer of
intent) or `#maturity/full-detail` (build-ready). Same document, visible progress.

---

## One document, three stages

A unit of work has **one document for its whole life**, not three artifacts handing off to each
other. The live section is renamed as the work advances, and it always sits on top:

```
## AI Plan                    ← the live section. Always first.
   (was "Human Plan")
---
## Appendix A — Human Plan    🔒 frozen, agreed by <names>
## Appendix B — For Agents
```

**Human Plan → AI Plan → Release Doc.** Nothing below the freeze line is ever edited. If the goal
genuinely changes, you write a *new* Human Plan and say why; the old one stays.

Why one document: the history is a single file's diff. You can see, in order, what we agreed, what
we planned, and what we actually shipped — and the gap between the last two is the thing worth
looking at. Three separate documents make that gap invisible, which is precisely how a plan and a
system drift apart with nobody noticing.

### The Human Plan is the AI PRD

For anything with AI in it, the Human Plan is written as an **AI PRD**. Six sections are required:

1. **The job** — one sentence. The user's job, not the feature. If you can't state it in one
   sentence, you are not ready to plan.
2. **Inputs** — every field, its type, one real example value.
3. **Outputs** — the exact shape. If it's structured, write the structure.
4. **Capability boundary** — three things it DOES, and three it explicitly does **NOT** do, each
   with what it says when asked.
5. **Failure contract** — what the user sees and what gets logged when the model is unavailable,
   low-confidence, confidently wrong, or handed something out of scope.
6. **Done means** — one measurable statement, and the bar it must clear to ship.

Two more are always asked for, and skipping one requires writing `N/A — because…` so the skip is a
decision rather than an omission: **Actions & autonomy** (per action, not per product) and
**Guardrails & circuit breakers**.

**Section 4 is where scope leaks.** Most people write three things it does and stop. The does-NOTs
are what stop an agent inventing features, and what stop users filing bugs against imagined ones.

---

## The rule that ties it together

> **AI drafts fast; you audit. A spec is done when the agent has nothing left to guess.**

Mechanically: the agent drafts, then **mirrors back what it understood in its own words** — not by
quoting the plan, because a mirror that reads back identical proves nothing. Then it lists every
guess it would have to make. You close them.

**A plan with an open question does not get approved.** Every other gate here can be bypassed by
the person accountable for the work. This one cannot. A spec the agent still has to guess at is not
finished, by definition.

The corollary, and it is the cheapest habit to build: **a follow-up question before execution
always beats a question after it.** A clarifying question costs minutes; a wrong build costs the
loop. Asking early is not hesitancy.

---

## Who owns what

Three slots, set **per stage** — not per project:

| | |
|---|---|
| **Owner** | Exactly one, accountable for getting this stage done. May change between stages |
| **Collaborators** | Anyone who must be part of the discussion |
| **Approvers** | Zero or more, and *typed* — a design approval and a tech approval are different things |

**We trust the owner.** The approval system exists to make sure the right people saw the work, not
to stop progress. The owner can self-approve and bypass an approval; the bypass is recorded with a
reason. (The one exception is the open-question gate above.)

### Archetypes, and the bar

Job titles don't define how you work. **Archetypes** do — Prototyper, Builder, Sweeper, Grower,
Maintainer. Most people span two or three, and the mix shifts as a product matures. Right now,
in exploration, the work is mostly Prototyper and Builder.

Separately there is a standard, not a title:

> An **AI PM Engineer** can carry a capability from problem to production alone — owning the
> judgment, the goal and the quality bar, with AI doing the heavy lifting in between.

That is what we are hiring and growing towards. It is not a claim that you work alone: a senior
product lead improves the design and behaviour, and the CTO and CEO plug in at decision points.
It is a claim about who owns the outcome.

---

## When the agent should stop and ask

Write these before the loop starts, never decide them mid-flight:

- the next action is **irreversible** — pushing to main, a migration, anything touching money,
  auth, or correctness-bearing logic
- it would **exceed the stated scope** or the capability boundary
- several attempts produced **no progress**
- resolving it would require **changing the frozen Human Plan** — that goes back to the humans,
  never around them
- an ambiguity has **more than one defensible reading**. Silence is not resolution: an agent that
  quietly picks the likelier option has skipped the step, however good the pick was

Otherwise, act — and pair anything reversible with a visible undo.

---

## What "good enough to ship" means

A number, not a feeling, and set **before** you are emotionally invested.

- **A golden set** — real inputs paired with what a good answer looks like. Deliberately
  unbalanced: ~40% typical, ~20% adversarial (injection, out-of-scope, must-refuse), ~15%
  ambiguous, ~25% regression (your worst past failures, never deleted). Every row says *why it
  exists* — which feels like bureaucracy now and in four months is the only thing stopping someone
  deleting a failing row to make the build go green.
- **A judge you have checked.** An automated judge that has never been compared against human
  labels is a random number generator with good manners. Below ~85% agreement with a human, it is
  noise.
- **Cost per successful task**, not cost per call. Cost per call is an infrastructure number. Divide
  by the success rate, add retries, add human review time — that is the product number, and it is
  usually 3× or more.

And when you test: **break it three ways** — timeout, hallucination, refusal. Timeout and refusal
have fixes. Hallucination has only a design. It is also the one people find hardest to notice,
which is why it is the one users hit most.

---

## Where to go deeper

| Topic | Document |
|---|---|
| The planning contract in full | `hapi-manifest.md` |
| The ten stages, roles, worked examples | `human-ai-workflow-vision.md` |
| How R&D operates, and why | `cto-manifest.md` |
| Document maturity, TBDs, audience tags | `cto-product-manifest.md` |
| The daily checklist | `engineering-manifest.md` |

These live in the monorepo under `docs/guidance/engineering/`. Every one of them opens with an
executive summary and a numbered "How we act and think from today" — so you can read the first
screen of each and have the operative content. See [02-reading-order.md](./02-reading-order.md).
