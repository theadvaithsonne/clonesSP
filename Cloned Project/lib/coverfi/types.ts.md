# `lib/coverfi/types.ts`

> The shared TypeScript types and enum-like constants for the Coverfi insurance-brokerage module. They mirror the documents returned by the external Coverfi backend.

**Kind:** frontend library · **Lines:** 431

## Purpose
Every Coverfi API module and component imports its data shapes from this file: 44 files in total. The comment at the top says the types were "extended phase-by-phase" as Coverfi grew (corporates are marked "Phase 8 + 9"). The types are hand-written. Nothing generates them from the Coverfi backend, so they must be kept in step with that backend by hand.

## How it works
Almost every entity carries `_id`, `brokerageId`, `orgId`, `createdAt` and `updatedAt`. Those fields scope each record to one brokerage inside one Garage organisation. Most entities also have `is_active`. Wizard-created entities track progress in `step_completed`.

### Platform and brokerage (L3-L88)
- `CoverfiHealth` - `{ ok, orgId, brokerageId, phase }`, the response of `GET /v1/coverfi/health`. The dashboard page uses it to check that the backend is reachable and to show the current phase.
- `Brokerage` - the broker's own record, in groups: profile (legal name, address, country, state, pincode, business email, phone and website, description); branding (`tag_line`, `business_logo`, `business_icon`, `primary_color`, `secondary_color`); and landing page (`heading`, `bullet_points`, `cover_pic`, `landing_published`, `landing_published_at`).
- `BrokerageLocation` - a branch: name, address, country, state, pincode.
- `Stakeholder` - a Garage user who belongs to the brokerage org with `role: "stakeholder"`. It has `email`, `name`, `profilePicture`, `fullAccess` and `joinedAt`, plus an `assignment` of `{ role_id?, branch_id? }` or `null`. Membership is managed by Garage's invite flow; Coverfi only stores the assignment.
- `CoverfiRole` - a display-only role label, not a Garage permission role.

### Catalogue (L90-L171)
- `InsuranceCompany` - an insurer: name, description, website, country, a `product_type[]` list, logo and icon.
- `ProductCategory`, `FilterType`, `FilterItem` - the taxonomy used to classify products. A `FilterItem` belongs to a type through `filter_type_id`.
- Constant tuples and the types derived from them:
  - `BILLING_TYPES` = `"Fixed Pricing" | "Variable Pricing"`;
  - `PAYMENT_FREQUENCIES` = `"Monthly" | "Quarterly" | "Annually"`;
  - `WAIVER_TYPES` = `"On Selection" | "On Submission" | "No Waiver"`;
  - the matching types are `BillingType`, `PaymentFrequency` and `WaiverType`.
- `Product` - most fields are optional because the product is built across a five-step wizard: `name`, `description`, `type`, `category`, `insurance_provider`, `filters[]` (filter item ids), `logo`, `product_document`, billing, payment and waiver fields, `waiver_text`, `waiver_terms[]`, `coverage_type`, `coverage[]`, and `step_completed`.

### Companies (L173-L228)
- `CompanyEnrolledProduct` - `{ productId, enrolled_at, notes? }`.
- `Company` - a client business. It has legal and display names, industry, one optional `poc` object, logo, a split address (`street_number`, `street_name`, `city`, `state`, `country`, `pincode`), `enrolled_products[]`, `step_completed` and an optional `employee_count`.
- `CompanyEmployee` - a plain employee record (not a Garage user). It has identity and job fields, birth and joining dates, `enrolled_products[]`, and a list of inline `dependents` (`name`, `relation`, `dob`).

### Communication (L230-L281)
- `SENDER_VERIFICATION_STATUSES` (`unverified | pending | verified | failed`) and the derived `SenderVerificationStatus`.
- `EmailSender` - nickname, from name and email, reply-to, an optional postal address, `verification_status` and `provider`.
- `EmailTemplate` - `trigger_event_name`, subject, content, `variables[]` and `is_active`.
- `TEMPLATE_TRIGGER_PRESETS` - the event names the template editor suggests: `welcome`, `policy_created`, `policy_renewal_reminder`, `claim_filed`, `claim_settled`, `quote_ready`.

