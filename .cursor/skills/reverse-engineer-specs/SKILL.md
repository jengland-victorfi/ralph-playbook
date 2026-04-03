---
name: reverse-engineer-specs
description: >-
  Use this skill when the user wants to onboard an existing brownfield project into the Ralph workflow. It reverse-engineers existing code to generate Ralph-compliant specs.
---
# Reverse Engineer Specs

When the user asks to reverse-engineer specs for an existing codebase, follow these steps:

1. **Understand the Goal:** The objective is to document *actual* code behavior (including bugs), not intended behavior. Zero implementation details should be in the output.

2. **Read the Prompt:** Read the instructions in `PROMPT_reverse_engineer_specs.md` to understand the strict rules for spec generation (e.g., "one sentence without 'and'", exhaustive tracing).

3. **Investigate and Generate:**
   - Ask the user which specific topic, directory, or feature they want to reverse-engineer first (or if they want to scan the whole repo).
   - Analyze the relevant source code in `src/`.
   - Generate the spec files in `specs/` using the naming convention `<int>-<topic-name>.md`.
   - Ensure the specs include: topic statement, scope, data contracts, behaviors (execution order), and state transitions.

4. **Commit:** Once the specs are generated and validated, use the `Shell` tool to commit them locally:
   ```bash
   git add specs/
   git commit -m "Reverse-engineer specs for [topic] [Ralph]"
   ```