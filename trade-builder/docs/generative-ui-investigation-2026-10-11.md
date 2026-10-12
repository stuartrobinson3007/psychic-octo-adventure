# Compositional generative UI for Gambit

Investigated and revised 11 October 2026. This proposal covers AI composition from reusable building blocks throughout Gambit's chat. The three catalogue-research previews are examples, not the boundary of the feature. No application behavior has been changed and no framework has been installed or benchmarked.

## Recommendation and correction

Give the AI a vocabulary of layout, information, visualization, and interaction components. Let it generate the composition: select blocks, arrange them, choose emphasis and disclosure, bind them to evidence, and connect permitted actions. Gambit renders that specification with its own React components.

The earlier recommendation to begin with three complete domain widgets missed the requested capability. Composition should be the foundation of the first implementation. Player summaries, payroll views, and comparisons should be outcomes the model can construct, rather than the only three response types it can select.

The useful freedom is substantial: a response can be an aligned comparison, a contract timeline with editable assumptions, a filtered result list with selection controls, a payroll explanation with threshold markers, or a mixture of those elements. It can respond to a compound request we have never explicitly templated.

Keep the current chat and domain tools. Evaluate a small compositional renderer inside the existing message surface. My provisional preference is **json-render as the baseline, with OpenUI as a serious alternative**. This is an architectural assessment; an equivalent-catalogue spike should decide between them.

## What we design, and what the AI designs

| Decision | Owner |
| --- | --- |
| Relevant evidence and tools to retrieve it | AI using Gambit's existing tools |
| Facts, identity, units, calculations, proposal scope, validation results | Gambit's domain services |
| Which blocks answer this request; their order, grouping, hierarchy, field selection and interactions | AI |
| Typography, spacing vocabulary, responsive behavior, keyboard behavior and component internals | Gambit's design system |
| Permitted actions and their effects | Typed application handlers; AI chooses compatible bindings |
| Whether the composition is useful and clear | Evaluation against user tasks, including rendered review |

A model can therefore choose a two-column grouping, a shared comparison table, an inline metric, a disclosure, or a form. Responsive rules inside those components adapt the chosen arrangement to the actual chat width. App-owned responsive behavior does not mean that the app chooses every layout.

Design the vocabulary and composition rules. Use example compositions to teach and evaluate the model; do not make examples an exhaustive menu of permitted screens.

## The recent OpenAI release

The likely reference is **Intelligent UI**, announced on **7 October 2026**. OpenAI describes a native streamable component library and a compiler, with the model deciding how text, visuals and interactions fit together. It also describes training and evaluating clarity, usefulness and completeness. This closely matches the requested architectural direction. The announcement concerns ChatGPT's Chat experience; I did not find a documented public API exposing that renderer or component library. Selecting an API model alone should not be assumed to reproduce the ChatGPT feature. [OpenAI announcement](https://openai.com/index/gpt-6-for-everyone/).

The transferable lesson is to treat component vocabulary, compilation and design judgment as separate parts of the system. Schema compliance addresses a different problem from choosing a helpful interface.

ChatKit also has structured widgets and a visual builder, but adopting its chat host is a separate integration decision. It does not supply Gambit's composition policy automatically. [ChatKit widgets](https://developers.openai.com/api/docs/guides/chatkit-widgets).

## Which implementations support the requested composition?

