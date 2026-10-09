# ROP — Human TODO

This file tracks tasks that only the human developer can complete.
Agents must not guess or invent these values.

---

## Regulatory Data (VERIFICATION_REQUIRED)

The following require research from official government sources:

- [ ] List of approvals applicable to automotive component manufacturing
- [ ] Actual SLA values from official government notifications
- [ ] Approval dependencies (which approvals must precede others)
- [ ] Escalation authorities for each department
- [ ] Grievance routing rules
- [ ] List of applicable central/state schemes for manufacturing
- [ ] Legal validity periods for licenses and renewals
- [ ] Holiday calendar for SLA calculation

## Government API Information (CONFIGURATION_REQUIRED)

- [ ] MAITRI API documentation (if available)
- [ ] NSWS API documentation (if available)
- [ ] Any state-specific portal API docs
- [ ] API credentials (if available)

## SIH Event Requirements

- [ ] SIH 2026 event date
- [ ] Required submission format
- [ ] Evaluation criteria for PS-26130
- [ ] Whether a video demo is required

## Verified Sources to Add

When adding VERIFIED regulatory data, provide:
- Official Act/Rule name and number
- Relevant section/rule number
- Source URL (government portal)
- Date accessed
- Your name (as reviewed_by)

## Environment Setup

- [ ] Generate a strong SECRET_KEY for .env (run: python -c "import secrets; print(secrets.token_hex(32))")
- [ ] Set GEMINI_API_KEY if Gemini AI features are desired (optional)
- [ ] Change DEMO_USER_PASSWORD before any public demo
