# NetworkChains Rank Bonus Plan

Monthly rank-achievement bonuses layered on top of the existing Unilevel Plus comp plan, paid on
NetworkChain subscription revenue.

**Status: designed and economically validated. Not implemented.** No code exists for this yet.

---

## 1. The plan

### Ranks

| Rank | Requirement | Bonus |
|---|---|---|
| **Bronze** | **5 active directs** — 5 direct referrals each holding a paid subscription | $40 |
| **Silver** | 1 Bronze from **4 legs** | $200 |
| **Gold** | 1 Silver from **5 legs** | $300 |
| **Diamond** | 1 Gold from **6 legs** | $1,000 |
| **Platinum** | 1 Diamond from **10 legs** | $10,000 |

A **leg** is one direct referral's entire subtree. "1 Bronze from 4 legs" means four *different*
direct-referral branches must each contain at least one Bronze, anywhere in their depth.

Bronze is the only rank counted on **direct referrals**. Every rank above it counts holders
**anywhere in the downline**, but must find them in distinct legs.

### Stacking

**Bronze stacks with every rank. Higher ranks replace each other.**

| Your top rank | Paid |
|---|---|
| Bronze | $40 |
| Silver | $40 + $200 = **$240** |
| Gold | $40 + $300 = **$340** |
| Diamond | $40 + $1,000 = **$1,040** |
| Platinum | $40 + $10,000 = **$10,040** |

A Gold does **not** also collect the $200 Silver. You hold Bronze plus your single highest rank.

Every rank above Bronze requires Bronze to be active, which is why the $40 is always present.

### Period

Monthly. Qualification is assessed over the calendar month (1st–30th/31st) and paid a day or two
after close. **You must re-qualify every month** — the bonus is recurring, not a one-time
achievement award.

---

## 2. Economics

Assumes **$33/month** blended subscription revenue (multi-month terms price at $33.00–33.33) and a
**$6/subscriber** Unilevel Plus comp plan.

```
per subscriber per month
  revenue                    $33.00
  less unilevel comp         −$6.00
  available for rank bonus   $27.00
```

### Cost per rank unit

The cheapest structure that produces one holder of each rank:

| Rank | People | Subscribers | Revenue | Comp | Bonuses | Company keeps |
|---|---|---|---|---|---|---|
| Bronze | 6 | 5 | $165 | $30 | $40 | $95 — **57.6%** |
| Silver | 26 | 25 | $825 | $150 | $400 | $275 — **33.3%** |
| Gold | 131 | 130 | $4,290 | $780 | $2,340 | $1,170 — **27.3%** |
| Diamond | 787 | 786 | $25,938 | $4,716 | $15,080 | $6,142 — **23.7%** |
| Platinum | 7,871 | 7,870 | $259,710 | $47,220 | $160,840 | $51,650 — **19.9%** |

"Bonuses" is total outflow from the whole structure, not one person's payment. A Silver unit pays
$400 = the Silver's own $240 plus four Bronzes at $40.

### Maximum payout by network size

The most any tree of N subscribers can pay out, solved as an unbounded knapsack over rank units:

| Subscribers | Max bonus | $/sub | Company | Margin |
|---|---|---|---|---|
| 100 | $1,600 | $16.00 | $1,100 | 33.3% |
| 500 | $8,700 | $17.40 | $4,800 | 29.1% |
| 1,000 | $19,000 | $19.00 | $8,000 | 24.2% |
| 1,572 | $30,160 | $19.19 | $12,284 | 23.7% |
| 7,870 | $160,840 | $20.44 | $51,650 | 19.9% |

At 1,000 subscribers the optimum is 1 Diamond + 8 Gold + 38 Silver + 154 Bronze — 201 people
earning. **Platinum is unreachable below 7,870 subscribers.**

---

## 3. Why no cap is needed

The concern was whether unusual tree shapes could drain the company. They can't, and the reason is
structural rather than a policy limit.

### The invariant

> Every person is a subscriber **exactly once**, and counts toward **exactly one** Bronze — their own
> referrer's. Nobody is double-counted.

Because Bronze counts *direct referrals* and every person has exactly one referrer, a subscriber can
only ever fund one person's Bronze.

**Max Bronzes = subscribers ÷ 5**, always. Bronze payout can therefore never exceed **29.6%** of the
available pool, at any scale, in any shape. That is arithmetic, not policy.

### Bronze cannot be gamed

A chain of Bronzes stays flat at **57.58% margin** at any depth — 1 deep or 1,000 deep. Trying the
"merge" trick (referring 5 people who are already Bronze) gives the identical result, because those
5 become *your* directs and therefore *your* subscribers: +5 subs, +$40, **net +$95** either way.

Every rank above Bronze inherits this protection, because they are all built on Bronzes.

### Topologies tested

