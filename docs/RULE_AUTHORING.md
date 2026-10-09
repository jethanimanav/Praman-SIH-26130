# ROP — Rule Authoring Guide

This guide explains how to write regulatory rules for the ROP engine.

> **Important**: Never invent regulatory facts. All rules must be DEMO,
> VERIFICATION_REQUIRED, or VERIFIED with source metadata.

---

## Rule File Location

```
backend/data/rules/
├── central/           # Central government approvals
├── state/             # State government approvals
└── demo/              # Demo rules for Scenario C
```

## Rule Format (YAML)

```yaml
# Rule file example
rules:
  - id: RULE-001
    name: "Factory Registration"
    description: "Registration under the Factories Act (DEMO)"
    data_status: DEMO
    # source_url, source_title, source_date, reviewed_by required if VERIFIED

    # When does this rule apply?
    applies_when:
      - field: sector
        operator: in
        values: [manufacturing, processing]
      # Add more conditions with AND logic

    # What does the applicant need?
    requirement:
      category: required   # required | conditional | not_applicable
      documents:
        - "Application form"
        - "Site plan"
      department: DEMO Department
      estimated_timeline_days: 30  # DEMO value

    # Dependencies (rule IDs that must be completed first)
    depends_on: []

    # Why this applies (shown to applicant)
    explanation: >
      Manufacturing facilities typically require registration.
      [DEMO — verify against applicable Acts]
```

## Data Status Rules

- Default: `DEMO`
- `VERIFIED` requires ALL of:
  - `source_url`
  - `source_title`
  - `source_date`
  - `reviewed_by`
- Tests will reject incomplete VERIFIED records.

## Condition Operators

| Operator | Meaning |
|---|---|
| equals | Exact match |
| in | Value is in list |
| contains | String contains |
| greater_than | Numeric > |
| less_than | Numeric < |
| is_true | Boolean true |
| is_false | Boolean false |
| not_null | Field exists and is not null |

## Unknown Handling

If a required field for rule evaluation is unknown:
→ Category must be `verification_required`
→ Explanation must say what information is needed

Never assume a value. Unknown stays unknown.
