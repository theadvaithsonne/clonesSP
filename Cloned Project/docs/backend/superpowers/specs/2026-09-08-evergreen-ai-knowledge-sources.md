# Evergreen webinar AI — knowledge-source map and endpoint plan

**Status:** research complete / decisions open
**Date:** 2026-09-08
**Relates to:** [`2026-09-08-evergreen-ai-qa-requirements.md`](./2026-09-08-evergreen-ai-qa-requirements.md),
[`2026-09-07-evergreen-webinars-design.md`](./2026-09-07-evergreen-webinars-design.md)
**Method:** source read across `garagenew-backend`, `contacts-backend`,
`NetworkchainOpenclaw` (= NetworkChainApi), `OpenClawApi`,
`garage-web-app-nextjs-v1`. Nothing was executed against prod — every
"exists" below means *the code exists on the stated branch*, not that it is
switched on in production. §7 lists what still needs runtime confirmation.

---

## 1. Two corrections to the requirements spec

The requirements doc concluded that there is **no retrieval infrastructure**
and **no EarnGPT integration**. Both are true *inside `garagenew-backend`* and
both are false *across the platform*. This changes the phasing materially, so
it is stated first.

| Requirements doc said | Actually |
|---|---|
| "Vector store / embeddings / RAG — **does not exist**" | Three separate production Qdrant corpora exist. The whole Garage catalog (8 item types, incl. offices and workshops) is embedded and semantically searchable by `orgId`. See §3.1. |
| "EarnGPT integration — **declared but unused**" | `EARN_GPT_API_KEY` in garagenew is indeed dead. But EarnGPT is **not an external product** — it is ours, it lives in `contacts-backend`, and its retrieval layer is the catalog index above. There is no third-party API contract to chase. §9.1 of the requirements doc is **not blocking**; it was the wrong question. |

A third finding that reframes the build: **an office-scoped, public,
unauthenticated, rate-limited, guardrailed Q&A chat endpoint already ships on
`garagenew-backend` main** — `POST /openclaw-qa/:agentId/chat`. It is roughly
70% of "the AI answerer" (phase 2 in the requirements doc) already built and
already hardened. See §4.

---

## 2. Where each service actually lives

Names are misleading; pin them before reading the rest.

| Service | Repo | Role here |
|---|---|---|
| Garage backend | `server/garagenew-backend` | Owns the evergreen webinar (`Workshop`), the office (`Organization`), and the whole sellable catalog. Serves `/internal/catalog/*`. |
| NetworkChains backend | `server/contacts-backend` | Owns EarnGPT, the CRM/enrichment graph, NC's own webinars/money-streams. |
| **NetworkChainApi** | `server/NetworkchainOpenclaw` | FastAPI. Owns the **catalog vector index** (`/api/catalog/search`, `/api/catalog/browse`). |
| **OpenClawApi** | `server/OpenClawApi` | FastAPI. Owns **office AI agents**, the **manual-context knowledge base**, and the **public Q&A chat** (`/api/public/qa/*`). |

⚠️ NetworkChainApi and OpenClawApi are **two divergent forks of one codebase,
deployed separately**. NetworkChainApi has the catalog and no Q&A;
OpenClawApi has the Q&A and no catalog. The env comment in
`garagenew-backend/src/config/env.ts:256` ("they're the same service") is
misleading and should not be relied on. Anything that needs *both* office
knowledge and catalog knowledge has to reach two hosts today.

---

## 3. The source map

Every store that could feed an answer, what it holds, and whether it is safe to
expose to an anonymous webinar attendee.

### 3.1 Garage catalog vector index — **the primary source**

- **Where:** Qdrant, owned by NetworkChainApi.
  Search: `POST /api/catalog/search` (`agent_manager/routers/catalog_router.py:271`).
  Browse: `POST /api/catalog/browse`.
- **Ingested from:** `garagenew-backend` `GET /internal/catalog/items` +
  `/items/:type/:id` (`src/routes/internal-catalog.ts`), pushed live by a
  webhook outbox (`src/services/catalogOutbox.dispatcher.ts`) and reconciled
  by a Celery job.
- **Covers 8 item types:** `office`, `product`, `storeproduct`, `course`,
  `workshop`, `channel`, `service`, `call`.
- **What is embedded per item** (`agent_manager/services/catalog_embed_text.py`):
  - *office*: name, description, heading/subheading, city/state/country, category, size, store name + description.
  - *workshop* — **this is what a webinar is**: title, description/`aboutText`, date/time/timezone, **`learningPoints`**, **`agenda`** (title, duration, topics), **`bonuses`**, **`whatsIncluded`**, recurrence, price/free.
  - *product*: name, description, category, price + discounted price, `whatsIncluded`, `keyFeatures`, `whatsInside`, **`faqs`**, tags.
  - *course*: title, description, `whatYouWillLearn`, `requirements`, `courseIncludes`, section titles, price/subscription period.
  - *channel / service / call*: title, description, benefits, `whatsIncluded`, faqs, pricing.
