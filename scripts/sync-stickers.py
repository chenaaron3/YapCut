#!/usr/bin/env python3
"""Download Noto top-250 + Lordicon Popular, original Marks, and hand-picked extras.

Writes files under public/stickers/ and src/domain/sticker-catalog.json.
See public/stickers/README.md.
"""

from __future__ import annotations

import base64
import json
import os
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EMOJI_DIR = ROOT / "public/stickers/emoji"
LORD_DIR = ROOT / "public/stickers/lordicon"
CATALOG = ROOT / "src/domain/sticker-catalog.json"

UA = {"User-Agent": "Mozilla/5.0 (sticker-sync)"}

# Existing emoji ids (keep filenames so placed edits still resolve).
EMOJI_ID_BY_CODEPOINT = {
    "1f525": "fire",
    "2665_fe0f": "heart",
    "1f602": "joy",
    "1f923": "rofl",
    "1f62d": "cry",
    "1f609": "wink",
    "1f60f": "smirk",
    "1f60d": "heart-eyes",
    "1f618": "kiss",
    "1f914": "thinking",
    "1f92f": "mind-blown",
    "1f929": "star-struck",
    "1f973": "partying",
    "1f60e": "sunglasses",
    "1f913": "nerd",
    "1f92a": "zany",
    "1f631": "scream",
    "1f97a": "pleading",
    "1f975": "hot-face",
    "1f976": "cold-face",
    "1f480": "skull",
    "1f4a9": "poop",
    "1f620": "angry",
    "1f44f": "clap",
    "1f44d": "thumbs-up",
    "1f44b": "wave",
    "1f44c": "ok",
    "1f4aa": "muscle",
    "1f64f": "pray",
    "1f91d": "handshake",
    "1f440": "eyes",
    "1f4af": "100",
    "2728": "sparkles",
    "2b50": "star",
    "1f4a5": "collision",
    "1f680": "rocket",
    "1f389": "party-popper",
    "1f3c6": "trophy",
    "1f4a1": "light-bulb",
    "2705": "check",
    "274c": "cross",
    "26a0_fe0f": "warning",
}

# Original Marks — keep ids even if they are also in Popular.
LORDICON_ORIGINALS = [
    ("arrow-down", "2755-arrow-down", "Arrow down"),
    ("arrow-right", "230-arrow-right", "Arrow right"),
    ("arrow-left", "2753-arrow-left", "Arrow left"),
    ("arrow-up", "2754-arrow-up", "Arrow up"),
    ("click", "2917-click-button", "Click"),
    ("circle", "1414-circle", "Circle"),
    ("check", "37-check", "Check"),
    ("cross", "25-cross-circle", "Cross"),
    ("alert", "1657-alert", "Alert"),
    ("target", "134-crosshair", "Target"),
    ("bulb", "1632-flame-bulb", "Idea"),
    ("star", "237-star", "Star"),
    ("question", "424-chat-question", "Question"),
    ("exclamation", "425-chat-exclamation", "Exclamation"),
    ("trophy", "3263-trophy-circle", "Trophy"),
    ("chart", "152-bar-chart-vertical-arrow-up", "Chart"),
    ("clock", "45-clock", "Clock"),
    ("bolt", "451-bolt", "Bolt"),
]

