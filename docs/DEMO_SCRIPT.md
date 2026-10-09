# ROP — Demo Script

**Scenario C**: Automotive component manufacturing in an industrial area.

> All regulatory claims in this demo are DEMO status.

---

## Pre-Demo Setup

1. Start backend: `cd backend && uvicorn app.main:app --reload`
2. Start frontend: `cd frontend && npm run dev`
3. Open browser: http://localhost:3000
4. Use Demo Control Panel to load Scenario C (available M5+)

---

## Demo Flow

### Step 1: Login
- Open http://localhost:3000
- Login as `applicant@demo.rop` / `Demo@12345`
- Show: role-specific dashboard

### Step 2: Start Project (M2+)
- Click "New Project"
- Enter business name: "Precision Auto Components Pvt Ltd"

### Step 3: Describe Business (M2+)
- Enter natural language description:
  > "We manufacture precision metal parts for the automotive industry.
  > The facility is in an industrial zone and will use electroplating and
  > metal fabrication. We expect significant power consumption and will
  > generate effluent requiring treatment."
- Show: AI extracts structured profile

### Step 4: AI Profile (M2+)
- Show extracted fields: sector, activity, district, effluent, power demand
- Show: confidence scores
- User confirms or corrects

### Step 5: Adaptive Questions (M2+)
- System asks 3–7 targeted questions
- Answers change regulatory outcomes

### Step 6: Regulatory Assessment (M1+)
- System returns: Required | Conditional | Not Applicable
- Each requirement shows: reason, rule ID, data status badge (DEMO)

### Step 7: Checklist (M3+)
- Structured checklist of documents and forms
- Each item shows source and data status

### Step 8: Dependency Graph (M3+)
- React Flow visual graph
- Nodes coloured by status
- Edges show dependencies
- Parallel groups highlighted

### Step 9: Parallel Workflow (M4+)
- Show which approvals can proceed simultaneously
- Show critical path

### Step 10: Sandbox Submission (M5+)
- Click Submit (sandbox/demo mode)
- System returns DEMO reference: DEMO-REF-0001
- Badge: SANDBOX

### Step 11: SLA Monitoring (M5+)
- Show SLA countdown per approval
- Status: ON_TRACK

### Step 12: Simulated Delay (M5+)
- Admin panel: Advance clock +30 days
- Show: APPROACHING deadline
- Advance clock +15 more days
- Show: OVERDUE

### Step 13: Escalation (M6+)
- System triggers escalation automatically
- Show: escalation event in audit trail

### Step 14: Grievance (M6+)
- Applicant files grievance
- Show: grievance tracking

### Step 15: Officer Dashboard (M6+)
- Login as `officer@demo.rop` / `Demo@12345`
- Show: assigned applications, overdue, clarification queue

### Step 16: Resolution (M6+)
- Officer updates status
- Records decision
- Application resolved

### Step 17: Final Dashboard
- Login as `admin@demo.rop` / `Demo@12345`
- Show: admin dashboard, audit trail, data integrity panel

---

## Key Messages

- "Tell us about your business once."
- "We determine what needs to happen and why."
- "We show what can proceed in parallel."
- "We monitor configured timelines."
- "Existing government systems remain authoritative."

---

*This script will be updated as each milestone is completed.*
