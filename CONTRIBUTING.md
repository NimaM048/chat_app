# Contributing to Chat App

Thank you for your interest in contributing. This project follows production-oriented practices—please read this guide before opening a pull request.

## Getting Started

### Prerequisites

- Node.js **22** (see `.nvmrc`)
- npm **10+**
- Optional: Docker Desktop for the full stack

### Setup

```bash
git clone https://github.com/NimaM048/chat_app.git
cd chat_app
npm install
cp .env.example apps/api/.env
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:3000/api/v1
- Swagger: http://localhost:3000/api/docs

### Running Tests

```bash
npm run test          # API (Jest) + Web (Vitest)
npm run test:api
npm run test:web
npm run test:e2e      # Playwright (requires web dev server)
npm run build
```

## Development Workflow

1. Fork the repository and create a feature branch from `main`
2. Make focused changes with clear commit messages
3. Run lint, tests, and build locally
4. Open a pull request using the provided template

### Branch Naming

- `feat/short-description`
- `fix/short-description`
- `docs/short-description`
- `chore/short-description`

### Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(chat): add message reactions
fix(auth): handle expired refresh tokens
docs(readme): update Docker instructions
test(api): cover rate limit edge cases
```

## Code Standards

- Match existing patterns in `apps/api` (NestJS) and `apps/web` (React)
- Keep changes minimal and scoped to the task
- Add or update tests for behavior changes
- Never commit secrets, `.env` files, or user uploads
- Run formatters/linters before pushing:
  - API: `npm run lint -w @chat-app/api`
  - Web: `npm run lint -w @chat-app/web`

## Pull Request Checklist

- [ ] Tests pass locally (`npm run test`)
- [ ] Build succeeds (`npm run build`)
- [ ] No secrets or environment-specific files included
- [ ] README or docs updated if behavior or setup changed
- [ ] PR description explains **why**, not just **what**

## Project Structure

```text
apps/api/     NestJS backend, Prisma, Socket.IO
apps/web/     React + Vite frontend
docker/       Nginx reverse proxy config
docs/         Architecture specs and inventories
```

## Questions?

Open a [GitHub Discussion](https://github.com/NimaM048/chat_app/discussions) or an issue with the `question` label.