| Topology | Result |
|---|---|
| Linear / perfectly nested | 19.9% at densest Platinum tree |
| **Outranking** (low rank above high) | **Improves** margin — 19.9% → 20.4% |
| Same-rank stacking, 1,000 deep | Converges to **27.27%**, never below |
| Merge trees (cheapest possible ranks) | Converges to 27.27% (Silver) … 19.47% (Platinum) |
| Random power-law trees, 100–10,000 users | ~62% (real trees are far sparser than worst case) |

### Outranking helps

A Bronze sitting above a Platinum still needs 5 active directs of their own. They bring 5
subscribers ($135 available) and take $40 — **net +$68**. Every outranking upline is accretive.

| Upline rank | Subscribers it must bring | Bonus taken | Net |
|---|---|---|---|
| Bronze | 5 | $40 | **+$95** |
| Silver | 25 | $400 | **+$275** |
| Gold | 130 | $2,340 | **+$1,170** |

**A rank cannot be held without bringing the subscribers that fund it.**

### Same-rank stacking is the worst case — and it's bounded

If a Silver appears in your downline, your leg containing them already holds a Bronze (they *are*
Bronze), so you need only 3 more Bronze legs instead of 4. You reach Silver on fewer subscribers.

| Stacked Silvers | Subscribers | Bonus | $/sub | Margin |
|---|---|---|---|---|
| 1 | 25 | $400 | $16.00 | 33.33% |
| 2 | 45 | $760 | $16.89 | 30.64% |
| 30 | 605 | $10,840 | $17.92 | 27.52% |
| 1,000 | 20,005 | $360,040 | $18.00 | **27.28%** |

It converges to exactly **3/11 = 27.27%**, because both profit and revenue grow linearly:
`margin = (180n + 95) / (660n + 165)`. Verified to n = 1 billion.

Each additional stacked Silver adds **+20 subscribers ($540 available)** and costs **$360** →
**net +$180, every time.** A sum of positive increments cannot average to a negative.

### Merge points lose money per step but cannot propagate

Someone with 4 directs who each already head a Bronze-bearing org becomes Silver by adding almost
nothing: +5 subscribers ($135), −$240 bonus = **−$105**.

This is real, and it happens naturally — it is the same event as "your 4th leg matures". But it
cannot be repeated to drain the company, because **each merge requires 4 legs it did not build**,
each worth +$275. In a 4-way merge tree the ratio is fixed at 1 merge per 3 base orgs:

```
3 base orgs contribute   +$825
1 merge point takes      −$105
NET per block            +$720
```

The higher the rank, the safer this gets — a Platinum merge takes $10,040 but sits on **$516,500**
of profit it did not create (1.9%). Silver merges consume 21.8%, making **Silver the most exposed
rank, not Platinum.**

---

## 4. Worked example

You are **A** with 5 active directs (D1–D5). Each Di turns Bronze by bringing 5 directs of their own.

| After | Subs | Your rank | You get | D's get | Total bonus | Comp | Company |
|---|---|---|---|---|---|---|---|
| start | 5 | Bronze | $40 | $0 | $40 | $30 | $95 |
| D1 Bronze | 10 | Bronze | $40 | $40 | $80 | $60 | $190 |
| D2 Bronze | 15 | Bronze | $40 | $80 | $120 | $90 | $285 |
| D3 Bronze | 20 | Bronze | $40 | $120 | $160 | $120 | $380 |
| **D4 Bronze** | 25 | **Silver** | **$240** | $160 | $400 | $150 | **$275** |
| D5 Bronze | 30 | Silver | $240 | $200 | $440 | $180 | $370 |

**The 4th direct promotes you.** That step is −$105: five new subscribers bring $135, while the new
Bronze ($40) plus your Silver promotion ($200) costs $240.

Note profit *falls* from $380 to $275 while subscribers *rise* from 20 to 25. **Growth can reduce
absolute profit at a promotion.** It recovers within ~2 more Bronzes (+$95 each) and then compounds.

### Promotions cost the difference, not the full bonus

| Promotion | Was paid | Now paid | Delta |
|---|---|---|---|
| Bronze → Silver | $40 | $240 | **+$200** |
| Silver → Gold | $240 | $340 | **+$100** |
| Gold → Diamond | $340 | $1,040 | **+$700** |
| Diamond → Platinum | $1,040 | $10,040 | **+$9,000** |

### Cascades

One new Bronze can complete a leg, promoting the Silver above, which completes *their* leg,
promoting a Gold — all at once, all funded by the same 5 subscribers:

| Deepest promotion triggered | Cascade cost | New value | Net |
|---|---|---|---|
| Bronze only | $40 | $135 | +$95 |
| up to Silver | $240 | $135 | −$105 |
| up to Gold | $340 | $135 | −$205 |
| up to Diamond | $1,040 | $135 | −$905 |
| up to Platinum | $10,040 | $135 | **−$9,905** |