### Settings (L283-L305)
- `OfficeLocation` - name, `full_address`, city, state, country, pincode.
- `PolicySettingsDoc` - one document per brokerage holding an open `settings: Record<string, unknown>`.

### Corporates (L307-L425)
- `CorporatePoc` - a point of contact with a `designation`.
- `Corporate` - the fuller client model. It has an optional `corporate_code`, a required `legal_name` and `admin_email`, admin name and phone fields, a `poc[]` array, the split address, a `status` of `"active" | "inactive"` alongside `is_active`, and `step_completed`. On the detail view it also has `employee_count`, `dependent_count` and `active_policy_count`.
- `CorporateEmployeeStatus` - `"invited" | "active" | "suspended"`.
- `CorporateEmployee` - linked to a Garage user through `userId`, with a required `email`, `gender`, `is_admin` and `status`.
- `DEPENDENT_RELATIONS` (`spouse | child | parent | sibling | other`) and `DependentRelation`.
- `CorporateDependent` - belongs to a corporate and an employee, with `relation`, `date_of_birth` and `gender`.
- `PRODUCT_MAPPING_STATUS` (`active | expired | cancelled`) and `ProductMappingStatus`.
- `CorporateProductMapping` - links a corporate to a product. Either `covers_all_employees` is set, or `employeeIds[]` lists who is covered. It also has `dependents_covered`, the policy number and start and end dates, `status`, `notes` and `enrolled_at`.

### Envelope (L427-L430)
- `ApiResult<T>` - `{ success: boolean; data: T }`, the wrapper every Coverfi endpoint returns. The API modules unwrap `.data`.

## Exports
**Interfaces:** `CoverfiHealth`, `Brokerage`, `BrokerageLocation`, `Stakeholder`, `CoverfiRole`, `InsuranceCompany`, `ProductCategory`, `FilterType`, `FilterItem`, `Product`, `CompanyEnrolledProduct`, `Company`, `CompanyEmployee`, `EmailSender`, `EmailTemplate`, `OfficeLocation`, `PolicySettingsDoc`, `CorporatePoc`, `Corporate`, `CorporateEmployee`, `CorporateDependent`, `CorporateProductMapping`, `ApiResult<T>`.

**Type aliases:** `BillingType`, `PaymentFrequency`, `WaiverType`, `SenderVerificationStatus`, `CorporateEmployeeStatus`, `DependentRelation`, `ProductMappingStatus`.

**Runtime constants (readonly tuples):** `BILLING_TYPES`, `PAYMENT_FREQUENCIES`, `WAIVER_TYPES`, `SENDER_VERIFICATION_STATUSES`, `TEMPLATE_TRIGGER_PRESETS`, `DEPENDENT_RELATIONS`, `PRODUCT_MAPPING_STATUS`. Forms use these to populate select options.

## Dependencies
None.

## Used by
`app/(dashboard)/coverfi/page.tsx`, every `lib/coverfi/*-api.ts` module, and the components under `components/coverfi/` (brokerage, communication, companies, corporate, insurance, products, roles, office-locations, policy-settings, among others). 44 importers in total (the first 25 are listed).

## Notes
- Companies and corporates are two separate client models that both exist. Company employees are standalone records with inline dependents. Corporate employees are Garage users, and their dependents are separate documents. Check which model a screen uses before you change either one.
- `Brokerage.pincode`, `Company.pincode`, `Corporate.pincode` and `OfficeLocation.pincode` are typed as `number`. Postal codes with leading zeros or letters will not survive a numeric field.
- Dates are ISO strings. These are types only and nothing validates them at runtime.
