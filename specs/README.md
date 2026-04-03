# Requirements Specifications

This directory contains the requirement specifications (one per JTBD topic) that drive the Ralph loop.

## Rules
- One markdown file per topic of concern.
- These are the source of truth for what should be built.
- Created during the Requirements phase (human + LLM conversation).
- Consumed by both PLANNING and BUILDING modes.

If you run `./loop.sh specs`, the agent will read this README and automatically generate or format the individual `<int>-filename.md` spec files based on the project context.