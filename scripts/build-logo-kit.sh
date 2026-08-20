#!/usr/bin/env bash
# Generates the Svängsta logo kit from the master SVGs.
# Run this whenever a master SVG in src/images/logo/ changes.
#
# Requirements: rsvg-convert, zip  (both available via Homebrew: librsvg, zip)
#               sips              (built into macOS - used for the JPG encoding)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGO_DIR="$ROOT/src/images/logo"
PNG_DIR="$LOGO_DIR/png"
JPG_DIR="$LOGO_DIR/jpg"
ZIP_PATH="$LOGO_DIR/svangsta-logo-kit.zip"

# One entry per logo variant, without the .svg extension. Every master must be
# transparent outside the artwork - the PNGs inherit that transparency.
MASTERS=(svangsta-logo svangsta-logo-with-name svangsta-logo-with-name-white)

# Masters that get no JPG. JPG has no transparency, so the encoder below
# flattens onto white - which would erase a white name. The white-name variant
# is a PNG/SVG-only variant, and logotyp.html hides the JPG option for it.
NO_JPG=(svangsta-logo-with-name-white)

SIZES=(256 512 1024 2048)

JPG_QUALITY=90

command -v rsvg-convert >/dev/null || { echo "rsvg-convert not found (brew install librsvg)" >&2; exit 1; }
command -v sips         >/dev/null || { echo "sips not found (expected on macOS)" >&2; exit 1; }
command -v zip          >/dev/null || { echo "zip not found" >&2; exit 1; }

mkdir -p "$PNG_DIR" "$JPG_DIR"

# Templated so BSD mktemp honours TMPDIR instead of reaching for /var/folders.
TMP="$(mktemp -d "${TMPDIR:-/tmp}/svangsta-logo-kit.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

ZIP_INPUTS=()

# Exit 0 when $1 appears in NO_JPG.
skips_jpg() {
  local candidate="$1" entry
  for entry in "${NO_JPG[@]}"; do
    [ "$entry" = "$candidate" ] && return 0
  done
  return 1
}

for master in "${MASTERS[@]}"; do
  svg="$LOGO_DIR/${master}.svg"
  if [ ! -f "$svg" ]; then
    echo "Missing master SVG: $svg" >&2
    exit 1
  fi
  ZIP_INPUTS+=("$svg")

  for size in "${SIZES[@]}"; do
    png="$PNG_DIR/${master}-${size}.png"
    echo "  → $png"
    rsvg-convert --width "$size" --height "$size" --keep-aspect-ratio "$svg" --output "$png"
    ZIP_INPUTS+=("$png")

    skips_jpg "$master" && continue

    # JPG cannot store transparency, so flatten onto white. rsvg-convert has no
    # JPG encoder, hence the detour over an opaque PNG and sips. Print shops that
    # ask for JPG expect a white background anyway.
    jpg="$JPG_DIR/${master}-${size}.jpg"
    echo "  → $jpg"
    rsvg-convert --background-color white --width "$size" --height "$size" \
      --keep-aspect-ratio "$svg" --output "$TMP/flat.png"
    sips -s format jpeg -s formatOptions "$JPG_QUALITY" "$TMP/flat.png" --out "$jpg" >/dev/null

    ZIP_INPUTS+=("$jpg")
  done
done

# Drop JPGs left over from an earlier run of a master that has since moved into
# NO_JPG, so the folder never disagrees with what logotyp.html offers.
for master in "${NO_JPG[@]}"; do
  rm -f "$JPG_DIR/${master}-"*.jpg
done

# Build a flat kit ZIP (no nested folders) so non-technical users see
# everything at the top level when they unzip it. -j junks paths.
rm -f "$ZIP_PATH"
zip -j -q "$ZIP_PATH" "${ZIP_INPUTS[@]}"

echo "Wrote $ZIP_PATH"
echo "Done."
