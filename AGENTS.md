# Development Guidelines

These rules apply to ALL code written in this project.

## Security
- Never hardcode secrets, API keys, or credentials. Use environment variables (.env).
- Validate and sanitize all user/API inputs.
- Avoid dangerous patterns like `eval()`, innerHTML with unsanitized data, or raw SQL concatenation.
- Use parameterized queries or ORM-safe patterns for database access.
- Follow OWASP top 10 guidelines (XSS, CSRF, injection prevention).

## Scalability
- Make environment-specific configuration injectable via env vars (e.g., API base URLs, feature flags, index names).
- Avoid hardcoded domain-specific values (URLs, ports, region-specific constants).
- Use dependency injection or context for cross-cutting concerns (auth, config).
- Components should be self-contained and reusable; avoid implicit coupling.

## Performance
- Use `useMemo` / `useCallback` / `React.memo` to avoid unnecessary re-renders.
- Memoize expensive computations (filtered lists, derived data).
- Use lazy loading (`React.lazy`, dynamic imports) for route-level code splitting.
- Avoid inline function/object creation in JSX props where it causes cascading re-renders.
- Use `useRef` for intervals/timeouts to avoid stale closures.
- Batch state updates where possible.
- Prefer native Array methods over libraries for simple operations.
- Avoid re-filtering/re-mapping the same data multiple times — derive once.
- Use efficient data structures (Set for lookups, Map for keyed access).