# Hand-picked Wired Flat extras for talking-head overlays (not in Popular).
LORDICON_HANDPICKED = [
    ("number-1", "2435-number-1", "1"),
    ("number-2", "2434-number-2", "2"),
    ("number-3", "2433-number-3", "3"),
    ("number-4", "2432-number-4", "4"),
    ("number-5", "2431-number-5", "5"),
    ("number-10", "2426-number-10", "10"),
    ("quote", "41-quote-right", "Quote"),
    ("hashtag", "2149-hashtag", "Hashtag"),
    ("percentage", "2154-percentage", "Percent"),
    ("confetti", "1103-confetti", "Confetti"),
    ("sparkles", "2474-sparkles", "Sparkles"),
    ("microphone", "188-microphone", "Microphone"),
    ("headphones", "464-headphones", "Headphones"),
    ("podcast", "1046-podcast", "Podcast"),
    ("thumb-down", "1122-thumb-down", "Thumb down"),
    ("handshake", "456-handshake", "Handshake"),
    ("hourglass", "472-hourglass", "Hourglass"),
    ("wallet", "421-wallet", "Wallet"),
    ("line-chart", "163-line-chart-grow", "Line chart"),
    ("pie-chart", "158-pie-chart", "Pie chart"),
    ("clapperboard", "499-clapperboard-play-open", "Clapperboard"),
    ("captions", "1038-closed-captioning", "Captions"),
    ("robot", "461-robot", "Robot"),
    ("ai", "2511-ai", "AI"),
    ("wand", "2844-magic-wand", "Magic wand"),
    ("flame", "2804-fire", "Flame"),
    ("plus", "49-plus-circle", "Plus"),
    ("download", "199-download", "Download"),
    ("link", "11-link", "Link"),
    ("wifi", "64-wifi", "Wifi"),
    ("bookmark", "400-bookmark", "Bookmark"),
    ("dumbbell", "429-dumbbell", "Dumbbell"),
    ("coffee", "239-coffee-cup", "Coffee"),
    ("airplane", "900-airplane", "Airplane"),
    ("pause", "3096-pause", "Pause"),
    ("music-note", "43-music-note-double", "Music"),
    ("funnel", "2610-sales-leads-funnel", "Funnel"),
    ("gamepad", "476-gamepad", "Gamepad"),
    ("dice", "1471-dice-cube", "Dice"),
]


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read()


def slugify(tag: str) -> str:
    s = tag.strip().strip(":").lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "emoji"


def title_from_tag(tag: str) -> str:
    s = tag.strip().strip(":").replace("-", " ").replace("_", " ")
    return s[:1].upper() + s[1:] if s else "Emoji"


def glyph_from_codepoint(cp: str) -> str:
    parts = []
    for p in cp.split("_"):
        parts.append(chr(int(p, 16)))
    return "".join(parts)


def decode_li(blob: bytes) -> dict:
    raw = base64.b64decode(blob.strip())
    return json.loads(bytes(b ^ 0x2A for b in raw))


def crop_intro(data: dict) -> dict:
    markers = data.get("markers") or []
    intro = next(
        (m for m in markers if str(m.get("cm", "")).startswith("in")),
        None,
    )
    if not intro:
        return data
    out = dict(data)
    out["ip"] = intro["tm"]
    out["op"] = intro["tm"] + intro["dr"]
    out["markers"] = [intro]
    return out


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":")), encoding="utf-8")


def download_emoji(codepoint: str, dest: Path) -> str:
    if dest.exists() and dest.stat().st_size > 0:
        return "skip"
    url = f"https://fonts.gstatic.com/s/e/notoemoji/latest/{codepoint}/lottie.json"
    raw = fetch(url)
    json.loads(raw)
    dest.write_bytes(raw)
    return "ok"


def download_lordicon(slug: str, dest_id: str) -> str:
    json_path = LORD_DIR / f"{dest_id}.json"
    svg_path = LORD_DIR / f"{dest_id}.svg"
    if json_path.exists() and json_path.stat().st_size > 0 and svg_path.exists():
        return "skip"
    base = f"https://media.lordicon.com/icons/wired/flat/{slug}"
    svg = fetch(base + ".svg")
    if b"<svg" not in svg.lower():
        raise RuntimeError(f"not svg: {slug}")
    svg_path.write_bytes(svg)
    data = crop_intro(decode_li(fetch(base + ".li")))
    write_json(json_path, data)
    return "ok"


