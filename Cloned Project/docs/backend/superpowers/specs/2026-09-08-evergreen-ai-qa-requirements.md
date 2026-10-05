# Evergreen webinars — AI answers for live attendee questions

**Status:** requirements / not yet designed
**Date:** 2026-09-08
**Relates to:** [`2026-09-07-evergreen-webinars-design.md`](./2026-09-07-evergreen-webinars-design.md)

## 1. Goal

During an evergreen (pre-recorded, scheduled) webinar the creator is not present.
When a **real** attendee asks a question in chat, an AI should answer it in the
room, drawing on EarnGPT and on the creator's own office, so the session still
feels attended rather than abandoned.

## 2. The one thing that makes this bigger than it looks

**Evergreen rooms have no real chat today.** `EvergreenRoom` never opens a
socket — it renders `simulatedChat`, a list of `{atSec, name, message}` the host
scripts in advance, filtered by playback position
(`components/webinar/EvergreenRoom.tsx`). Real chat lives in the live SFU room:
the client emits `webinar:sendMessage` and the server broadcasts
`webinar:newMessage` (`src/realtime/mediasoupHandlers.ts:2093`), persisted via
`webinarMessage.model.ts`.

So this feature is **two builds**, and the first is the larger one:

1. **Real attendee chat in evergreen rooms** — socket join, auth for
   unauthenticated/guest viewers, persistence, moderation, roster.
2. **The AI answerer** on top of it.

Any estimate that treats this as "add an AI to the chat" is wrong. Decide
whether phase 1 is in scope before costing phase 2.

## 3. Current state (verified)

| Thing | Where | State |
|---|---|---|
| Evergreen playback + clock | `src/routes/publicWebinar.ts` `/evergreen-state` | shipped |
| Scripted (fake) chat | `workshop.model.ts` → `evergreen.simulatedChat` | shipped |
| Real webinar chat | `src/realtime/mediasoupHandlers.ts:2093` | live rooms only |
| Chat persistence | `src/models/webinarMessage.model.ts` | live rooms only |
| Per-office AI keys | `getOrgApiKey(providerId, organizationId)` — `src/routes/founderAiProviders.ts:235` | shipped |
| Multi-provider AI call pattern | `src/routes/betty.ts` (Gemini / OpenAI / Anthropic, org key with a default fallback) | shipped, reusable |
| Per-org Q&A persona | `openclawAgent.model.ts` → `qaPersonaInstructions`, `qaWelcomeMessage` | shipped, prior art |
| Vector store / embeddings / RAG | — | **does not exist** |
| EarnGPT integration | `EARN_GPT_API_KEY` in `src/config/env.ts:50` | **declared but unused** |

Two consequences worth stating plainly:

- There is **no retrieval infrastructure**. Context has to be assembled from
  Mongo documents into the prompt, or a vector store has to be introduced. The
  first is much cheaper and is the recommended starting point.
- There is **no EarnGPT API integration anywhere in the codebase**. `earngpt.io`
  appears only as an external link (`src/routes/apps.ts:160`,
  `lib/taskroomApps.ts:858`) and the env var is read by nothing. See §9.

## 4. Scope

**In**
- Detecting that a real attendee asked a question in an evergreen room.
- Producing an answer from EarnGPT + the creator's office context.
- Posting that answer into the room's chat, visibly attributed.
- Host controls: on/off per webinar, persona, and what the AI may talk about.

**Out (for now)**
- Answering by voice or in the video.
- Answering questions in *live* webinars (the creator is present).
- Anything that transacts — refunds, discounts, commitments, bookings.
- Replacing the scripted `simulatedChat`, which stays as-is and additive.

## 5. Functional requirements

### 5.1 Question intake
- **FR-1** An attendee in an evergreen room can post a chat message.
- **FR-2** Every message is attributed to a real identity (registered attendee,
  or a guest name captured at join) and persisted, so a transcript exists after
  the session.
- **FR-3** The system decides whether a message warrants an answer. Not every
  message is a question ("hi", "🔥", "from Mumbai"). Cheap heuristics first
  (ends in `?`, starts with an interrogative, minimum length); an LLM classifier
  only if heuristics prove insufficient.
- **FR-4** Scripted `simulatedChat` lines must never trigger the AI. They are
  not real questions and would produce an AI talking to itself.

### 5.2 Knowledge sources
- **FR-5** **Creator's office.** The answer may draw on the office the webinar
  belongs to (`workshop.orgId`): office name and description, its products,
  services, courses and other webinars, plus their prices and descriptions, and
  this webinar's own title, description, `learningPoints` and `faqs`.
- **FR-6** **EarnGPT.** The answer may draw on EarnGPT for
  platform/earnings/network questions the office itself cannot answer. The exact
  contract is unresolved — see §9.
- **FR-7** **Precedence.** Where the two disagree, the creator's own office wins
  for anything about that creator's offering. EarnGPT wins for platform-wide
  questions. This ordering must be explicit in the prompt, not left to the model.
- **FR-8** The AI must not invent prices, dates, availability or earnings
  figures. Anything numeric must come from a retrieved document or be declined.

### 5.3 Answering
- **FR-9** Answers post into the same chat stream attendees are reading, within
  a target of **≤ 10 seconds** of the question (see NFR-1).
