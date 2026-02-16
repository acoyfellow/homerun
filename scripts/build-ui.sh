#!/bin/bash
# Build the directory HTML into a TypeScript string

INPUT="src/ui/directory.html"
OUTPUT="src/ui/directoryHtml.ts"

echo '// Auto-generated from src/ui/directory.html' > "$OUTPUT"
echo '// Run: bash scripts/build-ui.sh' >> "$OUTPUT"
echo '' >> "$OUTPUT"
echo 'export const directoryHtml = `' >> "$OUTPUT"

# Escape backticks and dollar signs (but not backslashes in JS)
sed 's/`/\\`/g; s/\${\([^}]*\)}/\\${\1}/g' "$INPUT" >> "$OUTPUT"

echo '`;' >> "$OUTPUT"

echo "Generated $OUTPUT"
