---
name: codex-project-bootstrap
description: Bootstrap a new Codex project with a lightweight collaboration contract and task board. Use when starting a new project, resetting a workspace, or when the user wants Codex to generate and maintain COLLAB.md and TASKS.md as the shared source of truth.
---

# Codex Project Bootstrap

Use this skill when the user wants a new project to start with a docs-driven workflow and minimal coordination overhead.

## Goal

Create and maintain two markdown files at the project root:

- `COLLAB.md`: stable collaboration rules
- `TASKS.md`: the active task board and status tracker

Default to this lightweight setup. Do not add heavier planning artifacts unless the user asks for them.

## When to Use

- Starting a new Codex project
- Reopening an existing workspace that has no coordination docs
- The user wants separate threads to share state without relying on chat history
- The user wants tasks to move through `Planned -> In Progress -> Ready for Review -> Done`

## Workflow

1. Identify the project root.
2. If `COLLAB.md` or `TASKS.md` is missing, create them.
3. If they already exist, update them instead of replacing them wholesale.
4. Keep one active task at a time unless the user explicitly wants parallel work.
5. Move task state forward only when the previous step is complete.

## File Rules

### `COLLAB.md`
Keep this file stable. It should define:

- project goal
- working rules
- scope boundaries
- acceptance expectations
- output expectations
- state flow for task handoff
- writing style expectations for project docs when useful

### `TASKS.md`
Keep this file current. It should define:

- current task
- task status
- owner/thread if useful
- scope
- acceptance criteria
- notes
- done/history

## Status Flow

Use this status sequence:

- `Planned`
- `In Progress`
- `Ready for Review`
- `Done`

Only one task should normally be `In Progress`.

## Output Behavior

When asked to bootstrap a project:

- create the two files if missing
- fill them with concise starter content
- leave placeholders for unknowns instead of inventing details
- ask for only the missing project details that block progress

## Writing Style

When this skill creates or updates project coordination docs, prefer practical business language over code-shaped language.

- use business names first, not variable names or field ids, unless the user explicitly asks for implementation detail
- make logic notes easy to scan: current business reality -> current system handling -> known limitation -> expected later expansion
- avoid abstract "AI summary" phrasing; write in direct product or operations language
- if a rule is temporary or incomplete, say that plainly instead of implying the logic is already closed
- when a business scenario is known to be the real-world default, describe it as current reality, not as an edge case

## Script

If reliability matters, use `scripts/bootstrap-project-docs.ps1` to generate the files in a target directory.
