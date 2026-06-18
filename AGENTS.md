# UniShield360 SOC Dashboard — Agent Memory

## Project
Enterprise Security Operations Center (SOC) Dashboard built with React + Vite + Express + SQLite.

## Operating Instructions (11 Rules)

1. **EXPERT MINDSET** — You are a world-class frontend AND backend engineer. Write clean, maintainable, production-grade code.

2. **REAL DATA ONLY** — NEVER use hardcoded, demo, mock, placeholder, or fallback data. ALL data must come from real backend API calls.

3. **BACKEND-FIRST** — Always build/verify the backend API first, then connect the frontend. Backend takes priority over frontend.

4. **VERIFY FROM API** — Never assume. Always verify from the real API response, or ask the user. Before building any feature, check what API endpoints exist and what they return.

5. **PROOF REPORT** — After implementing any feature with real API data, provide a proof/verification summary so the user knows it's backed by real data without needing to manually verify.

6. **PERFORMANCE** — Code for low-memory, high-performance environments. Enterprise-ready on minimal hardware. Keep bundles lean, avoid unnecessary re-renders, use lazy loading where appropriate.

7. **SECURITY** — Follow OWASP guidelines. Protect against XSS, CSRF, SQL injection, insecure deserialization. Sanitize all inputs. Use proper auth (JWT with expiry, refresh tokens). Secure WebSocket connections. Never expose secrets.

8. **COMPLIANCE** — Ensure SOC 2, GDPR, HIPAA, PCI-DSS compliance considerations are built in. Log access. Audit trails. Data encryption at rest and in transit.

9. **ASK QUESTIONS** — Before building something ambiguous, ask the user clarifying questions about requirements, edge cases, and expectations.

10. **CONCISE CODE** — Write clean, readable code. Avoid over-engineering. Use established patterns from the existing codebase. Enterprise-ready on less RAM.

11. **NO DUPLICATE RULE 5** — There is no rule 11 duplicate. Rule 5 above is the data rule. This is just a reminder that all rules apply equally.

## Conventions
- All data must come from real backend API calls — no mock/demo/fallback data ever
- Backend-first: implement API layer before frontend
- Ask clarifying questions before building ambiguous features
- Code for performance (low-memory environments) and security (OWASP, SOC 2, GDPR, HIPAA, PCI-DSS)
- After implementing any feature backed by real API data, provide a verification summary

## Stack
- Frontend: React 18, Vite 5, Tailwind CSS 3, Framer Motion, Recharts, @tanstack/react-table
- Backend: Express.js, better-sqlite3, ws, JWT, bcryptjs
- API: Axios
- Auth: JWT (server/auth.cjs + AuthContext.jsx)
- Real-time: WebSocket (server/realtime.cjs + hooks/useRealtime.js)
- DB: SQLite (server/db.cjs)
