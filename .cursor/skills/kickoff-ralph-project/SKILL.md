---
name: kickoff-ralph-project
description: >-
  Use this skill when the user wants to start a new Ralph project, define requirements, or create initial specs. It guides the user through the Phase 1 kickoff questionnaire and generates AUDIENCE_JTBD.md and specs/*.md.
---
# Kickoff Ralph Project

When the user asks to start a new Ralph project or define requirements, follow these steps:

1. **Interview the User:** Use the `AskUserQuestion` tool (or just ask in chat) to gather the following information based on the `PROJECT_KICKOFF.md` template:
   - **Vision:** What are we building? (1-2 sentence elevator pitch)
   - **Audience (WHO):** Who are the primary users?
   - **Jobs to Be Done (JTBD) (WHY):** What high-level outcomes is the audience trying to achieve?
   - **Activities & Topics of Concern (WHAT):** What specific actions must the system perform? (Rule: One sentence without "and").
   - **Technical Constraints:** What stack or constraints must we use?
   - **External Context:** Any URLs or docs to read?

2. **Generate `AUDIENCE_JTBD.md`:** Create this file in the root directory capturing the Audience and their Jobs to Be Done.

3. **Generate Specs:** Create individual markdown files in the `specs/` directory for each Activity/Topic of Concern.
   - Ensure each spec focuses on behavioral outcomes and acceptance criteria, NOT implementation details.
   - Name the spec files using the convention `specs/<int>-<topic-name>.md` (e.g., `specs/01-color-extraction.md`).

4. **Update `specs/README.md`:** List the newly created specifications in this file.