def noto_top_250() -> list[dict]:
    data = json.loads(
        fetch("https://googlefonts.github.io/noto-emoji-animation/data/api.json")
    )
    by_cp = {i["codepoint"]: i for i in data["icons"]}
    icons = sorted(data["icons"], key=lambda i: -i.get("popularity", 0))[:250]
    seen_cp = {i["codepoint"] for i in icons}
    for cp in EMOJI_ID_BY_CODEPOINT:
        extra = by_cp.get(cp)
        if extra and extra["codepoint"] not in seen_cp:
            icons.append(extra)
            seen_cp.add(extra["codepoint"])
    used: dict[str, int] = {}
    rows = []
    for icon in icons:
        cp = icon["codepoint"]
        tags = icon.get("tags") or [cp]
        tag = tags[0]
        sid = EMOJI_ID_BY_CODEPOINT.get(cp) or slugify(tag)
        if sid in used and EMOJI_ID_BY_CODEPOINT.get(cp) != sid:
            sid = f"{sid}-{cp}"
        used[sid] = used.get(sid, 0) + 1
        rows.append(
            {
                "id": sid,
                "source": "emoji",
                "label": title_from_tag(tag),
                "glyph": glyph_from_codepoint(cp),
                "codepoint": cp,
                "popular": cp in EMOJI_ID_BY_CODEPOINT,
            }
        )
    return rows


def lordicon_popular() -> list[dict]:
    data = json.loads(
        fetch(
            "https://lordicon.com/api/library/icons?family=wired&style=flat&category=popular"
        )
    )
    slug_to_id = {slug: sid for sid, slug, _ in LORDICON_ORIGINALS}
    slug_to_id.update({slug: sid for sid, slug, _ in LORDICON_HANDPICKED})
    rows = []
    seen_ids: set[str] = set()
    for icon in data["icons"]:
        slug = f"{icon['index']}-{icon['name']}"
        sid = slug_to_id.get(slug, icon["name"])
        if sid in seen_ids:
            sid = slug
        seen_ids.add(sid)
        rows.append(
            {
                "id": sid,
                "source": "lordicon",
                "label": icon["title"],
                "slug": slug,
                "popular": True,
            }
        )
    for sid, slug, label in (*LORDICON_ORIGINALS, *LORDICON_HANDPICKED):
        if sid in seen_ids:
            continue
        seen_ids.add(sid)
        rows.append(
            {
                "id": sid,
                "source": "lordicon",
                "label": label,
                "slug": slug,
                "popular": True,
            }
        )
    return rows


def main() -> int:
    EMOJI_DIR.mkdir(parents=True, exist_ok=True)
    LORD_DIR.mkdir(parents=True, exist_ok=True)

    emoji_rows = noto_top_250()
    lord_rows = lordicon_popular()
    print(f"emoji {len(emoji_rows)} lordicon {len(lord_rows)}", flush=True)

    jobs = []
    with ThreadPoolExecutor(max_workers=16) as pool:
        for row in emoji_rows:
            dest = EMOJI_DIR / f"{row['id']}.json"
            jobs.append(
                pool.submit(
                    lambda r=row, d=dest: (
                        r["id"],
                        "emoji",
                        download_emoji(r["codepoint"], d),
                    )
                )
            )
        for row in lord_rows:
            jobs.append(
                pool.submit(
                    lambda r=row: (
                        r["id"],
                        "lordicon",
                        download_lordicon(r["slug"], r["id"]),
                    )
                )
            )
        fail = []
        ok = 0
        for fut in as_completed(jobs):
            try:
                sid, src, _ = fut.result()
                ok += 1
                if ok % 25 == 0:
                    print(f"  {ok}/{len(jobs)}", flush=True)
            except Exception as e:
                fail.append(str(e))
                print("FAIL", e, flush=True)

    # Drop unused original emoji files that are not in top 250? Keep them if
    # still referenced — all originals should be in top 250; if not, keep file.
    catalog = []
    for row in emoji_rows:
        catalog.append(
            {
                "id": row["id"],
                "source": "emoji",
                "label": row["label"],
                "glyph": row["glyph"],
                "popular": row["popular"],
            }
        )
    for row in lord_rows:
        catalog.append(
            {
                "id": row["id"],
                "source": "lordicon",
                "label": row["label"],
                "popular": row["popular"],
            }
        )
    CATALOG.parent.mkdir(parents=True, exist_ok=True)
    CATALOG.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {CATALOG} entries={len(catalog)} ok={ok} fail={len(fail)}")
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
