#!/bin/bash
set -eo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
# Usage: ./loop.sh [plan|build|specs] [max_iterations]
# Examples:
#   ./loop.sh              # Build mode, max 3 iterations (default when omitted)
#   ./loop.sh 20           # Build mode, max 20 iterations
#   ./loop.sh build 20     # Build mode, max 20 iterations
#   ./loop.sh plan         # Plan mode, max 3 iterations (default when omitted)
#   ./loop.sh plan 5       # Plan mode, max 5 iterations
#   ./loop.sh specs        # Specs mode, max 3 by default
#   ./loop.sh specs 3      # Specs mode, max 3 iterations
#   ./loop.sh build 0      # Pass 0 for unlimited iterations

# Parse arguments
YOLO_FLAG="--force"

POSITIONAL_ARGS=()
for arg in "$@"; do
    if [ "$arg" = "--yolo" ]; then
        YOLO_FLAG="--yolo"
    else
        POSITIONAL_ARGS+=("$arg")
    fi
done
set -- "${POSITIONAL_ARGS[@]}"

MODEL="auto"
if [ "$1" = "plan" ]; then
    MODE="plan"
    PROMPT_FILE="PROMPT_plan.md"
    MAX_ITERATIONS=${2:-3}
elif [ "$1" = "build" ]; then
    MODE="build"
    PROMPT_FILE="PROMPT_build.md"
    MAX_ITERATIONS=${2:-3}
elif [ "$1" = "specs" ]; then
    MODE="specs"
    PROMPT_FILE="PROMPT_specs.md"
    MODEL="gemini-3.1-pro"
    MAX_ITERATIONS=${2:-3}
elif [[ "$1" =~ ^[0-9]+$ ]]; then
    MODE="build"
    PROMPT_FILE="PROMPT_build.md"
    MODEL="auto"
    MAX_ITERATIONS=$1
else
    MODE="build"
    PROMPT_FILE="PROMPT_build.md"
    MODEL="auto"
    MAX_ITERATIONS=3
fi

ITERATION=0
CURRENT_BRANCH=$(git branch --show-current)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🍩 Ralph loop"
echo "Mode:   $MODE"
echo "Prompt: $PROMPT_FILE"
echo "Branch: $CURRENT_BRANCH"
[ $MAX_ITERATIONS -gt 0 ] && echo "Max:    $MAX_ITERATIONS iterations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Verify prompt file exists
if [ ! -f "$PROMPT_FILE" ]; then
    echo "☢️ Error: $PROMPT_FILE not found"
    exit 1
fi

while true; do
    if [ $MAX_ITERATIONS -gt 0 ] && [ $ITERATION -ge $MAX_ITERATIONS ]; then
        echo "🏁 Reached max iterations: $MAX_ITERATIONS"
        break
    fi

    echo "🍩 ⏳ Running Cursor Agent (loop iteration $((ITERATION + 1)))..."
    echo "   - Model:  $MODEL"
    echo "   - Prompt: $PROMPT_FILE"
    echo "   - Flags:  --print $YOLO_FLAG --sandbox enabled"
    echo ""

    rm -f /tmp/ralph_continue

    if ! cursor-agent --print \
        $YOLO_FLAG \
        --sandbox enabled \
        --output-format stream-json \
        --stream-partial-output \
        --model "$MODEL" \
        "$PROMPT_FILE contains your mission. your job is to find and complete the task." | bun run "$SCRIPT_DIR/parse_stream.ts"
    then
        echo "☢️ Cursor Agent or stream parser exited with an error."
        exit 1
    fi

    if [ ! -f /tmp/ralph_continue ]; then
        echo ""
        echo "🏁 ✨ Agent response did not include 'fa-shizzle'. Exiting loop. 🏁"
        break
    fi
    rm -f /tmp/ralph_continue

    ITERATION=$((ITERATION + 1))
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🍩 After iteration $ITERATION — latest commit:"
    git log -1 --format="  %h %s (%ci)" 2>/dev/null || echo "  (no commits yet)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    SUBJECT=$(git log -1 --pretty=%s 2>/dev/null || true)
    if echo "$SUBJECT" | grep -qiF "[Ralph] DONE"; then
        echo ""
        echo "🏁 ✨ All tasks complete — [Ralph] DONE on latest commit. Exiting loop. 🏁"
        break
    fi

    echo -e "\n\n🍩 ======================== LOOP $ITERATION ======================== 🍩\n"
done
