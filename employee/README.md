# Employee track

You've joined Gambit. This is the path from day one to running a capability end to end.

> **Scope note.** This repository is public, so nothing here names a customer, an environment, a
> credential or an internal URL. Anything specific is in the internal docs and in the workspace —
> your manager will point you at them on day one. If you find something specific in this folder,
> that is a bug: say so.

---

## Before anything

Read [`core/01-how-we-work.md`](../core/01-how-we-work.md). Everything else assumes it.

Then [`core/02-reading-order.md`](../core/02-reading-order.md), and do the day-one list — about
forty minutes.

---

## Day one

**Accounts and access.** GitHub org, the issue tracker, the shared workspace, cloud access as your
role needs it. Ask for all of them at once; they arrive at different speeds.

**Get the repos.** The monorepo is where product code lives. The config repo holds the skills —
the shared, versioned procedures we run stages with. Install the skills locally before you write
anything; they carry conventions you would otherwise have to discover by being corrected in review.

**Read your first feature doc.** Ask for a recently shipped one and read it top to bottom: the live
section, then the frozen Human Plan underneath. Seeing what was agreed, and then what actually
shipped and why it differed, teaches the process faster than any description of it — including
this one.

---

## Week one

**Run one small thing all the way through.** Not a big thing. The point is to touch every stage
once — Human Plan, AI Plan, Execute, Review, QA, Deploy, Reconcile — so the parts you will later
be tempted to skip are the parts you have already done.

The two people skip first, and regret first:

- **Reconcile.** Making the document true to what shipped. Skipping it is how a plan and a system
  quietly stop matching, and then nobody trusts either.
- **The does-NOTs** in the capability boundary. Writing what something does is easy. Writing what
  it refuses to do, and what it says when asked, is the part that stops an agent inventing scope.

**Pair on a review.** Read someone else's PR alongside them. Our review is risk-tiered, not uniform
— deep human review on correctness-bearing surfaces, self-approve with agent checks elsewhere.
Seeing where the line falls in practice is worth more than reading the rule.

**Break something on purpose.** Take a feature that works and make it fail three ways: timeout,
wrong answer, refusal. Watch what the user sees each time. This is the fastest way to understand
why the failure contract is a required section rather than a nice-to-have.

---

## Working in the shared workspace

We do product and planning work in a shared co-working space built on BB. It is not a chat tool
with extra steps — the workflow is the product:

- **A session is a unit of work.** One session, one capability, one living document.
- **The session shows its stage** at the top, with the owner, the collaborators, the approvers, and
  which repositories it touches. If you want to know where something is, you look — you do not ask.
- **Plain messages are discussion. The agent does not answer them.** You dispatch it explicitly.
  This is deliberate and it is the thing that makes a shared session usable by humans at all.
- **Documents are co-edited live**, with comments on a passage. A comment marked as a required
  change blocks approval; ordinary discussion does not.
- **Approving a plan advances the stage** and is what grants an agent permission to write code —
  scoped to the paths that were approved, not everything.

Which means: during planning stages the agent can read and propose, and cannot edit your
repository. That is not a limitation to work around. It is the point.

---

## What "senior" looks like here

Not the volume of code. The preparation of the task — a clear goal, a scope with explicit
non-scope, done criteria a machine can check, and named stop points — **is** the work. Measuring
yourself by lines written misses where the leverage moved.

Two habits that separate people who go fast from people who look fast:

1. **Ask the clarifying question before execution, not after.** It costs minutes. The alternative
   costs the loop.
2. **When something feels wrong but you cannot name it, stop.** That is a signal to pause, not to
   merge and hope. This is explicitly non-delegable — no agent check replaces it.

---

## Where to ask

Anything about the process: your onboarding buddy first, then the CTO.
Anything about product behaviour or design: the product lead.
Anything you think is wrong in this document: say so in week one, while you can still see it. By
month two you will have stopped noticing, and we will have lost the only fresh read we get.
