## Build & Run

Succinct rules for how to BUILD the project:

- Loop scripts: `bash -n loop.sh loop_streamed.sh files/loop.sh files/loop_streamed.sh`
- Stream parser (Bun): `bun build parse_stream.ts --outdir=/tmp/ralph-parse-check` (or `bun run parse_stream.ts` with JSONL on stdin)

## Validation

Run these after implementing to get immediate feedback:

- Tests: (no test suite in repo yet; add when `src/` gains code)
- Typecheck: `bun build parse_stream.ts --outdir=/tmp/ralph-parse-check`
- Lint: (none configured)

## Operational Notes

Succinct learnings about how to RUN the project:

- `./loop.sh` / `./loop.sh plan` / `./loop.sh specs` — Cursor Agent with `--sandbox enabled` (and optional `--yolo`); build mode pipes through `parse_stream.ts` if using root `loop.sh`. Specs mode uses `PROMPT_specs.md` and `gemini-3.1-pro` (same as plan).
- `./loop_streamed.sh` — same modes; streams via `files/parse_stream.js` and Node

### Codebase Patterns

...