- **Filterable by `orgId`** (`CatalogSearchFilters.orgId`) — which is exactly
  "the creator's office", since `Workshop.orgId` identifies the office that
  owns the webinar.
- **Prices are structured, not prose**: `priceCents`, `currency`, and a
  normalized `money` object. This is what makes FR-8 ("must not invent
  prices") enforceable rather than aspirational — quote the field, don't let
  the model read a number out of a paragraph.
- **Safety:** all of it is already public storefront content. **Safe to expose.**

### 3.2 Office knowledge base (manual contexts) — **the creator's own words**

- **Where:** OpenClawApi. `GlobalContext` rows in Postgres, chunked + embedded
  into Qdrant (`agent_manager/services/manual_context_service.py`), assigned
  to agents. PDF ingestion exists (`pdf_extraction_service.py`).
- **CRUD already proxied on Garage:** `/openclaw-contexts` (`src/routes/openclawContexts.ts`).
- **Retrieval is hybrid**: an auto-injected top-k block on every turn (bounded
  by `AUTO_INJECT_MAX_CHARS` and gated by `AUTO_INJECT_MIN_SCORE`, so
  off-topic turns cost nothing), plus an explicit `context_search` tool when
  the model wants more.
- **Safety:** founder explicitly assigns each context to the agent. **Safe by construction** — nothing is reachable that the founder did not put there.

### 3.3 Office Q&A agent (persona + model)

- **Where:** `garagenew-backend/src/models/openclawAgent.model.ts`, mirrored to
  OpenClawApi's `agent_registry`.
- **Holds:** `agentType: "qa"`, `qaPersonaInstructions`, `qaWelcomeMessage`,
  `qaPageTitle`, `qaPageSubtitle`, `llmModel` (locked at create), `orgId`.
- This is the concrete implementation of FR-14. The requirements doc pointed
  at `contacts-backend`'s `openclawAgent` as *prior art to mirror* — it is not
  prior art, it is **the same registry**, and it is per-office already.

### 3.4 Commercial terms — comp plan, commissions, coupons

- `POST /internal/catalog/comb-plan-l1` — level-1 commission % per catalog item.
- `GET /internal/catalog/coupons` — active coupons/offers + the items they discount.
- `OFFICE_COMMISSION_STRUCTURE` (`src/models/officePlan.model.ts`), plus
  `combPlan.model.ts`, and the unilevel/rank-bonus calculators in
  `contacts-backend/src/services/`.
- **Relevance:** high. On a Garage/NetworkChains webinar the recurring
  attendee questions are "what does it cost", "how do I earn", "what's the
  commission". This is the "platform/earnings/network" bucket FR-6 assigned to
  EarnGPT.
- **Safety: mixed, and this is the sharp edge.** Catalog pricing and public
  coupons are safe. Commission percentages, comp-plan mechanics and anything
  resembling an earnings projection are **SR-3 territory**. Recommendation:
  expose *pricing* to the answerer and keep *earnings mechanics* behind a
  curated, human-written context document (§3.2) rather than a live query.

### 3.5 EarnGPT's own stores — **private, do not expose**

Listed for completeness so the boundary is explicit. Every one of these is
keyed by `userId` and holds a salesperson's private book of business:

| Store | Holds |
|---|---|
| `EarnGPTConversation` + Qdrant `earngpt_messages` | Per-user chat history, semantically recalled |
| `EarnGPTDocument` + Qdrant `earngpt_documents` | Per-**contact** RAG corpus — proposals, decks, contracts, call transcripts |
| `ObjectionRebuttal` | Per-user objection playbook |
| `EarnGPTPitchSample`, `EarnGPTStyleRule` | Per-user writing style and sent pitches |
| `Opportunity`, `Deal`, `Pitch` | Pipeline, commission potential, outcomes |
| `Contact`, `ContactSignal`, `Axon`, `Synapse` | The CRM/enrichment graph — scraped FB/IG/LinkedIn/WhatsApp profiles |
| `WhatsappMessage`, note-taker transcripts, voice memos (Qdrant `voice_memos`) | Private conversation and meeting content |

**None of this may reach a public webinar room.** A single leaked chunk is
someone else's private contact data. When the requirements doc says "the
answer may draw on EarnGPT", the only part of EarnGPT that qualifies is its
**retrieval layer** (§3.1), never its **corpus**.

The one arguable exception is the *creator's own* `ObjectionRebuttal` rows —
genuinely useful for "isn't this too expensive?". Treat that as an opt-in
copy-into-context step the creator performs, not a live join.

### 3.6 Chat transcripts

`WebinarMessage` (both backends) persists live-room chat. Past sessions of the
same evergreen webinar are the highest-quality source of "what do attendees
actually ask" — the input to FR-16's correction loop and open question #6's
curated answer bank. Not needed for v1; worth capturing from day one.

---

## 4. What already exists that we would otherwise build

`POST /openclaw-qa/:agentId/chat` — `garagenew-backend/src/routes/openclawQa.ts`,
mounted at `app.ts:566`, on **main**, unauthenticated, streams SSE from
OpenClawApi's `/api/public/qa/:agent_id/chat`.

Behind it, `agent_manager/services/qa_chat_service.py` already implements, and
independently arrived at, most of the requirements doc's §5–§7:

| Requirement | Already implemented |
|---|---|
| SR-1 prompt-injection hardening | Guardian system prompt (refuse actions / jailbreaks / secret-leaks) prepended ahead of the agent's own identity |
| SR-2 no binding commitments | `tools=[]` except `context_search`. The model has **no tool budget** for email/post/schedule — injection cannot escape to an action it cannot name |
| FR-5 office knowledge | Auto-inject + `context_search` over the founder's assigned contexts |
| FR-14 persona | `qa_persona_instructions` |
| NFR-2 cost | `QA_MAX_TOKENS = 1024`, `QA_MAX_TOOL_ROUNDS = 3` |
| NFR-3 rate limits | `qa_rate_limit` — per-IP (hashed), per-session, per-agent-day |
| NFR-6 key sourcing | Owner-billed: gateway `user` = owner id; owner subscription + wallet gates; `deduct_session_cost` |
| Privacy | `context_injection_service` deliberately **not imported** — founder's Gmail/Drive/Slack is physically unreachable from this path |

Also already built: **Anurag's own AI co-host** for live Garage webinars —
`src/services/aiCohost.ts` + `src/routes/aiCohostRoutes.ts` on
**`origin/uat`** (`9a5d8e42`, `0403a55f`, `2652eb8d`, Aug 2026), and the NC
mirror on `contacts-backend` master (`src/services/aiCohost.ts`,
`src/routes/moneystream-ai-cohost.ts`). Shape: Garage POSTs
`/webhook/start-stream` with `{workshopId, systemPrompt, productDetails,
sendEndpoint, llmApiKey}`; an external microservice tails `webinarmessages`
via its own Mongo connection and POSTs replies back to
`/webinar/ai-cohost/send-message`, guarded by `AI_COHOST_INBOUND_SECRET`,
rate-limited 1/sec/workshop, re-broadcast on the normal `webinar:newMessage`
socket event.

**So the chat-loop half of this feature is solved and in Anurag's hands.** Its
knowledge, however, is only a `systemPrompt` string plus a `productDetails`
blob — no retrieval at all. That gap is precisely what the endpoints in §6
close.

---

## 5. What the evergreen webinar actually needs

Mapping the requirements doc's knowledge FRs onto the map above:

| Need | Source | Status |
|---|---|---|
| This webinar: title, description, `learningPoints`, `agenda`, `faqs`, price, schedule | `Workshop` doc; already embedded as catalog type `workshop` (§3.1) | **exists** |
| The creator's office: identity, what it sells, prices | catalog `filters.orgId` (§3.1) | **exists, not wired to the Q&A path** |
| The creator's own words: policies, positioning, FAQs | manual contexts (§3.2) | **exists, needs seeding** |
| Persona, tone, boundaries | `qaPersonaInstructions` (§3.3) | **exists** |
| Platform/earnings/network questions | comp plan + coupons (§3.4) | **exists as data; unsafe to expose raw** |
| Real attendee questions to answer | — | **does not exist** — evergreen rooms have no real chat |

### The four real gaps

1. **No real chat in evergreen rooms.** `EvergreenRoom.tsx:263` filters
   `simulatedChat` by playback position and never opens a socket. Unchanged
   since the requirements doc. Still the largest single piece of work, and
   still a scope decision (open question #3), not an implementation detail.
2. **The Q&A path cannot see the catalog.** `qa_chat_service` allows exactly
   one tool, `context_search`, over manual contexts. It cannot answer "how
   much is the course you just mentioned" because prices live in a Qdrant
   collection on a *different service*. This is the single highest-value fix
   and it is small: one more whitelisted tool.
3. **Nothing links a `Workshop` to an `agentId`.** No field, no fallback, no
   resolution rule for an office that has no Q&A agent.
4. **The public Q&A endpoint is SSE-only.** A chat-bot caller wants one JSON
   answer, not a token stream. Needs a non-streaming sibling.

---

## 6. Proposed endpoints (the deliverable for Anurag)

Two endpoints. Both are additive; neither touches the live-webinar path.

### 6.1 `POST /openclaw-qa/:agentId/answer` — non-streaming Q&A

`garagenew-backend`, sibling to the existing `/chat`, same upstream, same
guards, `Accept: application/json` instead of SSE.

```jsonc
// request
{ "message": "how much is the accelerator?", "session_id": "<uuid>", "history": [] }
// response
{ "answer": "…", "confident": true, "sources": [{"type":"workshop","id":"…","name":"…"}] }
```

`confident: false` is what FR-11 hangs on — it lets the caller stay silent or
hand off to a human instead of posting a guess. **`sources` is not decoration:**
it is the only mechanical check that a price or date came from a document
rather than the model, which is how FR-8 stops being a prompt instruction and
becomes testable.

### 6.2 `catalog_search` as a second whitelisted Q&A tool

In `OpenClawApi/agent_manager/services/qa_chat_service.py`, alongside
`context_search`: a read-only call to NetworkChainApi
`POST /api/catalog/search` with **`orgId` hardcoded server-side from the
agent's own org** — exactly as `context_search` already hardcodes `agent_id`,
and for the same reason. A visitor must not be able to steer the tool at
another office's catalog.

This is the change that makes the feature actually useful, because it is what
lets the AI answer with a real price.

Requires: OpenClawApi → NetworkChainApi service credentials (they are separate
deployments — see §2). That is the one piece of new infrastructure.

### 6.3 Supporting work

- **`Workshop.qaAgentId`** (optional). Absent → resolve the office's first
  `agentType:"qa"` agent; still absent → feature off. Additive, defaults to
  today's behaviour, consistent with the evergreen design's rule 2.
- **Seed a context per evergreen webinar** from its own `learningPoints`,
  `agenda`, `faqs` and `whatsIncluded`. Cheap, and it makes the webinar's own
  content the highest-precedence source, which is FR-7's ordering.
- **Precedence in the prompt** (FR-7): webinar's own doc → office contexts →
  office catalog → platform. Explicit, not left to the model.

### 6.4 Recommended phasing (replaces the requirements doc's §8)

| Phase | Delivers |
|---|---|
| 0 | Decide attribution (FR-12) + whether real chat is in scope. Unchanged — both still gate everything. |
| 1 | §6.2 `catalog_search` tool + §6.1 `/answer`. **No dependency on evergreen at all** — it immediately improves every existing office Q&A page. Ship and validate here. |
| 2 | Real attendee chat in evergreen rooms (the big one). |
| 3 | Wire the co-host loop to `/answer`; classifier for what deserves a reply (FR-3), `simulatedChat` exclusion (FR-4), review mode (FR-17). |
| 4 | Transcript, correction loop, curated answer bank. |

Phase 1 is deliberately first: it is small, ships value with zero evergreen
work, and de-risks answer quality before anything is posted into a live room.
The requirements doc's phase 3 ("EarnGPT as a second source", *blocked*) is
**deleted** — EarnGPT's retrieval layer *is* phase 1.

---

## 7. Still open

**Needs runtime confirmation (code read only, nothing executed):**
1. Is the catalog Qdrant index populated and current in prod? Check
   `GET /internal/catalog/count` against Qdrant's collection count.
2. Do any real offices have `agentType:"qa"` agents with contexts assigned, or
   is §3.2 empty in practice? Determines whether "seed the knowledge base" is a
   footnote or the actual project.
3. Is the AI co-host microservice deployed, and where does its source live? It
   is referenced by both backends but is not in this workspace. `AI_COHOST_URL`
   unset = silent no-op, so it may never have run.
4. Is `origin/uat` merging to main? The webinar co-host integration is only on
   uat; the money-stream mirror is on contacts-backend master.

**Product decisions (unchanged from the requirements doc, still blocking):**
5. **Attribution** (FR-12) — who does the answer appear to come from? Still the
   decision that shapes everything downstream.
6. **Is real attendee chat in scope**, or does the AI answer from a separate
   "ask a question" box? The second is dramatically cheaper and skips phase 2.
7. **Guests or registered attendees only?** Guests mean anonymous LLM input on
   a public URL — though note §4 already handles that case for Q&A pages today.
8. **How far into §3.4 do we go?** Pricing is safe; comp-plan mechanics and
   anything earnings-shaped is SR-3 risk on a financial-product surface.
