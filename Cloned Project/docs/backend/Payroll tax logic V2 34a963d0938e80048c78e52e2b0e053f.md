# Payroll tax logic V2

# Indian Payroll – Tax Computation Logic

**Module:** Payroll → Tax Engine
**Applicable FY:** 2024-25 (AY 2025-26)
**Covers:** Old Tax Regime & New Tax Regime (Default from FY 2024-25)
**Legal References:** Income Tax Act 1961, Sections 10, 16, 80C–80U, 192, 115BAC

---

## Table of Contents

1. [Core Concepts & Data Model](about:blank#1-core-concepts--data-model)
2. [Salary Component Taxonomy](about:blank#2-salary-component-taxonomy)
3. [Gross Salary Computation](about:blank#3-gross-salary-computation)
4. [Exemption Logic – Old Regime](about:blank#4-exemption-logic--old-regime)
5. [Standard Deduction](about:blank#5-standard-deduction)
6. [Chapter VI-A Deductions – Old Regime](about:blank#6-chapter-vi-a-deductions--old-regime)
7. [Professional Tax](about:blank#7-professional-tax)
8. [Old Regime – Tax Slab & Computation](about:blank#8-old-regime--tax-slab--computation)
9. [New Regime – Tax Slab & Computation (Default FY 2024-25)](about:blank#9-new-regime--tax-slab--computation-default-fy-2024-25)
10. [Cess & Surcharge](about:blank#10-cess--surcharge)
11. [Monthly TDS Computation (Section 192)](about:blank#11-monthly-tds-computation-section-192)
12. [Regime Comparison & Selection Logic](about:blank#12-regime-comparison--selection-logic)
13. [Edge Cases & Special Conditions](about:blank#13-edge-cases--special-conditions)
14. [Database Schema Notes](about:blank#14-database-schema-notes)
15. [Pseudocode Reference](about:blank#15-pseudocode-reference)

---

## 1. Core Concepts & Data Model

### Key Definitions

| Term | Definition |
| --- | --- |
| `gross_salary` | Sum of all earning components before any deduction |
| `exempt_income` | Portion of earnings excluded from tax by law (HRA, LTA, etc.) |
| `taxable_salary` | `gross_salary − exempt_income` |
| `standard_deduction` | Flat deduction allowed under Section 16(ia) |
| `chapter_via_deductions` | Employee-declared deductions (80C, 80D, etc.) — Old Regime only |
| `net_taxable_income` | `taxable_salary − standard_deduction − chapter_via_deductions − PT` |
| `annual_tax` | Tax on `net_taxable_income` per applicable slab |
| `cess` | 4% Health & Education Cess on `annual_tax` |
| `surcharge` | Additional tax if income exceeds ₹50L (marginal relief applies) |
| `annual_tax_liability` | `annual_tax + surcharge + cess` |
| `monthly_tds` | `(annual_tax_liability − tds_deducted_ytd) ÷ remaining_months_in_fy` |

### Financial Year Mapping

```
FY 2024-25 = April 1, 2024 to March 31, 2025
Payroll months: April (Month 1) through March (Month 12)
remaining_months = 12 − (current_payroll_month − 1)
  e.g., for June payroll (month 3): remaining = 12 − 2 = 10
```

### Regime Rules (FY 2024-25 onwards)

- **New Regime is the DEFAULT** from FY 2024-25 (per Finance Act 2023 amendment to Sec 115BAC).
- Employee must **explicitly opt for Old Regime** by submitting declaration at the start of FY.
- Declaration is stored in `employee_tax_declarations.regime` as `OLD` or `NEW`.
- Employee can change regime **only once per FY** (before filing ITR), but for TDS purposes, the employer-declared regime is locked at the start of the FY.

---

## 2. Salary Component Taxonomy

Every component in `salary_components` must have a `taxability_type` field. This drives the entire tax engine.

### Component Types

```
FULLY_TAXABLE       → Included 100% in gross; no exemption available
EXEMPT_FORMULA      → Partial exemption computed via rule engine (HRA, LTA)
EXEMPT_FIXED        → Fixed statutory cap exempted (e.g. ₹100/child/month education allowance)
EXEMPT_FULL         → 100% exempt (e.g. employer PF contribution up to 12% of basic)
DEDUCTION_STATUTORY → Reduces net pay AND reduces taxable income (PF employee, PT)
DEDUCTION_VOLUNTARY → Reduces net pay only; no tax benefit from employer side (loan EMI, advance)
REIMBURSEMENT       → Not part of salary; paid on claim submission; no TDS if within policy limit
```

### Standard Component Mapping

| Component | Type | Notes |
| --- | --- | --- |
| Basic Salary | `FULLY_TAXABLE` | Base for PF, HRA, gratuity calculations |
| Dearness Allowance (DA) | `FULLY_TAXABLE` | Treated same as basic for PF |
| House Rent Allowance (HRA) | `EXEMPT_FORMULA` | Min of 3 conditions – see Section 4 |
| Special Allowance | `FULLY_TAXABLE` | No exemption; catch-all component |
| Leave Travel Allowance (LTA) | `EXEMPT_FORMULA` | Exempt 2 times in 4-year block; see Section 4 |
| Children Education Allowance | `EXEMPT_FIXED` | ₹100/child/month, max 2 children = ₹200/month |
| Children Hostel Allowance | `EXEMPT_FIXED` | ₹300/child/month, max 2 children = ₹600/month |
| Medical Reimbursement | `FULLY_TAXABLE` | Exemption removed from FY 2018-19; now Standard Deduction covers this |
| Uniform / Dress Allowance | `EXEMPT_FIXED` | Only if actual expenditure on uniform; requires bill; else taxable |
| Telephone / Internet Reimb. | `REIMBURSEMENT` | Exempt against actual bills; excess taxable |
| PF Employee Contribution | `DEDUCTION_STATUTORY` | 12% of Basic+DA; reduces taxable income as 80C |
| PF Employer Contribution | `EXEMPT_FULL` | Exempt up to 12% of Basic+DA; if employer contributes > 12%, excess is taxable |
| ESI Employee Contribution | `DEDUCTION_STATUTORY` | 0.75% of gross if gross ≤ ₹21,000 |
| Gratuity (provision) | `EXEMPT_FULL` | Monthly provisioning by employer; not taxable at accrual |
| Professional Tax | `DEDUCTION_STATUTORY` | State-specific; reduces taxable income under Sec 16(iii) |
| Bonus / Performance Pay | `FULLY_TAXABLE` | Taxable in month of payment; spike TDS logic applies |
| Leave Encashment (during service) | `FULLY_TAXABLE` | Exempt only on retirement/separation per Sec 10(10AA) |
| Overtime Pay | `FULLY_TAXABLE` | No exemption |
| NPS Employer Contribution | `EXEMPT_FULL` | Exempt up to 10% of Basic+DA under Sec 80CCD(2); available in both regimes |

---

## 3. Gross Salary Computation

```
gross_salary_monthly = SUM of all earning components (attendance-prorated)

annual_gross_projected = SUM(
    actuals from April to current month,
    projected_monthly_gross × remaining_months
)
```

### 3.1 Attendance Denominator

**Fixed rule: Calendar days denominator only. This is system-locked — admin cannot change it.**

```
attendance_factor   = days_present / days_in_calendar_month

days_in_calendar_month per month:
  Jan=31, Feb=28 (29 in leap year), Mar=31, Apr=30, May=31, Jun=30
  Jul=31, Aug=31, Sep=30, Oct=31, Nov=30, Dec=31

payable_component   = component_amount × attendance_factor
```

> Rationale: Calendar-day denominator is the most transparent and legally defensible method
for Indian payroll. It is consistent with how monthly CTC is communicated to employees.
The 26-day denominator is excluded — it produces different per-day rates per month and
causes disputes in LOP deduction calculations.
> 

Fixed reimbursements (phone, internet) are paid at full value or ₹0 based on claim; not attendance-prorated.

---

### 3.2 Attendance Cutoff Date (Admin/Founder -Configured)

The **Attendance Cutoff Date** defines the mid-month boundary that splits the calendar into attendance windows. Each window’s attendance records are used to compute salary for the corresponding pay month.

### What is an Attendance Cutoff?

```
Example: Cutoff day = 18

Attendance Window for May salary:
    FROM: April 19 (00:00)
    TO:   May 18 (23:59)

Attendance Window for June salary:
    FROM: May 19 (00:00)
    TO:   June 18 (23:59)
```

### Who Can Set It & When

- **Only Founder / Admin role** can configure this setting
- Set once during **initial company setup** in HRMS
- **Locked permanently after the first payroll run is approved**
    - Any change attempt after lock → hard error: *“Attendance cutoff date cannot be changed after payroll has been processed. Please contact support.”*
- **Only exception:** Can be changed at the **start of a new Financial Year (April)**, and only **before** the first payroll of that FY is approved
- Show a warning when changing at FY start: *“Changing the cutoff date affects all attendance windows for this FY. Ensure all historical payroll data has been reconciled.”*

### Allowed Cutoff Date Values

```
ALLOWED : 1 through 28
BLOCKED : 29, 30, 31
```

**Why 29–31 are blocked:**
February has only 28 days (29 in leap year). A cutoff of 30 means “February 30” which does not exist — causing the attendance window to overlap or skip days, producing incorrect salary calculations every year without exception.

**UI validation rule:**

```
IF selected_cutoff_date IN [29, 30, 31]:
    SHOW ERROR: "Dates 29–31 are not allowed. They cause errors in February.
                 Common choices: 1, 16, 18, 20, 25, 26."
    BLOCK SAVE
```

**Common cutoff dates used by Indian companies:**

| Cutoff Day | Typical Use Case |
| --- | --- |
| 1 | Clean calendar month; large enterprises |
| 16 | Early mid-month; 10–14 days for payroll team to process |
| 18 | Very common in mid-size Indian companies |
| 20 | Slightly more time for attendance review |
| 25 | Near-full month data before processing |
| 26 | Aligns with 26-day PF logic; common in manufacturing |

**Special case — cutoff day = 1:**
When cutoff = 1, the window is the full calendar month (1st to last day). No mid-month split logic needed. Treat identically to standard calendar-month payroll — no carry-forward LOP logic applies.

**DB field:** `payroll_config.attendance_cutoff_day` → `INT NOT NULL DEFAULT 1 CHECK (attendance_cutoff_day BETWEEN 1 AND 28)`

```sql
ALTER TABLE payroll_config
  ADD COLUMN attendance_cutoff_day INT NOT NULL DEFAULT 1
    CHECK (attendance_cutoff_day BETWEEN 1 AND 28),
  ADD COLUMN cutoff_locked         BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN cutoff_locked_since   DATE;
  -- Trigger: SET cutoff_locked=TRUE, cutoff_locked_since=TODAY
  -- when the first payroll_run for the company reaches status='APPROVED'
```

### Cutoff Window Computation

```python
def get_attendance_window(pay_month, pay_year, cutoff_day):
    """
    Returns the attendance start and end dates for a given pay month.
    pay_month: 1 = January, 12 = December
    cutoff_day: e.g. 18
    """
    # Window ends on cutoff_day of the pay month
    window_end = date(pay_year, pay_month, cutoff_day)

    # Window starts on (cutoff_day + 1) of the PREVIOUS calendar month
    prev_month = pay_month - 1 if pay_month > 1 else 12
    prev_year  = pay_year if pay_month > 1 else pay_year - 1
    window_start = date(prev_year, prev_month, cutoff_day + 1)

    return window_start, window_end

# Example: June 2025 salary, cutoff_day = 18
# window_start = May 19, 2025
# window_end   = June 18, 2025
```

---

### 3.3 New Employee – Mid-Cycle Joining (Grace Window & Deferred LOP Rule)

This is the most critical edge case for the cutoff model. Get this wrong and the first payslip of every new employee will be incorrect.

### The Core Scenario (as defined by product owner)

```
Company cutoff day : 18
Attendance cycle   : 19th of Month M  →  18th of Month M+1  (used to pay Month M+1 salary)

Employee joins     : 19th of Month M
  → They join exactly on the first day of the new cycle
  → Paid normally for the full cycle

Employee joins     : 25th of Month M  (AFTER the previous cutoff on 18th of Month M)
  → They fall into the current running cycle (which opened on the 19th)
  → Company policy: Pay full salary from 25th to end of Month M — NO LOP applied here
  → If employee took unpaid leaves between 25th–31st of Month M,
     those LOP days are NOT deducted from Month M
  → Instead, they are DEDUCTED from Month M+1's salary
     (because the cycle 19th Month M → 18th Month M+1 is when they are recovered)
```

### Grace Window Definition

```
An employee is in the GRACE WINDOW if:
    joining_date.day > cutoff_day   (joined after the cutoff of joining month)

Grace tail period:
    FROM: joining_date
    TO:   last_day_of(joining_month)

During the grace tail:
    → Pay full prorated salary (joining_date → month_end)
    → Record any LOP days taken — but DO NOT deduct from this month
    → Flag those LOP days for deduction in next payroll cycle

Grace window does NOT apply if:
    joining_date.day <= cutoff_day  → employee joins before or on cutoff
    → First payroll is computed normally using that month's attendance window
```

### Rule: Grace Tail is Always Paid Full (LOP Deferred)

```
Grace tail salary = monthly_gross × (grace_tail_days / days_in_joining_month)
                  — NO LOP deduction applied

LOP taken during grace tail → stored as deferred_lop_days
                             → deducted in NEXT payroll cycle
```

### Detailed Worked Example

```
Company cutoff day  : 18
Employee DOJ        : April 19, 2024  (joins exactly on cutoff+1 = start of new cycle)
Monthly gross       : ₹60,000

This is the CLEAN CASE — employee joins on cycle start.
Attendance window for May salary: April 19 → May 18
Employee present for full window → normal computation. No grace logic needed.

─────────────────────────────────────────────────────────────────

NOW THE GRACE WINDOW CASE:

Company cutoff day  : 18
Employee DOJ        : April 25, 2024  (joins AFTER cutoff of April 18)
Monthly gross       : ₹60,000
Days in April       : 30
Days in May         : 31
Employee takes 2 LOP days between April 25–30 (grace tail)
Employee takes 1 LOP day between May 1–18 (within next cycle)

─── APRIL PAYROLL (run after April 18 cutoff) ───

Attendance window: March 19 → April 18
Employee joined April 25 → NOT IN this window at all → April payroll = ₹0

GRACE TAIL (April 25 → April 30 = 6 days):
    grace_tail_days     = 6
    grace_tail_factor   = 6 / 30 = 0.2000
    grace_tail_salary   = 60,000 × 0.2 = ₹12,000  ← PAID IN FULL
    LOP taken in grace  = 2 days          ← RECORDED but NOT DEDUCTED now
    deferred_lop_days   = 2               ← Will be recovered in May payroll

Grace tail amount (₹12,000) is included in the April payroll run
as a separate line item: "Joining Partial Pay — April 25–30"

─── MAY PAYROLL (run after May 18 cutoff) ───

Attendance window: April 19 → May 18

Employee was present from April 25 onward.
Days employee was in window: April 25 → May 18 = 24 days
LOP in this window: 1 day (May 5, suppose)

Days present in window: 24 − 1 = 23 days

Deferred LOP from grace tail: 2 days (April 25–30 LOP now recovered)

Total LOP this month: 1 (window) + 2 (deferred) = 3 days
Effective days present: 24 − 3 = 21

attendance_factor (May) = 21 / 31 = 0.6774
cycle_salary (May)      = 60,000 × 0.6774 = ₹40,645

May gross = ₹40,645
(Grace tail already paid in April run; not double-counted here)

─── JUNE PAYROLL onwards ───

Employee is now on NORMAL cycle. No grace logic. No deferred LOP.
Attendance window: May 19 → June 18. Standard computation.
```

### Implementation Logic

```python
def compute_attendance_factor(employee, pay_month, pay_year, cutoff_day):

    window_start, window_end = get_attendance_window(pay_month, pay_year, cutoff_day)
    doj = employee.date_of_joining

    # --- Case 1: Employee joined before or on window_start → fully normal ---
    if doj <= window_start:
        lop_days   = get_lop_in_window(employee.id, window_start, window_end)
        days_in_window = (window_end - window_start).days + 1
        days_present   = days_in_window - lop_days
        return days_present / calendar_days_in_month(pay_month, pay_year), lop_days

    # --- Case 2: Employee joined WITHIN the window (mid-cycle joiner) ---
    elif window_start < doj <= window_end:
        days_in_window       = (window_end - window_start).days + 1
        days_employee_in_window = (window_end - doj).days + 1

        # LOP within window (from DOJ to window_end only)
        lop_in_window = get_lop_in_window(employee.id, doj, window_end)

        # Carry-forward LOP: unpaid leaves taken between DOJ and end of PREVIOUS month
        # (the "full pay" joining partial period)
        prev_month_end   = date(pay_year, pay_month, 1) - timedelta(days=1)  # e.g. May 31
        if doj <= prev_month_end:
            carryforward_lop = get_lop_in_window(employee.id, doj, prev_month_end)
        else:
            carryforward_lop = 0  # joined in current month; no carry-forward period

        total_lop    = lop_in_window + carryforward_lop
        days_present = days_employee_in_window - total_lop
        return max(days_present, 0) / calendar_days_in_month(pay_month, pay_year), total_lop

    # --- Case 3: Employee joined AFTER the window_end → not on payroll yet ---
    else:
        return 0, 0

def compute_joining_partial_pay(employee, cutoff_day):
    """
    Pays the partial salary for the joining month calendar days
    (from DOJ to end of that calendar month). No LOP applied.
    Paid either in the joining month payroll or the next pay cycle (configurable).
    """
    doj        = employee.date_of_joining
    month_end  = last_day_of_month(doj.year, doj.month)
    days_to_pay = (month_end - doj).days + 1
    days_in_month = calendar_days_in_month(doj.month, doj.year)

    joining_factor = days_to_pay / days_in_month
    partial_pay    = employee.monthly_gross × joining_factor

    # No LOP deducted from this partial pay — guaranteed by policy
    return partial_pay
```

### Summary Table: What Happens When

| Scenario | May Salary | June Salary |
| --- | --- | --- |
| Employee joins May 1 (before window) | Full month (normal) | Normal cutoff window |
| Employee joins May 19 (on window start) | ₹0 (not in May window) | Full window May 19–June 18 |
| Employee joins May 25 (mid window) | Partial pay May 25–31, no LOP | May 25–June 18 window; carry-forward LOP from May 25–31 |
| Employee joins June 19 (after window end) | ₹0 | ₹0 (not yet in June window; appears in July payroll) |

### Admin UI Requirements

```
Before running each month's payroll, Admin must:

1. Confirm the Attendance Cutoff Day (set once in payroll_config; shown for confirmation)
2. Review the computed attendance window dates shown on screen:
       "Attendance window for [Month] salary: [Start Date] to [End Date]"
3. Lock the window → payroll engine uses these dates for ALL employees
4. Any employee whose DOJ falls within or after the window is flagged for review
```

### DB Fields Required

```sql
-- Company-level payroll configuration
ALTER TABLE payroll_config ADD COLUMN attendance_cutoff_day INT DEFAULT 18;
  -- constraint: CHECK (attendance_cutoff_day BETWEEN 1 AND 28)

-- Per payroll run, store the resolved window (audit trail)
ALTER TABLE payroll_runs ADD COLUMN attendance_window_start DATE;
ALTER TABLE payroll_runs ADD COLUMN attendance_window_end   DATE;

-- Per employee per payroll run
ALTER TABLE payroll_transactions ADD COLUMN carry_forward_lop_days NUMERIC DEFAULT 0;
ALTER TABLE payroll_transactions ADD COLUMN joining_partial_pay    NUMERIC DEFAULT 0;
ALTER TABLE payroll_transactions ADD COLUMN is_joining_month       BOOLEAN DEFAULT FALSE;
```

---

## 4. Exemption Logic – Old Regime

> These exemptions are **NOT available under the New Regime** unless explicitly stated.
> 

### 4.1 HRA Exemption – Section 10(13A)

**Applicable only if:**
- HRA is a defined component in the salary structure (amount > 0)
- Employee is actually paying rent (self-declaration with landlord details)
- Employee does NOT own the house in the same city

**Three-condition formula (take the MINIMUM of all three):**

```
condition_1 = actual_HRA_received_annual -
condition_2 = (actual_rent_paid_annual) − (10% × basic_annual)
condition_3 = IF city IN [Delhi, Mumbai, Chennai, Kolkata]:
                  50% × basic_annual
              ELSE:
                  40% × basic_annual

HRA_exempt = MIN(condition_1, condition_2, condition_3)
HRA_taxable = actual_HRA_received_annual − HRA_exempt
```

**Important conditions:**
- If `condition_2` is negative (rent < 10% of basic), `HRA_exempt = 0` → full HRA is taxable
- If employee does NOT submit rent declaration, `HRA_exempt = 0`
- If monthly rent > ₹8,333 (i.e., annual > ₹1,00,000), employee must provide **landlord’s PAN**. If PAN not provided, employer cannot allow exemption.
- Metro cities for 50% rule: Delhi (NCR included), Mumbai (MMR included), Chennai, Kolkata

**Data required from employee declaration:**

```json
{
  "monthly_rent_paid": 25000,
  "city_type": "METRO",
  "landlord_name": "XYZ",
  "landlord_pan": "ABCDE1234F",
  "owns_house_in_city": false
}
```

### 4.2 LTA Exemption – Section 10(5)

**Rules:**
- Exempt for 2 journeys in a block of 4 calendar years
- Current block: 2022–2025
- Only domestic travel; international travel is taxable
- Exemption is limited to actual travel fare (economy air / AC1 rail / DLXS bus)
- Family: spouse, children (max 2 children born after Oct 1, 1998), parents, siblings (if dependent)

```
LTA_exempt_per_journey = MIN(actual_fare_claimed, LTA_component_annual / 2)

Per FY, employee can claim 0, 1, or 2 journeys.
Unclaimed exemption lapses (carry-forward only within the 4-year block for ONE journey).
```

**Implementation approach:**
- Store LTA claims in a separate `lta_claims` table
- Each payroll run checks if employee has submitted an LTA claim for the FY
- Apply exemption in the month the claim is processed
- For TDS, if no claim submitted, treat full LTA as taxable

### 4.3 Children Education & Hostel Allowance – Section 10(14)

```
education_allowance_exempt = MIN(actual_allowance_paid, 100 × num_children_eligible × 12)
hostel_allowance_exempt    = MIN(actual_allowance_paid, 300 × num_children_eligible × 12)

num_children_eligible = MIN(num_children, 2)
```

> Note: This allowance is **NOT available under New Regime**.
> 

### 4.4 Other Fixed Exemptions (Old Regime only)

| Allowance | Exempt Amount | Section |
| --- | --- | --- |
| Transport Allowance (Disabled employees) | ₹3,200/month | 10(14) |
| Helper Allowance | Actual amount for official duties | 10(14) |
| Research Allowance | Actual research expenses | 10(14) |
| Uniform Allowance | Actual cost of purchase/maintenance | 10(14) |

---

## 5. Standard Deduction

Available under **BOTH regimes** (from FY 2019-20 onwards; enhanced in FY 2024-25):

| Regime | Standard Deduction |
| --- | --- |
| Old Regime | ₹50,000 per annum |
| New Regime | ₹75,000 per annum (enhanced from ₹50,000 in Union Budget 2024) |

```
taxable_salary_after_std_ded = taxable_salary − standard_deduction
```

> No documentation required. Applied automatically for all salaried employees.
> 

---

## 6. Chapter VI-A Deductions – Old Regime

> **NONE of the following apply under the New Regime**, except 80CCD(2) which applies to BOTH.
> 

Employee must submit an **Investment Declaration Form** at the start of the FY. Actual proofs must be collected before February payroll.

### 6.1 Section 80C – ₹1,50,000 aggregate cap

Qualifying instruments:

| Instrument | Notes |
| --- | --- |
| EPF / PF Employee Contribution | System-computed; auto-included |
| PPF | Declared; proof required |
| ELSS Mutual Funds | Proof required |
| Life Insurance Premium | Proof required |
| Home Loan Principal Repayment | Proof required |
| NSC / KVP | Proof required |
| Sukanya Samriddhi | Proof required |
| Tuition Fees (2 children) | Proof required |
| 5-year Tax Saving FD | Proof required |
| ULIP | Proof required |

```
sec80C_claimed = MIN(total_declared_80C_investments, 150000)
```

> PF employee contribution is auto-added to 80C. If employee’s PF already equals ₹1,50,000, no additional 80C benefit is available.
> 

### 6.2 Section 80CCD(1B) – NPS Self Contribution

```
sec80CCD_1B_claimed = MIN(employee_NPS_self_contribution, 50000)
```

> This is **OVER AND ABOVE** the 80C cap of ₹1.5L. Total potential deduction from 80C + 80CCD(1B) = ₹2,00,000.
> 

### 6.3 Section 80CCD(2) – NPS Employer Contribution *(BOTH Regimes)*

```
sec80CCD_2_limit = 10% × (basic + DA)    // For private sector employees
sec80CCD_2_limit = 14% × (basic + DA)    // For central government employees

sec80CCD_2_claimed = MIN(employer_NPS_contribution, sec80CCD_2_limit)
```

> This deduction reduces the taxable income and is available under **both Old and New Regime**.
> 

### 6.4 Section 80D – Medical Insurance Premium

```
IF employee_age < 60:
    self_family_limit = 25000
ELSE:
    self_family_limit = 50000

IF parent_age < 60:
    parent_limit = 25000
ELSE:
    parent_limit = 50000

sec80D_claimed = MIN(self_family_premium_paid, self_family_limit)
                 + MIN(parent_premium_paid, parent_limit)
```

### 6.5 Section 80TTA / 80TTB – Savings Interest

```
IF employee_age < 60:
    sec80TTA_claimed = MIN(savings_account_interest, 10000)
ELSE:
    sec80TTB_claimed = MIN(savings_and_fd_interest, 50000)
```

### 6.6 Section 80G – Donations

- 100% deduction: PM Relief Fund, National Defence Fund
- 50% deduction: Other notified charitable institutions
- Some donations qualify with 10% of Adjusted GTI limit; some without
- Requires valid 80G certificate and acknowledgement

```
sec80G_100pct = MIN(total_100pct_donations, adjusted_gross_income)
sec80G_50pct  = MIN(total_50pct_donations_with_limit, 10% × adjusted_gross_income) × 0.50
sec80G_claimed = sec80G_100pct + sec80G_50pct
```

### 6.7 Section 80E – Education Loan Interest

```
sec80E_claimed = actual_education_loan_interest_paid  // No cap; only for 8 years
```

### 6.8 Section 80EEA – First Home Loan Interest (if applicable)

```
// Only if stamp duty value of house ≤ ₹45L and loan sanctioned between Apr 2019 and Mar 2022
sec80EEA_claimed = MIN(home_loan_interest_paid, 150000)
```

### 6.9 Aggregate Deduction Cap

```
total_chapter_via = sec80C_claimed
                  + sec80CCD_1B_claimed
                  + sec80CCD_2_claimed   // Both regimes
                  + sec80D_claimed
                  + sec80TTA_or_TTB
                  + sec80G_claimed
                  + sec80E_claimed
                  + sec80EEA_claimed
                  + (any other declared)
```

> No single aggregate cap applies across all sections, but each section has its own cap as above.
> 

---

## 7. Professional Tax

PT is a **state-level tax** deducted from salary. It reduces taxable income under Section 16(iii) in **both regimes**.

### State PT Slabs (Store in `state_pt_slabs` table)

| State | Monthly Gross Range | Monthly PT |
| --- | --- | --- |
| Maharashtra | Up to ₹7,500 | ₹0 |
| Maharashtra | ₹7,501 – ₹10,000 | ₹175 |
| Maharashtra | ₹10,001 and above | ₹200 (Feb: ₹300) |
| Karnataka | Up to ₹14,999 | ₹0 |
| Karnataka | ₹15,000 and above | ₹200 |
| Tamil Nadu | Up to ₹21,000 | ₹0 |
| Tamil Nadu | ₹21,001 – ₹30,000 | ₹135 |
| Tamil Nadu | ₹30,001 – ₹45,000 | ₹315 |
| Tamil Nadu | ₹45,001 – ₹60,000 | ₹690 |
| Tamil Nadu | ₹60,001 – ₹75,000 | ₹1,025 |
| Tamil Nadu | ₹75,001 and above | ₹1,250 |
| West Bengal | Separate quarterly slabs | Varies |
| Telangana | Up to ₹14,999 | ₹0 |
| Telangana | ₹15,000 – ₹19,999 | ₹150 |
| Telangana | ₹20,000 and above | ₹200 |
| Gujarat | Up to ₹5,999 | ₹0 |
| Gujarat | ₹6,000 – ₹8,999 | ₹80 |
| Gujarat | ₹9,000 – ₹11,999 | ₹150 |
| Gujarat | ₹12,000 and above | ₹200 |
| Delhi, Haryana, Rajasthan, UP, MP, Bihar | No PT | ₹0 |

**Rules:**
- PT is computed on **monthly gross** (actual month’s gross, not prorated annual)
- Maharashtra Feb month PT = ₹300 for gross > ₹10,000 (double month rule)
- Annual PT cannot exceed ₹2,500 — if YTD PT reaches ₹2,500, deduct ₹0 for remaining months
- PT deducted from employee salary; employer must remit to state treasury

```sql
-- DB lookup
SELECT monthly_pt
FROM state_pt_slabs
WHERE state = :employee_state
  AND :monthly_gross BETWEEN gross_from AND gross_to
  AND :payroll_month = month_override OR month_override IS NULL
ORDER BY effective_date DESC LIMIT 1;
```

---

## 8. Old Regime – Tax Slab & Computation

### 8.1 Tax Slabs (FY 2024-25)

### For individuals below 60 years:

| Net Taxable Income | Tax Rate |
| --- | --- |
| Up to ₹2,50,000 | Nil |
| ₹2,50,001 – ₹5,00,000 | 5% |
| ₹5,00,001 – ₹10,00,000 | 20% |
| Above ₹10,00,000 | 30% |

### For Senior Citizens (60–79 years):

| Net Taxable Income | Tax Rate |
| --- | --- |
| Up to ₹3,00,000 | Nil |
| ₹3,00,001 – ₹5,00,000 | 5% |
| ₹5,00,001 – ₹10,00,000 | 20% |
| Above ₹10,00,000 | 30% |

### For Super Senior Citizens (80+ years):

| Net Taxable Income | Tax Rate |
| --- | --- |
| Up to ₹5,00,000 | Nil |
| ₹5,00,001 – ₹10,00,000 | 20% |
| Above ₹10,00,000 | 30% |

### 8.2 Tax Computation – Old Regime

```python
def compute_tax_old_regime(net_taxable_income, age):
    tax = 0

    if age >= 80:
        slabs = [
            (500000, 0.00),
            (1000000, 0.20),
            (float('inf'), 0.30)
        ]
        lower = [0, 500000, 1000000]
    elif age >= 60:
        slabs = [
            (300000, 0.00),
            (500000, 0.05),
            (1000000, 0.20),
            (float('inf'), 0.30)
        ]
        lower = [0, 300000, 500000, 1000000]
    else:
        slabs = [
            (250000, 0.00),
            (500000, 0.05),
            (1000000, 0.20),
            (float('inf'), 0.30)
        ]
        lower = [0, 250000, 500000, 1000000]

    for i, (upper, rate) in enumerate(slabs):
        if net_taxable_income <= 0:
            break
        taxable_in_slab = min(net_taxable_income, upper - lower[i])
        tax += taxable_in_slab * rate
        net_taxable_income -= taxable_in_slab

    return tax
```

### 8.3 Section 87A Rebate – Old Regime

```
IF net_taxable_income <= 500000:
    rebate = MIN(tax_before_rebate, 12500)
    tax_after_rebate = tax_before_rebate − rebate
ELSE:
    tax_after_rebate = tax_before_rebate
```

> Rebate makes tax = 0 for income up to ₹5L in Old Regime (effective zero-tax threshold).
> 

---

## 9. New Regime – Tax Slab & Computation (Default FY 2024-25)

### 9.1 Tax Slabs (Section 115BAC – FY 2024-25)

> Union Budget 2024 revised slabs (effective FY 2024-25):
> 

| Net Taxable Income | Tax Rate |
| --- | --- |
| Up to ₹3,00,000 | Nil |
| ₹3,00,001 – ₹7,00,000 | 5% |
| ₹7,00,001 – ₹10,00,000 | 10% |
| ₹10,00,001 – ₹12,00,000 | 15% |
| ₹12,00,001 – ₹15,00,000 | 20% |
| Above ₹15,00,000 | 30% |

> **No age-based differentiation in New Regime.** Same slabs for all ages.
> 

### 9.2 Tax Computation – New Regime

```python
def compute_tax_new_regime(net_taxable_income):
    slabs = [
        (300000, 0.00),
        (700000, 0.05),
        (1000000, 0.10),
        (1200000, 0.15),
        (1500000, 0.20),
        (float('inf'), 0.30)
    ]
    lower = [0, 300000, 700000, 1000000, 1200000, 1500000]

    tax = 0
    for i, (upper, rate) in enumerate(slabs):
        if net_taxable_income <= 0:
            break
        taxable_in_slab = min(net_taxable_income, upper - lower[i])
        tax += taxable_in_slab * rate
        net_taxable_income -= taxable_in_slab

    return tax
```

### 9.3 Section 87A Rebate – New Regime

```
IF net_taxable_income <= 700000:
    rebate = MIN(tax_before_rebate, 25000)
    tax_after_rebate = 0        // Effective zero-tax up to ₹7L in New Regime
ELSE:
    tax_after_rebate = tax_before_rebate
```

> This is the key selling point of New Regime — zero tax up to ₹7L effective income.
> 

### 9.4 Marginal Relief – New Regime (income just above ₹7L)

```
// If income is say ₹7,10,000 — without marginal relief, full tax would be payable
// With marginal relief, excess tax is limited to the amount of income above ₹7L

IF net_taxable_income > 700000 AND tax_after_rebate > (net_taxable_income - 700000):
    marginal_relief = tax_after_rebate - (net_taxable_income - 700000)
    tax_after_marginal_relief = tax_after_rebate - marginal_relief
ELSE:
    tax_after_marginal_relief = tax_after_rebate
```

> Apply marginal relief logic similarly at the ₹50L, ₹1Cr, ₹2Cr, ₹5Cr surcharge thresholds.
> 

### 9.5 Deductions NOT available under New Regime

```
UNAVAILABLE:
- HRA exemption (Sec 10(13A))
- LTA exemption (Sec 10(5))
- Children Education/Hostel allowance (Sec 10(14))
- Standard deduction was unavailable until FY 2023-24; NOW AVAILABLE from FY 2024-25 (₹75,000)
- 80C (PF, ELSS, LIC etc.)
- 80D (Medical insurance)
- 80CCD(1B) (NPS self contribution)
- 80TTA / 80TTB (Savings interest)
- 80G (Donations)
- 80E (Education loan interest)
- 80EEA (Home loan)
- Professional Tax deduction under Sec 16(iii) — WAIT: PT is available in both
- Interest on housing loan self-occupied (Sec 24b)

AVAILABLE in New Regime:
- Standard deduction ₹75,000 (from FY 2024-25)
- 80CCD(2) — Employer NPS contribution (up to 10%/14% of basic+DA)
- Professional Tax (Sec 16(iii)) — deductible in both regimes
- Gratuity exemption (Sec 10(10)) on retirement
- Leave encashment on retirement (Sec 10(10AA))
```

---

## 10. Cess & Surcharge

### Cess (Both Regimes)

```
health_education_cess = 4% × annual_tax_after_rebate
```

> Applied AFTER rebate but BEFORE surcharge. (In practice, usually computed as: total_tax_after_rebate × 1.04)
> 

### Surcharge (Both Regimes)

| Net Taxable Income | Surcharge Rate |
| --- | --- |
| Up to ₹50,00,000 | Nil |
| ₹50,00,001 – ₹1,00,00,000 | 10% |
| ₹1,00,00,001 – ₹2,00,00,000 | 15% |
| ₹2,00,00,001 – ₹5,00,00,000 | 25% |
| Above ₹5,00,00,000 | 25% (New Regime) / 37% (Old Regime) |

> Surcharge cap at 25% for New Regime (reduced from 37% in FY 2023-24 onwards for NR).
> 

### Marginal Relief on Surcharge

```
// Ensures that tax increase due to crossing surcharge slab is not more than income increase

IF surcharge_applies:
    tax_without_surcharge = compute at surcharge threshold
    tax_with_surcharge = normal computation
    excess_tax = tax_with_surcharge - tax_without_surcharge
    excess_income = net_taxable_income - surcharge_threshold
    IF excess_tax > excess_income:
        surcharge_relief = excess_tax - excess_income
        effective_surcharge = surcharge - surcharge_relief
```

### Final Tax Computation

```
annual_tax_liability = (tax_after_rebate + surcharge_after_marginal_relief) × 1.04
```

---

## 11. Monthly TDS Computation (Section 192)

This is the **core of the payroll tax engine**. TDS must be recalculated every month because:
- Salary structure may change mid-year (hike, promotion)
- Employee may submit/update declarations mid-year
- Bonus/one-time payments spike projected income
- LOP affects actual gross

### 11.1 Full Algorithm

```python
def compute_monthly_tds(employee, payroll_month, payroll_year):

    # Step 1: Compute Year-to-Date actuals
    ytd_actual_gross = sum(
        payroll_transactions.gross_salary
        where employee_id = employee.id
        and fy_start <= pay_date <= current_pay_date
    )
    ytd_tds_deducted = sum(
        payroll_transactions.tds_deducted
        where employee_id = employee.id
        and fy_start <= pay_date < current_pay_date
    )
    ytd_pt_paid = sum(payroll_transactions.pt_deducted for same period)

    # Step 2: Project remaining months at current structure
    current_monthly_gross = compute_gross_for_current_month(employee)
    fy_month = compute_fy_month(payroll_month, payroll_year)  # April = 1
    months_elapsed = fy_month - 1
    remaining_months = 12 - months_elapsed

    projected_gross_remaining = current_monthly_gross × remaining_months
    projected_annual_gross = ytd_actual_gross + projected_gross_remaining

    # Step 3: Compute annual exemptions (Old Regime only)
    if employee.regime == 'OLD':
        hra_exempt_annual = compute_hra_exemption_annual(employee, projected_annual_gross)
        lta_exempt_annual = compute_lta_exemption(employee)
        other_exemptions = compute_other_exemptions(employee)
        total_exemptions = hra_exempt_annual + lta_exempt_annual + other_exemptions
    else:
        total_exemptions = 0

    # Step 4: Taxable salary
    taxable_salary = projected_annual_gross - total_exemptions

    # Step 5: Standard deduction
    std_deduction = 75000 if employee.regime == 'NEW' else 50000
    taxable_after_std = taxable_salary - std_deduction

    # Step 6: Chapter VI-A (Old Regime only) + 80CCD(2) (Both)
    if employee.regime == 'OLD':
        sec80C = min(employee.declared_80C + employee.pf_contribution_annual, 150000)
        sec80CCD_1B = min(employee.declared_nps_self, 50000)
        sec80D = compute_80D(employee)
        other_via = compute_other_via(employee)
        chapter_via = sec80C + sec80CCD_1B + sec80D + other_via
    else:
        chapter_via = 0

    employer_nps_limit = 0.10 × (employee.basic_annual + employee.da_annual)
    sec80CCD_2 = min(employee.employer_nps_contribution_annual, employer_nps_limit)

    # Step 7: PT deduction (both regimes)
    projected_pt_annual = ytd_pt_paid + (compute_monthly_pt(employee) × remaining_months)

    # Step 8: Net taxable income
    net_taxable_income = max(0,
        taxable_after_std - chapter_via - sec80CCD_2 - projected_pt_annual
    )

    # Step 9: Compute annual tax
    if employee.regime == 'NEW':
        annual_tax = compute_tax_new_regime(net_taxable_income)
        annual_tax = apply_87A_rebate_new(annual_tax, net_taxable_income)
        annual_tax = apply_marginal_relief(annual_tax, net_taxable_income)
    else:
        annual_tax = compute_tax_old_regime(net_taxable_income, employee.age)
        annual_tax = apply_87A_rebate_old(annual_tax, net_taxable_income)

    # Step 10: Surcharge & cess
    surcharge = compute_surcharge(net_taxable_income, annual_tax, employee.regime)
    annual_tax_liability = (annual_tax + surcharge) × 1.04

    # Step 11: Monthly TDS
    tax_balance = max(0, annual_tax_liability - ytd_tds_deducted)
    monthly_tds = round(tax_balance / remaining_months)  # Round to nearest rupee

    return monthly_tds
```

### 11.2 Handling Bonus / One-time Payments

Bonus spikes the projected income, which spikes the TDS for that month (and subsequent months):

```
projected_annual_gross already includes this month's gross (with bonus)
∴ TDS in bonus month = (revised annual tax liability - tds paid so far) / remaining months

If this results in very high TDS in one month, it is correct behaviour per Sec 192.
Optionally: allow employer to spread the TDS over remaining months (already done by the algorithm).
```

### 11.3 Mid-year Salary Revision

```
Month of hike: compute_gross_for_current_month returns new salary
projected_gross_remaining = new_monthly_gross × remaining_months
Algorithm auto-adjusts; arrears if paid in a lump sum are added to current month's gross
```

### 11.4 TDS When Tax = 0

```
IF annual_tax_liability <= 0:
    monthly_tds = 0
    // Do not deduct any TDS; issue Form 16 with 0 tax
```

---

## 12. Regime Comparison & Selection Logic

### 12.1 When to Recommend New Regime

New Regime is generally better when:
- Employee has minimal investments (low 80C utilisation)
- No home loan
- Not paying HRA (lives in own house or employer-provided accommodation)
- Income < ₹7L (effective zero tax)

### 12.2 Break-even Analysis (for UI hint to employee)

```python
def suggest_regime(employee):
    old_tax = compute_annual_tax_old_regime(employee)
    new_tax = compute_annual_tax_new_regime(employee)

    saving = old_tax - new_tax  # positive means Old is costlier → New is better

    return {
        "recommended": "NEW" if new_tax <= old_tax else "OLD",
        "new_regime_tax": new_tax,
        "old_regime_tax": old_tax,
        "saving_with_recommended": abs(saving)
    }
```

> Show this comparison to the employee on the declaration portal. Let them choose. **Lock the choice for the FY** once confirmed.
> 

### 12.3 Key threshold: Old Regime becomes better when

```
// Approximate break-even deductions needed for Old Regime to win
// (This varies; compute dynamically; below is indicative for FY 2024-25)

For income 7-10L:  Old Regime wins if total deductions > ~₹2.5L to ₹3.5L
For income 10-15L: Old Regime wins if total deductions > ~₹3.75L
For income > 15L:  Old Regime wins if total deductions > ~₹4.25L+

// Exact figures must be computed by regime_comparison function above
```

---

## 13. Edge Cases & Special Conditions

### 13.1 New Joinee Mid-Year

```
// Employee joins in October (FY month 7)
remaining_months_in_fy = 6
projected_annual_gross = actual_joining_month_gross × 6
// No YTD actuals before joining date
ytd_actual_gross = 0
ytd_tds_deducted = 0

// Important: ask for Form 12B from previous employer
// Previous employer's TDS must be considered in annual tax computation
// Add previous_employer_gross and previous_employer_tds to YTD totals
```

**Form 12B fields to capture:**

```json
{
  "previous_employer_name": "ABC Corp",
  "previous_employer_tan": "MUMA12345A",
  "previous_gross_salary": 450000,
  "previous_tds_deducted": 15000,
  "previous_pt_paid": 1800,
  "previous_pf_paid": 21600
}
```

### 13.2 Employee Leaving Mid-Year

```
// Final month TDS = remaining tax liability in full
// Do not spread over "remaining months" since there are none after this month

final_month_tds = max(0, annual_tax_liability - ytd_tds_deducted)
// Generate Form 16 Part A immediately after full & final settlement
```

### 13.3 Negative Tax Scenario (Refund)

```
// If YTD TDS > annual_tax_liability (over-deducted in earlier months)
IF ytd_tds_deducted > annual_tax_liability:
    monthly_tds = 0  // Stop deducting for remaining months
    // Employee will claim refund when filing ITR
    // Employer cannot refund TDS directly; only ITR refund route
```

### 13.4 ESI – Threshold Crossing

```
// If employee's gross was ≤ ₹21,000 in April → covered under ESI
// Even if gross crosses ₹21,000 in subsequent months, ESI continues
// till end of that contribution period (Oct-March or April-Sept)

ESI_CONTRIBUTION_PERIOD_1: April to September
ESI_CONTRIBUTION_PERIOD_2: October to March

IF employee_covered_at_start_of_period:
    deduct ESI for entire period regardless of salary increase
    employee_rate = 0.75% of gross
    employer_rate = 3.25% of gross

IF employee_not_covered_at_start_of_period:
    NO ESI even if salary dips below ₹21,000 mid-period
```

### 13.5 PF – Ceiling Rule

```
pf_basis = basic + DA  // DA is added to PF basis if bifurcated

IF pf_basis <= 15000:
    employee_pf = 12% × pf_basis
    employer_epf = 3.67% × pf_basis   // Goes to EPF account
    employer_eps = 8.33% × pf_basis   // Goes to EPS (pension); capped at ₹15,000 basis
ELSE:
    // Employer must contribute on actual; employee can choose ceiling
    IF employee.pf_option == 'CEILING':
        employee_pf = 12% × 15000 = 1800
    ELSE:  // employee.pf_option == 'ACTUAL'
        employee_pf = 12% × pf_basis
    employer_epf = 3.67% × 15000  // Employer EPS always capped at ₹15,000 basis
    employer_eps = 8.33% × 15000  // = ₹1,250
    employer_edli = 0.5% × 15000  // EDLI always on ₹15,000 ceiling
```

### 13.6 Gratuity Provision

```
// Monthly gratuity provisioning (cost to company; not deducted from employee)
monthly_gratuity_provision = (basic + DA) × 15 / 26 / 12

// Gratuity payable on exit (if service >= 5 years):
gratuity_payable = (basic + DA at exit) × 15/26 × years_of_service

// Tax exemption on gratuity (Sec 10(10)):
exempt = MIN(
    actual_gratuity_paid,
    15/26 × last_drawn_basic_da × years_of_service,
    2000000  // ₹20L cap
)
taxable_gratuity = gratuity_paid - exempt
```

---

## 14. Database Schema Notes

### Key Tables Required for Tax Engine

```sql
-- Employee master
CREATE TABLE employees (
    id UUID PRIMARY KEY,
    name TEXT,
    date_of_birth DATE,  -- Age determines senior citizen status
    pan TEXT,
    state TEXT,           -- For PT slab lookup
    city_type TEXT,       -- 'METRO' or 'NON_METRO' for HRA
    pf_option TEXT,       -- 'CEILING' or 'ACTUAL'
    esi_applicable BOOLEAN
);

-- Employee tax declarations (submitted once per FY)
CREATE TABLE employee_tax_declarations (
    id UUID PRIMARY KEY,
    employee_id UUID REFERENCES employees(id),
    financial_year TEXT,       -- e.g. '2024-25'
    regime TEXT,               -- 'OLD' or 'NEW'
    monthly_rent_paid NUMERIC,
    landlord_pan TEXT,
    owns_house_in_city BOOLEAN,
    declared_80C NUMERIC,       -- Total 80C excluding PF (auto-computed)
    declared_nps_self NUMERIC,  -- 80CCD(1B)
    declared_80D_self NUMERIC,
    declared_80D_parent NUMERIC,
    parent_senior_citizen BOOLEAN,
    declared_other_via NUMERIC, -- 80E, 80G, etc.
    lta_claim_amount NUMERIC,
    locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ
);

-- Monthly payroll transactions (one row per employee per month)
CREATE TABLE payroll_transactions (
    id UUID PRIMARY KEY,
    employee_id UUID,
    payroll_month INT,          -- 1-12
    payroll_year INT,
    fy TEXT,                    -- '2024-25'
    gross_salary NUMERIC,
    total_exemptions NUMERIC,   -- HRA + LTA + others
    taxable_salary NUMERIC,
    standard_deduction NUMERIC,
    chapter_via_deduction NUMERIC,
    pt_deducted NUMERIC,
    projected_annual_income NUMERIC,
    annual_tax_liability NUMERIC,
    tds_deducted NUMERIC,
    pf_employee NUMERIC,
    pf_employer NUMERIC,
    esi_employee NUMERIC,
    esi_employer NUMERIC,
    net_pay NUMERIC,
    regime_used TEXT,
    status TEXT                 -- 'DRAFT', 'APPROVED', 'PAID'
);

-- PT slab table
CREATE TABLE state_pt_slabs (
    id UUID PRIMARY KEY,
    state TEXT,
    gross_from NUMERIC,
    gross_to NUMERIC,           -- NULL means 'and above'
    monthly_pt NUMERIC,
    applicable_month INT,       -- NULL means all months; 2 = February (for MH)
    effective_date DATE
);
```

---

## 15. Pseudocode Reference

### Complete Tax Pipeline

```python
# Entry point for each employee each payroll month
def run_tax_engine(employee_id, payroll_month, payroll_year):

    employee = load_employee(employee_id)
    declaration = load_declaration(employee_id, get_fy(payroll_month, payroll_year))
    salary_structure = load_salary_structure(employee_id)

    # Compute gross for this month (post attendance proration)
    monthly_gross = compute_prorated_gross(employee_id, payroll_month, payroll_year)

    # Statutory deductions (not tax; but affect net pay)
    pf_employee = compute_pf_employee(employee, monthly_gross)
    esi_employee = compute_esi_employee(employee, monthly_gross)
    pt_monthly = compute_pt(employee.state, monthly_gross, payroll_month)

    # TDS computation (uses projected annual income)
    monthly_tds = compute_monthly_tds(
        employee, declaration, payroll_month, payroll_year, monthly_gross
    )

    # Net pay
    voluntary_deductions = compute_voluntary_deductions(employee_id, payroll_month)
    net_pay = (monthly_gross
               - pf_employee
               - esi_employee
               - pt_monthly
               - monthly_tds
               - voluntary_deductions)

    # Persist
    save_payroll_transaction(
        employee_id, payroll_month, payroll_year,
        gross=monthly_gross,
        pf_employee=pf_employee,
        esi_employee=esi_employee,
        pt=pt_monthly,
        tds=monthly_tds,
        net_pay=max(net_pay, 0)
    )

    return net_pay
```

---

## Revision History

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | April 2024 | Initial version for FY 2024-25 |
| 1.1 | — | Add New Regime ₹75,000 std deduction per Budget 2024 |
| 1.2 | — | Add marginal relief for New Regime at ₹7L threshold |

---

> **Note for Devs:** All monetary calculations should use `NUMERIC` / `Decimal` types — NOT `float`. Floating point arithmetic causes rounding errors in tax calculations that compound across payroll runs. Round TDS to the nearest rupee at the final step only.
>