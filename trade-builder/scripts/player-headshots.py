#!/usr/bin/env python3
"""Verify or restore the curated demo headshots. Requires Pillow and system curl.

Default: verify all assets offline. --download restores missing/corrupt files from
the manifest, accepting only the reviewed checksum. --contact-sheets DIR writes
thumbnail sheets for visual review. Remote source changes require manual review.
"""

import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
MANIFEST = PUBLIC / "player-headshots/manifest.json"


def asset_path(entry):
    path = (PUBLIC / entry["localPath"].lstrip("/")).resolve()
    if path.parent != (PUBLIC / "player-headshots").resolve():
        raise ValueError("Asset path escapes player-headshots")
    return path


def validate(path, entry, placeholders):
    data = path.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if digest in placeholders:
        raise ValueError("Generic NBA silhouette")
    if digest != entry["sha256"] or len(data) != entry["bytes"]:
        raise ValueError("File differs from the visually reviewed asset")
    with Image.open(path) as image:
        image.load()
        if image.size != (entry["width"], entry["height"]):
            raise ValueError("Image dimensions differ from manifest")
        if min(image.size) < 100:
            raise ValueError("Portrait is too small")


def restore(entry, placeholders):
    if not entry["sourceUrl"].startswith("https://"):
        raise ValueError("Source must use HTTPS")
    path = asset_path(entry)
    with tempfile.TemporaryDirectory(prefix="gambit-headshot-") as directory:
        candidate = Path(directory) / "image"
        result = subprocess.run(
            ["curl", "--fail", "--location", "--silent", "--show-error",
             "--proto", "=https", "--proto-redir", "=https", "--retry", "2",
             "--connect-timeout", "15", "--max-time", "60",
             entry["sourceUrl"], "--output", str(candidate)],
            capture_output=True, text=True,
        )
        if result.returncode:
            raise ValueError(result.stderr.strip())
        validate(candidate, entry, placeholders)
        path.write_bytes(candidate.read_bytes())


def contact_sheets(players, directory):
    directory.mkdir(parents=True, exist_ok=True)
    entries = list(players.items())
    for offset in range(0, len(entries), 80):
        batch = entries[offset:offset + 80]
        sheet = Image.new("RGB", (1200, ((len(batch) + 7) // 8) * 145), "#e5e7eb")
        draw = ImageDraw.Draw(sheet)
        for index, (player_id, entry) in enumerate(batch):
            with Image.open(asset_path(entry)) as source:
                portrait = source.convert("RGBA")
                portrait.thumbnail((150, 110))
                x, y = (index % 8) * 150, (index // 8) * 145
                sheet.paste(portrait, (x + (150 - portrait.width) // 2, y), portrait)
                draw.text((x + 3, y + 112), player_id, fill="black")
                draw.text((x + 3, y + 126), entry["name"][:22], fill="black")
        sheet.save(directory / f"players-{offset // 80 + 1:02}.jpg")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--contact-sheets", type=Path)
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text())
    roster_data = (ROOT / manifest["cataloguePath"]).read_bytes()
    if hashlib.sha256(roster_data).hexdigest() != manifest["catalogueSha256"]:
        raise SystemExit("Catalogue changed: review the mappings before updating coverage.")
    roster = json.loads(roster_data)["players"]
    players = manifest["players"]
    if set(players) != {str(player["id"]) for player in roster}:
        raise SystemExit("Manifest must cover every catalogue ID exactly once.")
    if any(players[str(player["id"])]["name"] != player["name"] for player in roster):
        raise SystemExit("Manifest names disagree with catalogue IDs.")
    expected_urls = {key: value["localPath"] for key, value in players.items()
                     if value["status"] == "available"}
    index = json.loads((ROOT / "src/lib/trade/player-photo-urls.json").read_text())
    if index != expected_urls:
        raise SystemExit("Runtime URL index disagrees with the manifest.")
    if len(expected_urls) != manifest["coverage"]["available"]:
        raise SystemExit("Coverage count disagrees with the manifest.")
    if not (PUBLIC / manifest["fallbackPath"].lstrip("/")).is_file():
        raise SystemExit("Fallback is missing.")
    placeholders = set(manifest["rejectedPlaceholderSha256"])

    def check(pair):
        player_id, entry = pair
        if entry["status"] != "available":
            return None
        try:
            try:
                validate(asset_path(entry), entry, placeholders)
            except (OSError, ValueError):
                if not args.download:
                    raise
                restore(entry, placeholders)
            return None
        except (OSError, ValueError) as error:
            return f"{player_id} {entry['name']}: {error}"

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        errors = [error for error in pool.map(check, players.items()) if error]
    if errors:
        raise SystemExit("\n".join(errors))
    if args.contact_sheets:
        contact_sheets({key: entry for key, entry in players.items()
                        if entry["status"] == "available"}, args.contact_sheets)
    print(f"Verified {len(expected_urls)}/{len(roster)} local portraits; "
          f"{sum(entry['bytes'] for entry in players.values() if entry['status'] == 'available'):,} bytes.")


if __name__ == "__main__":
    main()