**−$9,905 is the worst single event the plan can produce.** Because bonuses recur monthly, this is a
*permanent* step down in monthly profit, not a one-time hit. At the point a Platinum qualifies the
org holds ~7,870 subscribers earning $51,650/month, so it is absorbed — and **6% growth (470
subscribers) restores it.**

### The filler trap

A Silver with 4 Bronze legs plus 1 filler direct **stays Silver forever**, even after all four
Bronzes become Silver. Gold needs a Silver in **five** legs, and the filler's leg has no downline.

Distributors should build **five real legs**, not four plus a placeholder.

---

## 5. Implementation requirements

None of this is built. When it is, four rules are load-bearing.

### 5.1 Nearest-first leg resolution

When resolving Silver and above, walk each leg and take the **shallowest** qualifying holder. A naive
"count every Bronze in my downline" lets one Bronze be claimed by many ancestors and reintroduces
leakage the leg rule otherwise prevents.

Verified: compressed and uncapped selection give **identical** results at 100 / 500 / 2,000 / 10,000
users — but only under this ordering.

### 5.2 Paid subscriptions only

The $25 Unilevel Plus licence grants a **free first month**. Free months must **not** count toward
qualification, or five free-month referrals trigger $40 against **$0 revenue**. During a launch push
with 1,000 free signups that is roughly 200 Bronzes = **$8,000 paid on nothing**.

Qualification must require a subscription that actually billed in the period.

### 5.3 Multi-month terms count per period

A 12-month subscriber is active for 12 qualification periods.
`metadata.periodStart` / `periodEnd` on the invoice already expresses this.

Bonus cost is fixed at **$8.00 per subscriber-month** ($40 ÷ 5) regardless of term, so prepaying does
not change the ratio — it only improves cash flow, since money arrives before bonuses go out.

Because a prepaid term locks qualification for its duration, **any change to the bonus table should
apply from the next term, not retroactively.**

### 5.4 Comp plan at $6

The deployed value is `productConfig.upPortion: 12`. At maximum density:

| Comp | Margin at densest tree |
|---|---|
| **$6** | **19.9%** |
| $8 | 13.8% |
| $10 | 7.8% |
| $12 | **1.7%** |

$6 is the only rate with real headroom. **Note this halves every current affiliate's NetworkChain
earnings** (direct bonus $4.32 → $2.16/sub) — a live change to people already earning, and a
deliberate decision rather than a side effect.

### Monitoring

Track **Bronze per 100 paying subscribers** monthly. Every higher rank is downstream of it.

- Structural ceiling: **20** (each subscriber has one referrer, Bronze consumes 5)
- Observed in simulation: **~4**
- Break-even at comp $6: **~47**
- Investigate above **15**

A reading above 20 means the qualification query is counting something it shouldn't — free months,
unpaid subscriptions, or one subscriber under two uplines.

---

## 6. Verification

1. Assert **Bronze count ≤ paying subscribers ÷ 5** every period. A breach is a query bug.
2. Assert **4 active directs yields no rank and no payment** — no partial credit.
3. Re-run the tree simulation (chain, star, 5-ary, random power-law, merge) at 100 / 1k / 10k and
   confirm compressed vs uncapped stay identical. Divergence means the selection order is wrong.
4. Dry-run a full period against real data — count qualifiers, price the run — before money moves.
5. Assert free-month subscribers are excluded from qualification.

---

## 7. Limits of this analysis

The models cover **revenue − comp − bonuses** only. Four things sit outside them:

- **Fixed costs.** Payment processing, GST remittance, infrastructure, support and salaries are not
  modelled. The margins here are contribution, **not net profit**.
- **Intra-period churn.** Models assume clean months. Someone qualifying on the 1st whose
  subscribers lapse on the 15th is paid in full against partial revenue.
- **Refunds and chargebacks** after a bonus has been paid. There is no reversal machinery anywhere
  in the codebase.
- **Blended price drift.** Everything assumes $33/month. Deeper term discounts move every figure
  proportionally.

**The structure is sound and cannot be gamed** — that conclusion is robust across every topology
tested. **Whether it is profitable in practice** depends on comp being set to $6, free months being
excluded, and fixed costs fitting inside ~27% contribution.

---

## 8. Open decisions

- Does one unqualified month break the rank immediately, or is there a grace period?
- Should a rank holder's **own** subscription need to be active, or only their directs'?
- Should the $10,000 Platinum bonus carry a company-wide cap in early periods? It is 4× the entire
  bonus cost of a 100-subscriber cohort.
- Bonus amounts were sized against $36/month. At the $33 blended rate actually shipped, every ratio
  here is ~9% tighter than the original sheet implies.
