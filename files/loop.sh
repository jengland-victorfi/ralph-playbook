#!/bin/bash
set -eo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Usage: ./loop.sh [plan|build] [max_iterations]
# Examples:
#   ./loop.sh              # Build mode, unlimited iterations
#   ./loop.sh 20           # Build mode, max 20 iterations
#   ./loop.sh build 20     # Build mode, max 20 iterations
#   ./loop.sh plan         # Plan mode, unlimited iterations
#   ./loop.sh plan 5       # Plan mode, max 5 iterations

# Parse arguments
YOLO_FLAG=""
POSITIONAL_ARGS=()
for arg in "$@"; do
    if [ "$arg" = "--yolo" ]; then
        YOLO_FLAG="--yolo"
    else
        POSITIONAL_ARGS+=("$arg")
    fi
done
set -- "${POSITIONAL_ARGS[@]}"

if [ "$1" = "plan" ]; then
    # Plan mode
    MODE="plan"
    PROMPT_FILE="PROMPT_plan.md"
    MODEL="gemini-3.1-pro"
    MAX_ITERATIONS=${2:-0}
elif [ "$1" = "build" ]; then
    # Explicit build mode (with optional max iterations)
    MODE="build"
    PROMPT_FILE="PROMPT_build.md"
    MODEL="auto"
    MAX_ITERATIONS=${2:-0}
elif [[ "$1" =~ ^[0-9]+$ ]]; then
    # Build mode with max iterations (bare number)
    MODE="build"
    PROMPT_FILE="PROMPT_build.md"
    MODEL="auto"
    MAX_ITERATIONS=$1
else
    # Build mode, unlimited (no arguments or invalid input)
    MODE="build"
    PROMPT_FILE="PROMPT_build.md"
    MODEL="auto"
    MAX_ITERATIONS=0
fi

ITERATION=0
CURRENT_BRANCH=$(git branch --show-current)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Mode:   $MODE"
echo "Prompt: $PROMPT_FILE"
echo "Branch: $CURRENT_BRANCH"
[ $MAX_ITERATIONS -gt 0 ] && echo "Max:    $MAX_ITERATIONS iterations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Verify prompt file exists
if [ ! -f "$PROMPT_FILE" ]; then
    echo "Error: $PROMPT_FILE not found"
    exit 1
fi

while true; do
    if [ $MAX_ITERATIONS -gt 0 ] && [ $ITERATION -ge $MAX_ITERATIONS ]; then
        echo "Reached max iterations: $MAX_ITERATIONS"
        break
    fi

    # Run Ralph iteration with selected prompt
    echo "⏳ Running Cursor Agent..."
    echo "   - Model:  $MODEL"
    echo "   - Prompt: $PROMPT_FILE"
    echo "   - Flags:  --print $YOLO_FLAG --sandbox enabled"
    echo ""

    # --print: Headless mode (non-interactive, reads from stdin)
    # --yolo: Auto-approve all tool calls (if passed)
    # --sandbox enabled: Cursor Agent OS-level sandbox (mitigates blast radius with --yolo)
    # --model $MODEL: Uses gemini-3.1-pro for planning, auto for building
    # --output-format stream-json: line-delimited events; piped to parse_stream.ts for readable output
    cursor-agent --print \
        $YOLO_FLAG \
        --sandbox enabled \
        --output-format stream-json \
        --model "$MODEL" \
        "$PROMPT_FILE" | bun run "$SCRIPT_DIR/parse_stream.ts"

    # Changes are committed locally by the agent

    ITERATION=$((ITERATION + 1))
    echo -e "\n\n======================== LOOP $ITERATION ========================\n"
done