| Option | Relevant capability | Fit and question to investigate |
| --- | --- | --- |
| **json-render** | Model-generated specs using a component/action catalogue, native React registry, bindings and JSONL patch streaming. [Catalogue](https://json-render.dev/docs/catalog), [streaming](https://json-render.dev/docs/streaming) | Strong baseline for retaining Gambit's runtime. Can we impose evidence references and action constraints without losing convenient bindings? |
| **OpenUI** | Models compose a custom component library using a compact declarative language; supports progressive rendering. [Introduction](https://www.openui.com/docs) | Serious alternative. Test token cost, parser diagnostics, composition quality, version stability and evidence adapters with the same Gambit blocks. |
| **assistant-ui generative UI** | A single `present` tool accepts a component tree; ships a vocabulary of 29 components and supports custom components. This is distinct from its fixed tool renderers. [Generative UI](https://www.assistant-ui.com/docs/tools/generative-ui) | A real compositional contender. Its documented frontend-tool continuation differs from Gambit's server-owned terminal turn; inspect the direct renderer/backend-emitted path before choosing the wider runtime. |
| **A2UI** | Declarative surfaces with component catalogues; custom catalogues allow domain extensions. [Catalogues](https://a2ui.org/concepts/catalogs/) | Strong when multiple clients or independently supplied agent interfaces matter. Compare protocol and renderer costs if that becomes a requirement. |
| **Tambo / CopilotKit** | Registered React components and agent interaction infrastructure. [Tambo](https://docs.tambo.co/concepts/generative-interfaces), [CopilotKit component path](https://docs.copilotkit.ai/generative-ui/your-components/display-only) | Inspect their compositional paths and runtime ownership. The documented whole-component selection pattern alone does not establish the granularity we want. |

AI SDK supplies model calls, tools and message streaming. It does not itself decide the component vocabulary or composition grammar. AG-UI concerns agent/frontend event and state exchange; it is a different layer from the language describing UI. [AI SDK generative UI](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces), [AG-UI](https://docs.ag-ui.com/introduction).

OpenUI additionally documents generated query/mutation bindings that can execute without another model call, and incremental editing of existing compositions. Those are useful capabilities, but Gambit must expose scoped handlers that preserve its transaction and history semantics. Directly exposing every existing domain tool to a renderer would be an unsuitable default. [OpenUI architecture](https://www.openui.com/docs/openui-lang/architecture), [incremental editing](https://www.openui.com/docs/openui-lang/incremental-editing).

OpenUI's hosted Gateway and Autofix are optional service choices separate from the renderer. Its repair API corrects invalid language against the component library. That does not establish correct basketball facts or action scope, and provider failover would need to respect Gambit's explicit-provider-failure policy. [Autofix](https://www.openui.com/docs/autofix).

## The right Lego granularity

Begin with a deliberately small, expressive vocabulary, approximately 25–35 components as a working hypothesis. The count is a design starting point, not a framework requirement.

| Family | Candidate blocks | AI choices |
| --- | --- | --- |
| Structure | Stack, Row, Grid, Section, Divider, Disclosure, Tabs | Ordering, grouping, density, emphasis, what deserves expansion |
| Information | Text, Heading, EntityReference, Fact, Delta, EvidenceNote, Status | Which facts matter, how to label context, where interpretation belongs |
| Collections | Table, Column, List, Repeater | Fields, grouping, comparison orientation, which entities to display |
| Visual relationships | BarChart, ThresholdScale, Timeline, TransferDiagram | Useful encoding of amounts, seasons or asset routes |
| Interaction | Form, NumberInput, Select, CheckboxGroup, Button, Pagination | Inputs, defaults from known context, allowable actions and selection limits |

This is an illustrative vocabulary. We should collapse redundant components and add blocks only when actual tasks expose an expressive gap.

A `Fact` is reusable for salary, age, payroll, savings and contract length. A `Delta` serves price comparisons, before/after payroll and changes between proposals. A `ThresholdScale` works for baseline payroll, hypothetical payroll and signing headroom. A `Table` chooses fields from resolved records rather than having a hard-coded player profile.

Tables should support reusable column/cell renderers for entities, money, statuses and selections. The AI should not have to generate every cell independently for a large result set. A repeater or column binding expresses repeated structure once.

Some specialized primitives are worthwhile. A pick reference must preserve original team, current owner and protections. A transfer diagram understands directed asset movement. A contract timeline understands seasons and estimated amounts. Their domain awareness gives reliable reusable building blocks while leaving the enclosing response open to composition.

Avoid multiplying slightly different components for styling. Use a limited enum for emphasis, density and layout intent. Give the model room to combine blocks, while component code consistently applies Gambit's tokens.

## Compositions across Gambit's existing capabilities

I reviewed the current UX capability inventory, which covers 21 capability groups, alongside the three supplied previews. The following are possible compositions, not mandatory templates.

| User job already represented in Gambit | Possible composition |
| --- | --- |
| Player facts or contract research | Entity reference + requested facts + optional contract timeline + evidence note |
| Compare players | Shared table + selected deltas + interpretation + missing-evidence note |
| Team payroll | Leading fact + threshold scale + exact threshold table + roster disclosure |
| Financial discovery and pagination | Editable constraints + result table + selection controls + pagination + checked/unreviewed status |
| Repair a failed trade while retaining specified assets | Pinned asset references + failure statuses + alternative rows + change deltas + choose action |
| Contract, stretch or waive scenario | Assumption form + baseline/hypothetical grouping + annual timeline + payroll delta + restriction status + undo |
| Free-agent signing or funding-route choice | Entity reference + eligible route selector + salary/years inputs + limitations + check action |
| Multi-team routing | Directed transfers + grouped incoming/outgoing lists + salary facts + validation statuses |
| Pick or draft-rights selection | Bound list/table + owner/origin/protection fields + selection + availability reasons |
| Historical versions and linked proposals | Reference breadcrumbs + changed-asset rows + exact version comparison + restore/recheck action |
| Identity clarification | Candidate entity list + appropriate single/multiple selection + supporting question |
| Mixed trade and separate signing | Separate scoped sections + shared explanatory text + independently bound result statuses |

The most revealing cases combine several jobs. For example:

> Find cheaper replacements for White, compare their age and contract length, show Boston's distance from the first apron, and let me choose which ideas to check.

The model could compose a filter form, comparison table, payroll threshold block and a selection/check action from the existing vocabulary. It must preserve the difference between an idea and a checked proposal. Selecting ideas alone should not invoke validation; the current product explicitly checks selected ideas on request.

Another example:

> Show the second saved trade next to my new version, highlight what changed, and keep the contract assumptions expandable.

This reuses grouping, table/delta, evidence references and disclosure blocks. It tests novel composition and exact historical references together.

## How the original three turns could be generated

### Derrick White research

One generated composition might be:

```text
Stack
  EntityReference → resolved Derrick White
  Grid
    Fact → age
    Fact → position
    Fact → current-season salary
    Fact → remaining seasons
  Disclosure "Year-by-year contract"
    Timeline → available contract-year records
```

If the user asks only his age, the model can use one inline fact or plain text. If they ask about future salary, it can emphasize the timeline and place the current salary alongside it. These require no new whole-response component.

The recorded fixture supplies age 32, SG, salary $30,348,000 for 2026–27 and three remaining seasons through 2028–29. Future amounts must come from the supplied schedule; reported options do not prove guaranteed years.

### Boston payroll

A useful composition is a payroll fact, threshold scale, aligned distance rows and an explanatory sentence. Alternatively, a concise request may warrant only the two relevant threshold rows.

The fixture payroll is $206,681,832: $41,720,832 above the cap, $6,253,832 above the tax line, $2,333,168 below the first apron and $15,004,168 below the second apron. Bind all amounts and derive distances from the same season and payroll scope. Those distances are descriptive evidence; operation-specific eligibility comes from the validator.

### White versus Wiggins

An aligned table, salary delta and evidence note would answer this request. If the user asks about contract duration instead, the model could emphasize parallel timelines with fewer table columns.

The fixture salaries differ by $178,356, with Wiggins cheaper. Age and remaining seasons are both 32 and three, respectively. Contract facts alone do not establish better basketball value; performance and availability evidence are absent. A generated winner badge would therefore be unsupported.

These are values from Gambit's recorded catalogue, whose internal metadata marks its basketball-GM source and synthetic status. They are design fixtures, not independently verified current NBA facts. Preserve provenance internally and use the product's established language for estimates and unavailable information.

## Design workflow: design a language and test its expressive range

1. **Collect representative tasks.** Use research, discovery, repair, payroll scenarios, signing, multi-team routing and historical comparison. Include short follow-ups, mixed requests and unavailable evidence.
2. **Map information relationships.** Identify identity, quantity, difference, threshold, sequence, grouping, uncertainty and choice. These suggest reusable blocks.
3. **Prototype several compositions with the same blocks.** Review alternatives for the same question. If every alternative needs a new domain card, the vocabulary is too coarse. If the model must specify dozens of typography and spacing decisions, it is too low-level.
4. **Write a contract for each block.** Include purpose, typed props/bindings, children, compatible actions, required data, missing states, responsive behavior and accessible semantics.
5. **Define composition rules.** Examples: shared rows for comparisons; no essential qualification hidden in a disclosure; one primary action per local decision; no form inside a form; statuses distinguish unavailable, incomplete and failed.
6. **Generate varied responses and review the rendered output.** Fix vocabulary or component behavior when failures recur. Add prompt guidance for contextual decisions. A polished hand-authored example is not evidence that the model can compose it.
7. **Keep unfamiliar combinations in evaluation.** Hold out compound requests to test whether the system recombines components rather than reproduces examples.

Gambit's current design provides the foundation: Inter, zinc/emerald tokens, Base UI controls, tabular numbers and restrained dividers. Test the actual message-container width, including chat beside the research pane and mobile. The model can choose horizontal grouping; the component owns when that grouping must stack.

Model-facing component descriptions should explain usage and counterexamples. For example: “ThresholdScale compares a measured amount with named boundaries. Use when distance to a boundary matters. It is not a transaction-validity verdict.” Generate prop documentation from the component catalogue so it stays synchronized with the renderer. Both json-render and OpenUI document catalogue-generated prompt guidance. [json-render catalogue](https://json-render.dev/docs/catalog), [OpenUI component definitions](https://www.openui.com/docs/openui-lang/defining-components).

## Data binding: preserve freedom without asking the AI to transcribe facts

Separate three kinds of state:

- **Immutable evidence:** resolved entities, salaries, seasons, thresholds, proposal snapshots, search batches and validation results.
- **Local view state:** expanded sections, selected rows, sort direction and unsent form inputs.
- **Domain changes:** new searches, proposal edits, signings and validation results, committed through Gambit's server.

The model should bind important factual props to evidence references. It can choose which fields and entities to display. The server resolves their values, labels, units and estimate status.

For illustration, a framework-neutral node could be:

```json
{
  "id": "salary",
  "type": "Fact",
  "props": {
    "valueRef": "evidence:players-v1/players/16992/salary",
    "emphasis": "primary"
  }
}
```

The reference format is proposed, not an existing API. The server-owned field descriptor would supply “Salary, 2026–27,” the amount, currency and provenance. A comparison table can similarly refer to an entity collection and typed field definitions. This leaves the model free to arrange facts without emitting another copy of every number.

json-render supports state paths, repeat-item bindings, two-way form bindings and registered computed functions. We still need a Gambit adapter that makes evidence read-only and restricts writable paths to local inputs. Its built-in form validation is a convenience for input checks, not a replacement for server domain checks. [Data binding](https://json-render.dev/docs/data-binding), [computed values](https://json-render.dev/docs/computed-values), [validation](https://json-render.dev/docs/validation).

Calculate dollar differences, percentages and threshold distances with registered deterministic functions. Supply domain validation verdicts from existing services. Bind success/failure styling to those results so the model cannot convert “Needs review” into an approved status.

Free prose still needs evaluation: protecting numeric component props does not prevent an unsupported claim in an explanatory sentence. Important computed conclusions and validation summaries should use structured, evidence-backed blocks where practical.

## Getting the AI to compose correctly

Treat correctness as several separate questions:

| Layer | Enforce or evaluate |
| --- | --- |
| Expression validity | Allowed component names, valid props, compatible children, graph references and size limits |
| Evidence validity | Existing references, resolved identities, compatible season, unit and exact proposal/search scope |
| Interaction validity | Permitted action, matching payload, selection cardinality, server version and request identity |
| Task completeness | Required facts and requested functionality represented; limitations retained |
| Design quality | Useful hierarchy and encoding, readable density, sensible interaction, narrow-width behavior |

Use a shared schema and runtime validation. Verify actual provider-level strict output support when using a tool/schema route. Prompt-generated catalogue instructions alone do not prove constrained decoding is active. OpenAI strict function calling constrains structure, with supported-schema requirements; it does not prove the selected facts or layout answer the question. [Function calling](https://developers.openai.com/api/docs/guides/function-calling).

Reject cycles, broken references, incompatible children, excessive depth and unsupported action bindings. Report precise node-level errors so the model can repair the affected composition within a bounded budget. A syntactically repaired response still needs evidence and domain validation.

Teach composition through a small set of varied examples, including alternative valid arrangements, text-only responses and mixed tasks. Include counterexamples such as internal identity lookups that should not automatically display research.

Initially let the existing tool loop gather evidence and finish with a generated UI specification alongside prose and proposal references. A separate presentation call is another option if streaming and schema size justify it; measure its latency and cost before adding a compulsory model pass. Neither approach needs a mandatory intent classifier.

Expose capability metadata for the current evidence and actions. As the catalogue grows, retrieve relevant component families without restricting the model to a handful of preselected response templates. Evaluate whether narrowing the vocabulary hides needed components on compound requests.

## Interaction and multi-turn composition

Local sorting, expanding, selecting and editing unsent inputs should usually run immediately without an AI round trip. The model generates the wiring; app handlers execute it.

A check/search/edit action should carry originating message and UI IDs, exact proposal or search references, user-entered values, request identity and expected conversation version. The server validates the event and applies the same invariants as a typed chat request. Labels such as “Check selected ideas” must describe the actual handler effect.

Scope form limits and choices to the capability returned by the server. Salary and duration inputs cannot expand signing eligibility. Pick selections cannot invent ownership or protections. An unsupported feature remains unsupported even if a generic control can display it.

To support “add their contract years,” “sort that by savings,” or “compare the first two,” provide the model a compact manifest of the rendered composition, evidence subjects, stable node IDs and significant interaction events. The current user-visible text history alone is insufficient.

Keep stable identity across patches. A new factual result should create a new evidence/snapshot revision; historical answers retain their old facts. Local display preferences may change within a surface, but a later contract assumption must not silently rewrite the original answer.

Persist the versioned specification, its evidence references and a readable fallback. Plan for component-version migration. Never recreate old answers by joining their entity IDs against today's catalogue.

## Streaming

Composition can ship first as a completed validated specification while retaining existing tool-progress events. This still delivers genuine model-generated composition. Progressive rendering is a separate delivery refinement.

Both json-render's patch stream and OpenUI's line-oriented rendering support earlier display. Only show blocks whose factual bindings are valid; disable actions until their bindings and containing turn are accepted. Keep incomplete values as loading states, preserve input/focus during patches and avoid moving the user's target while they interact. [json-render streaming](https://json-render.dev/docs/streaming), [OpenUI introduction](https://www.openui.com/docs/openui-lang).

Validate streamed patches before applying them and restrict writable paths. Commit only the accepted final composition to history. Cancellation, failed turns and retries must preserve Gambit's transaction semantics and avoid duplicate results. Measure first useful display and final completion separately.

## Evaluation: working UI is only one part of success

Thesys publishes an open benchmark comparing OpenUI, A2UI and json-render using 46 briefs, a shared 70-component catalogue and four attempts per brief. It publishes raw outputs and SDK-based structural judgments. Its completion criteria include resolved references, reachable components and a component-count coverage floor. This is useful evidence about format generation, but it does not establish Gambit's factual correctness, task fulfillment or design quality. The author also supplies OpenUI, and the common catalogue derives from its library. Do not use its headline score as the sole selection criterion. [Benchmark and methodology](https://github.com/thesysdev/generative-ui-bench).

For Gambit, start with roughly 40–60 prompts across the capability families, including multi-turn sequences and held-out compound tasks. These are proposed evaluation sizes. Repeat generation to expose variability; keep the exact model, catalogue version, evidence and generation settings.

Measure:

- Valid composition before repair, after repair, and fallback rate.
- Required-information coverage, omission of material caveats and unnecessary UI.
- Evidence/reference accuracy, numeric agreement and exact historical scope.
- Action correctness, reload/restore fidelity and cancellation behavior.
- Readability at actual chat widths, keyboard operation and preserved input/focus.
- Human task success: can a person compare, understand a limit or choose the intended alternative?
- Time to useful UI, completion time, input/output tokens and cost.

Use deterministic assertions for facts and actions, rendered review for visual quality, and human task review for usefulness. Model graders can assist but should not be the only authority. There are several valid layouts; exact screenshot matching should not punish legitimate composition.

The decisive generalization test is whether the AI answers a new compound request using the existing blocks without needing a new full-response widget.

Proposed hard gates: no accepted cross-scope references or fabricated critical bound facts in the corpus; action handlers pass all domain invariants; reload preserves evidence; incomplete validation is never displayed as approval. Those are acceptance criteria, not guarantees about every future model response.

## Integration points in the current code

| Existing area | Required change |
| --- | --- |
| `conversation-turn.ts` / `finish_response` | Accept a compositional specification, validate evidence/actions and permit bounded correction |
| `conversation-read-tools.ts` / conversation records | Return stable evidence references and retain relevant immutable facts |
| `conversation-instructions.ts` | Replace conflicting plain-text-only guidance with composition and evidence policy |
| `trade-chat-stream.ts` on server/client | Carry accepted UI specs; optionally add scoped UI patch events |
| `trade/types.ts`, `trade-session.ts` | Version and persist generated specifications with assistant messages |
| `conversation-entries.ts` / `archiveMessages` | Preserve specifications and references through explicit reconstruction |
| `workspace/chat-panel.tsx` | Render the native component registry inside existing conversation messages |
| Existing player/research views | Extract useful factual primitives; retain domain inspector behavior |
| UX review capability/scenario harness | Exercise varied generated compositions and interactions |

The app currently uses React 19, TanStack Start/Vite, AI SDK 7, Zod 4, Base UI/shadcn and Recharts. Use installed version-matched documentation when implementing. External examples should not be copied as if they were verified against this runtime.

The current stream sends live tool activity and a final result, rather than progressive research specs. The current archive path explicitly reconstructs message fields. Existing compact execution evidence may omit information needed to replay a composition. These all require deliberate integration.

Performance statistics are unavailable in the current data and are not shown in player views. Generated comparisons must use available catalogue facts without inventing performance evidence. Existing no-fallback, exact-history and selected-ideas-only-check policies also apply to the new UI layer.

## Concrete implementation sequence

1. Design a reusable catalogue and fixture compositions across six to eight existing task families. Include multiple arrangements and missing-data cases.
2. Implement an isolated renderer comparison for json-render and OpenUI using the same blocks, facts and action contracts. Include genuine model-generated compositions immediately.
3. Add the read-only evidence adapter, semantic compiler and typed action boundary. Evaluate held-out compound prompts before selecting the renderer.
4. Integrate the selected format with terminal responses, message storage, archive/restore and the existing chat surface.
5. Run real-model, integrity, rendered-width and interaction evaluations through the current UX harness.
6. Add progressive rendering and incremental edits while preserving server commit semantics; tune vocabulary from observed failures.

The first milestone should already demonstrate the AI constructing varied, unfamiliar interfaces from shared blocks. That is the capability the implementation and evaluation must preserve.
