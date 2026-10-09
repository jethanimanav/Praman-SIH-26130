# ROP — Privacy Notes

## Data Collected

In the prototype, the following data is stored in the local SQLite database:

- User accounts (email, full name, hashed password)
- Business profiles (created by the user)
- Audit logs (actions, timestamps)
- Application data

## No External Data Transmission

In the default offline configuration:
- No data is transmitted outside the local machine.
- No analytics, telemetry, or tracking.
- No external APIs are called (all government integrations are mock).

## If Gemini Is Enabled

If the user configures a Gemini API key:
- Business description text will be sent to Google Gemini API.
- No government documents or personal identity documents are sent.
- The user must review Google's terms of service and privacy policy.

## Demo Data

Demo accounts use synthetic names and email addresses.
Do not enter real personal or business information into this prototype.

## Production Considerations

For any production deployment:
- Replace SQLite with a production database.
- Implement proper data retention policies.
- Conduct a privacy impact assessment.
- Comply with applicable data protection laws.

---
*Last updated: 2026-10-04*
