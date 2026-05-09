# Architecture

## Client

The React client is organized around a single dashboard flow:

- Hero and ShowUpToday availability prompt
- Match cards
- Group detail with captain, members, venues and chat
- Profile creation form
- Manual event creation
- Events and gamification panel

## API

The Express API exposes:

- `GET /api/bootstrap` initial state
- `POST /api/profiles` profile creation
- `PATCH /api/profiles/:id/availability` availability updates
- `POST /api/ai/infer-sports` prototype AI sport inference
- `POST /api/matches/generate` automatic matching
- `PATCH /api/groups/:id/confirm` match confirmation
- `GET /api/groups/:id/messages` chat read
- `POST /api/groups/:id/messages` chat send
- `GET /api/venues` venue suggestions
- `POST /api/events` manual event creation

## Matching model

Compatibility combines:

- Availability score: prioritizes users who answered Yes
- Sport preference score: shared interest in selected sport
- Proximity score: favors tighter geographic clusters
- Group-size constraints: sport-specific minimum, ideal and maximum sizes

## Security and quality notes

The backend uses Helmet, CORS, JSON payload limits and Zod validation. For production, add persistent storage, authentication, rate limiting, audit logging and file upload scanning.