- **FR-10** Answers are short — chat-length, not essay-length. A hard cap
  (~500 characters, matching `simulatedChat`'s existing message limit) keeps them
  readable in a chat column.
- **FR-11** When the AI cannot answer confidently it must say so and offer a
  route to a human (contact the office / leave a question for the host), rather
  than guessing.
- **FR-12** **Attribution is a required product decision, not an implementation
  detail.** The webinar is already presented as live while pre-recorded; an AI
  answering under the creator's name compounds that. Options, in descending
  order of safety: labelled assistant with its own name and avatar
  ("Garage Assistant"); labelled as AI but themed to the office; unlabelled as
  the host. Recommend the first — it is also the only one that survives an
  attendee asking "is this a bot?". Whoever owns this decision should record it
  here before build starts.

### 5.4 Host controls
- **FR-13** Per-webinar toggle, default **off**, in the existing evergreen panel
  (`components/webinar/EvergreenSettings.tsx`).
- **FR-14** Persona / tone instructions, per office — mirror
  `openclawAgent.qaPersonaInstructions` rather than inventing a second concept.
- **FR-15** Topic boundaries: an office-level list of things the AI must refuse
  (e.g. refunds, legal, medical, income guarantees).
- **FR-16** A transcript of every question and AI answer, reviewable by the host
  after the session, with the ability to correct an answer for future sessions.
- **FR-17** Optional **review mode**: AI drafts, a moderator approves before it
  posts. Needed if any office wants the feature but not the risk.

## 6. Non-functional requirements

- **NFR-1 Latency.** ≤ 10s question-to-answer at p95. Beyond that the answer
  lands after the conversation has moved on and reads as broken.
- **NFR-2 Cost.** Per-question LLM cost is bounded by capping context size and
  by rate limits. A 500-person room asking freely is the cost risk, not a single
  question.
- **NFR-3 Rate limits.** Per attendee (e.g. 3 questions / 5 min) and per session
  (a global ceiling). Exceeding it degrades gracefully — the message still posts
  to chat, it just doesn't get an AI answer.
- **NFR-4 Concurrency.** Sessions are shared by every viewer, so one answer
  serves the room. Identical/near-identical questions inside a short window
  should be answered once, not N times.
- **NFR-5 Failure is silent to attendees.** If the AI, EarnGPT, or the org's
  provider key fails, chat keeps working and no error is posted into the room.
- **NFR-6 Key sourcing.** Reuse `getOrgApiKey(providerId, orgId)` with a
  platform default fallback, exactly as `betty.ts` does. Do not add a second
  key-management path.

## 7. Safety and moderation

- **SR-1** Attendee messages are untrusted input. They must never be treated as
  instructions to the model — prompt-injection hardening is required, since
  attendees can type anything into a public room.
- **SR-2** The AI must not make commitments that bind the creator (refunds,
  discounts, guarantees, deadlines).
- **SR-3** No income or earnings promises. This is a financial product surface;
  treat any earnings claim as forbidden unless quoted verbatim from an office
  document.
- **SR-4** Abusive or off-topic messages should be ignored by the AI, not
  engaged with.
- **SR-5** Everything the AI says is retained and attributable, so a creator can
  audit what was said on their behalf.

## 8. Suggested phasing

| Phase | Delivers | Why this order |
|---|---|---|
| 0 | Decide attribution (FR-12) and whether real chat is in scope | Both change the shape of everything after |
| 1 | Real attendee chat in evergreen rooms | Prerequisite; useful on its own even with no AI |
| 2 | AI answers from **office context only**, review mode on | Office data is already in Mongo; no external dependency; smallest thing that is genuinely useful |
| 3 | EarnGPT as a second source | Blocked on §9 |
| 4 | Auto-post without review, transcript + correction loop | Only after phase 2 has shown the answers are good |

Phase 2 is deliberately the first shippable increment: it has no external
dependency, no new infrastructure, and reuses the `betty.ts` provider pattern.

## 9. Open questions — blocking

1. **EarnGPT has no API contract in this codebase.** What is the endpoint, auth
   scheme, request/response shape, rate limit and latency? Is it a chat
   completion, a retrieval API, or a hosted assistant? `EARN_GPT_API_KEY` exists
   in `env.ts` but nothing reads it, so there is no prior integration to copy.
   **Nothing in phase 3 can be estimated until this is answered.**
2. **Attribution** (FR-12) — who does the answer appear to come from?
3. **Is real attendee chat in scope**, or should the AI answer only questions
   captured some other way (e.g. a "ask a question" box that isn't public chat)?
   The second is dramatically cheaper.
4. **Who can ask?** Registered attendees only, or guests too? Guests mean
   anonymous input into an LLM on a public URL.
5. **Retrieval depth** — is prompt-stuffed office context enough, or does this
   need a vector store? Recommend starting without one; there is none today.
6. **Does the answer persist across sessions?** An evergreen webinar runs daily.
   The same question will recur, and a cached/curated answer bank would cut cost
   and improve quality — but it is a distinct feature.

## 10. Out of scope but adjacent

- Reusing this Q&A for the office's public page (the `openclawAgent` Q&A surface
  already exists and overlaps — worth checking before building a parallel one).
- Turning good answers into new `simulatedChat` lines for future sessions.
