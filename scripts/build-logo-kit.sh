#!/usr/bin/env bash
# Generates the Svängsta logo kit from the master SVG.
# Run this whenever src/images/logo/svangsta-logo.svg changes.
#
# Requirements: rsvg-convert, zip  (both available via Homebrew: librsvg, zip)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGO_DIR="$ROOT/src/images/logo"
SVG="$LOGO_DIR/svangsta-logo.svg"
PNG_DIR="$LOGO_DIR/png"
ZIP_PATH="$LOGO_DIR/svangsta-logo-kit.zip"

SIZES=(256 512 1024 2048)

if [ ! -f "$SVG" ]; then
  echo "Missing master SVG: $SVG" >&2
  exit 1
fi

command -v rsvg-convert >/dev/null || { echo "rsvg-convert not found (brew install librsvg)" >&2; exit 1; }
command -v zip          >/dev/null || { echo "zip not found" >&2; exit 1; }

mkdir -p "$PNG_DIR"

for size in "${SIZES[@]}"; do
  out="$PNG_DIR/svangsta-logo-${size}.png"
  echo "  → $out"
  rsvg-convert --width "$size" --height "$size" --keep-aspect-ratio "$SVG" --output "$out"
done

# Build a flat kit ZIP (no nested folders) so non-technical users see
# everything at the top level when they unzip it. -j junks paths.
rm -f "$ZIP_PATH"
ZIP_INPUTS=("$SVG")
for size in "${SIZES[@]}"; do
  ZIP_INPUTS+=("$PNG_DIR/svangsta-logo-${size}.png")
done
zip -j -q "$ZIP_PATH" "${ZIP_INPUTS[@]}"

echo "Wrote $ZIP_PATH"
echo "Done."
