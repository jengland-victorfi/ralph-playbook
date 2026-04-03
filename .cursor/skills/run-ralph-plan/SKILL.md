---
name: run-ralph-plan
description: >-
  Use this skill when the user wants to generate or update the Ralph implementation plan, perform a gap analysis, or run the planning loop.
---
# Run Ralph Plan

When the user asks to generate or update the Ralph implementation plan, follow these steps:

1. **Determine Scope:** Ask the user if they want to run a full project plan or a scoped plan for a specific work branch.

2. **Execute the Planning Loop:**
   - For a full plan, use the `Shell` tool to run:
     ```bash
     ./loop.sh plan
     ```
   - For a scoped plan, use the `Shell` tool to run:
     ```bash
     ./loop.sh plan-work "user's description of the work"
     ```

3. **Verify Output:** Confirm that `IMPLEMENTATION_PLAN.md` has been generated or updated successfully. Let the user know they can review the plan and then start the build loop by running `./loop.sh`.