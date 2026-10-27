You are working on Paradox

Follow these rules : 

1. Do not change folder structture 
2. Do work Evnironment variable driven
3. Do not push .env file 
4. Do not access .env file 
5. Do not hardcode anything
6. Ask for permission wherever required
7. Before starting any work give me a call "Roger That" 
    and when the work is done give me call "Over n Out"
8. Whenever i say "bye" you have to commit and push everything and update progress file and technical file 
    and also store everything from that session to your own repo memory and after its done say "Signing off".
9. Whenever i say "hi" you have to read and analyze progress and technical files as well as your own repo memory.

## Additional Project Rules

### Code Quality
- Do not hardcode values that should come from configuration, constants, environment variables, or the Design System.
- Do not use inline styling. Use the project's styling system, reusable classes, or shared components.
- Do not duplicate constants, configuration, validation rules, or UI values unnecessarily.
- Prefer reusable components and utilities over repeated code.
- Keep functions and components focused and reasonably small.
- Do not add unnecessary dependencies.

### Architecture
- Follow the existing project architecture and folder structure.
- Keep API routes/controllers thin. Business logic belongs in services.
- Database access belongs in repositories.
- Do not bypass the defined architecture without a clear reason.
- Keep frontend API communication inside the defined API/service layer.

### Database
- Use PostgreSQL as defined by the SRS.
- Use Alembic for all schema changes.
- Do not modify the database schema manually.
- Do not use floating-point arithmetic for monetary values.
- Seed only the data explicitly defined as required by the SRS.
- Seed data must be handled through migrations and must be safe to run without creating duplicates.
- Do not add fake, demo, or placeholder financial data unless explicitly requested.

### Validation & API
- Validate important data on both frontend and backend.
- Backend validation is authoritative.
- Follow the API contracts, status codes, and error format defined in the SRS.
- Do not invent undocumented endpoints, parameters, or response formats.
- Do not silently change existing API behavior.

### UI/UX
- Follow the Design System for colors, typography, spacing, components, responsive behavior, and other visual decisions.
- Do not create one-off styles when an existing Design System value or component can be reused.
- Do not use inline styles.
- Keep UI consistent across all screens.
- Implement loading, empty, validation-error, and system-error states where required.
- Make the application responsive across mobile, tablet, and desktop.
- Use animations and micro-interactions only when they improve usability or feedback.
- Respect accessibility requirements and reduced-motion preferences.

### Security
- Never hardcode secrets, credentials, API keys, or database passwords.
- Never commit `.env`, `.env.local`, or other files containing real secrets.
- Keep `.env.example` updated with required variables and placeholder values only.
- Do not expose internal errors, stack traces, credentials, or sensitive configuration to users.

### Testing
- Add tests for important business logic and critical user flows.
- Test validation and important edge cases, not only the happy path.
- Do not consider a feature complete when required tests are missing.

### Scope & Changes
- V1 must follow the approved PRD and SRS scope.
- Do not implement future-phase features "just in case."
- Do not introduce unnecessary complexity.
- Do not change the existing architecture, folder structure, API, database design, or project rules without a clear requirement.
- Do not remove or modify existing project rules unless explicitly instructed.
- Before making a significant change, verify it against the PRD, SRS, and Design System.