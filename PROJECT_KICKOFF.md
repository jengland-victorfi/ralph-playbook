# Ralph Playbook: Project Kickoff Questionnaire

Welcome to your new Ralph-powered project! To get started with the Ralph workflow, you need to complete **Phase 1: Define Requirements**. 

Fill out this questionnaire and feed it to Cursor Agent (or ChatGPT) to automatically generate your `AUDIENCE_JTBD.md` and initial `specs/*.md` files.

## 1. The Vision
**What are we building?** (Provide a 1-2 sentence elevator pitch)
> [Your answer here]

## 2. The Audience (WHO)
**Who are the primary users of this system?** (e.g., "Freelance graphic designers", "Internal customer support team")
> [Your answer here]

## 3. Jobs to Be Done (JTBD) (WHY)
**What high-level outcomes is the audience trying to achieve?** (e.g., "Help designers quickly establish a visual identity for a new client")
> [Your answer here]

## 4. Activities & Topics of Concern (WHAT)
**What specific actions must the system perform to fulfill the JTBD?** 
*Rule of thumb: Each activity should be describable in one sentence WITHOUT using the word "and". If you need "and", it should be split into multiple activities.*
> 1. [Activity 1 - e.g., "The system extracts dominant colors from uploaded images"]
> 2. [Activity 2 - e.g., "The user arranges extracted colors into a saved palette"]
> 3. [Activity 3]

## 5. Technical Constraints & Stack
**What technologies, frameworks, or constraints must we use?** (e.g., "Next.js, Tailwind, Supabase, no external state management libraries")
> [Your answer here]

## 6. External Context
**Are there any URLs, API docs, or reference materials the agent should read first?**
> [Your answer here]

---

## 🤖 Prompt for the LLM

*Once you've filled out the above, give this entire file to Cursor Agent (in Composer or Chat) with the following prompt:*

```text
I am starting a new project using the Ralph Playbook methodology. Based on the questionnaire above:

1. Create an `AUDIENCE_JTBD.md` file in the root directory that captures the Audience and their Jobs to Be Done.
2. Create individual markdown files in the `specs/` directory for each Activity/Topic of Concern. Ensure each spec focuses on behavioral outcomes and acceptance criteria, NOT implementation details.
3. Name the spec files using the convention `specs/<int>-<topic-name>.md` (e.g., `specs/01-color-extraction.md`).
4. Update `specs/README.md` to list the newly created specifications.
```