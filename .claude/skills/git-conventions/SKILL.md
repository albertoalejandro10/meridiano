---
name: git-conventions
description: Git rules for BetoTracker. Use before any commit, push, or other git write operation.
---

# Git Conventions

- **NEVER commit automatically.** The owner reviews every change before it is committed. Finish the work, summarize what changed, and wait — only commit when explicitly asked in that same request.
- No pushes, branches, or history rewrites unless explicitly requested.
- When asked to commit: conventional-commit style subject (`feat:`, `fix:`, `chore:`, …), concise body listing the real changes.
- Never commit `.env` or `server/generated/` (both gitignored — keep it that way).
