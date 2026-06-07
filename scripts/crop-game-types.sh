#!/bin/bash
set -euo pipefail

# Crops `public/gametype.png` (1792x592) into 4 individual game-type thumbnails.
# Each panel is 448x592.
# Output: public/game-types/<slug>.png

SRC="public/gametype.png"
OUT_DIR="public/game-types"

mkdir -p "$OUT_DIR"

WIDTH=448
HEIGHT=592
TOTAL_WIDTH=1792

# Order must match panels in gametype.png
# (x offsets: 0, 448, 896, 1344)
NAMES=("battle-royale" "clash-squad" "lone-wolf" "craftland")
OFFSETS=(0 448 896 1344)

if [[ ! -f "$SRC" ]]; then
  echo "❌ Source image not found: $SRC" >&2
  exit 1
fi

python3 - << 'EOF'
from PIL import Image
import os

SRC = "public/gametype.png"
OUT_DIR = "public/game-types"
WIDTH = 448
HEIGHT = 592

panels = [
  ("battle-royale", 0),
  ("clash-squad", 448),
  ("lone-wolf", 896),
  ("craftland", 1344),
]

os.makedirs(OUT_DIR, exist_ok=True)
img = Image.open(SRC).convert("RGBA")

for name, x_offset in panels:
  cropped = img.crop((x_offset, 0, x_offset + WIDTH, HEIGHT))
  out_path = os.path.join(OUT_DIR, f"{name}.png")
  cropped.save(out_path, "PNG")
  print(f"✅ Created: {out_path}")
EOF


echo "✅ Done. Thumbnails generated in: $OUT_DIR"

# Helpful for repo users:
# If your Next.js app expects public assets from apps/web/public, copy them:
#   mkdir -p apps/web/public/game-types && cp -f public/game-types/*.png apps/web/public/game-types/
