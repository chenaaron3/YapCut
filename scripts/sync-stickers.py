#!/usr/bin/env python3
"""Download Noto + Lordicon stickers into topic folders; rewrite sticker-catalog.json.

See public/stickers/README.md.
"""

from __future__ import annotations

import base64
import json
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EMOJI_DIR = ROOT / "public/stickers/emoji"
LORD_DIR = ROOT / "public/stickers/lordicon"
CATALOG = ROOT / "src/domain/edit/sticker-catalog.json"

UA = {"User-Agent": "Mozilla/5.0 (sticker-sync)"}
EMOJI_TEST_URL = "https://unicode.org/Public/emoji/latest/emoji-test.txt"
NOTO_API_URL = "https://googlefonts.github.io/noto-emoji-animation/data/api.json"
LORDICON_POPULAR_URL = (
    "https://lordicon.com/api/library/icons?family=wired&style=flat&category=popular"
)
LORDICON_CATEGORIES_URL = (
    "https://lordicon.com/api/library/categories?family=wired&style=flat"
)

# Stable ids for placed edits. Popular tab = this set (not food extras).
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

# Talking-head meals/drinks (not produce). Always included; not Popular.
FOOD_ID_BY_CODEPOINT = {
    "1f355": "pizza",
    "1f354": "hamburger",
    "1f32d": "hot-dog",
    "1f32e": "taco",
    "1f32f": "burrito",
    "1f35d": "spaghetti",
    "1f373": "cooking",
    "1f37f": "popcorn",
    "1f369": "doughnut",
    "1f36a": "cookie",
    "1f368": "ice-cream",
    "2615": "hot-beverage",
    "1f9cb": "bubble-tea",
    "1f37b": "clinking-beer-mugs",
    "1f377": "wine-glass",
}

UNICODE_GROUP_TO_TOPIC = {
    "Smileys & Emotion": "smileys-emotion",
    "People & Body": "people-body",
    "Animals & Nature": "animals-nature",
    "Food & Drink": "food-drink",
    "Travel & Places": "travel-places",
    "Activities": "activities",
    "Objects": "objects",
    "Symbols": "symbols",
    "Flags": "flags",
    "Component": "component",
}

# Fitzpatrick modifiers — keep only the default (yellow) form per glyph.
SKIN_TONE_MODIFIERS = frozenset({"1f3fb", "1f3fc", "1f3fd", "1f3fe", "1f3ff"})

LORDICON_CATEGORY_TO_TOPIC = {
    "interface": "ui",
    "files": "ui",
    "people": "people",
    "characters-and-symbols": "people",
    "photo-and-video": "media",
    "music-and-audio": "media",
    "celebrations": "media",
    "finance-and-stats": "business",
    "work-and-education": "business",
    "shopping": "business",
    "tech-and-devices": "tech",
    "science-and-industry": "tech",
}
LORDICON_TOPIC_RANK = {
    "ui": 0,
    "people": 1,
    "media": 2,
    "business": 3,
    "tech": 4,
    "objects": 5,
}
DEFAULT_LORDICON_TOPIC = "objects"

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


def normalize_codepoint(cp: str) -> str:
    """Strip leading zeros per hex segment so Noto `a9_fe0f` matches Unicode `00a9_fe0f`."""
    return "_".join(part.lstrip("0") or "0" for part in cp.lower().split("_"))


def cdn_codepoint(cp: str) -> str:
    """Pad each hex segment to ≥4 digits for fonts.gstatic.com (Noto uses bare `a9_fe0f`)."""
    return "_".join(part.zfill(4) for part in cp.lower().split("_"))


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


def parse_emoji_topics(text: str) -> dict[str, str]:
    """codepoint key → topic slug for every fully-qualified emoji."""
    out: dict[str, str] = {}
    group: str | None = None
    for line in text.splitlines():
        if line.startswith("# group:"):
            group = line.split(":", 1)[1].strip()
            continue
        if not group or line.startswith("#") or ";" not in line:
            continue
        hex_seq, rest = line.split(";", 1)
        if "fully-qualified" not in rest:
            continue
        key = normalize_codepoint("_".join(hex_seq.split()))
        if group not in UNICODE_GROUP_TO_TOPIC:
            raise RuntimeError(f"unknown Unicode emoji group: {group}")
        out[key] = UNICODE_GROUP_TO_TOPIC[group]
    return out


def lookup_emoji_topic(cp: str, topics: dict[str, str]) -> str:
    base = normalize_codepoint(cp)
    keys = [base]
    if base.endswith("_fe0f"):
        keys.append(base[: -len("_fe0f")])
    else:
        keys.append(f"{base}_fe0f")
    for key in keys:
        if key in topics:
            return topics[key]
    raise RuntimeError(f"no Unicode group for codepoint {cp}")


def place_file(dest: Path, old_paths: list[Path], write) -> str:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        for path in old_paths:
            if path.exists() and path.resolve() != dest.resolve():
                path.unlink()
        return "skip"
    for path in old_paths:
        if path.exists() and path.stat().st_size > 0:
            path.rename(dest)
            return "move"
    write(dest)
    return "ok"


def download_emoji(codepoint: str, dest: Path) -> None:
    url = f"https://fonts.gstatic.com/s/e/notoemoji/latest/{cdn_codepoint(codepoint)}/lottie.json"
    raw = fetch(url)
    json.loads(raw)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(raw)


def download_lordicon_pair(slug: str, json_path: Path, svg_path: Path) -> None:
    base = f"https://media.lordicon.com/icons/wired/flat/{slug}"
    svg = fetch(base + ".svg")
    if b"<svg" not in svg.lower():
        raise RuntimeError(f"not svg: {slug}")
    svg_path.parent.mkdir(parents=True, exist_ok=True)
    svg_path.write_bytes(svg)
    data = crop_intro(decode_li(fetch(base + ".li")))
    write_json(json_path, data)


def has_skin_tone(cp: str) -> bool:
    return bool(set(cp.lower().split("_")) & SKIN_TONE_MODIFIERS)


def noto_emoji_rows(topics: dict[str, str]) -> list[dict]:
    data = json.loads(fetch(NOTO_API_URL))
    by_cp = {i["codepoint"]: i for i in data["icons"]}
    icons = sorted(data["icons"], key=lambda i: -i.get("popularity", 0))
    seen_cp = {i["codepoint"] for i in icons}
    for cp in (*EMOJI_ID_BY_CODEPOINT, *FOOD_ID_BY_CODEPOINT):
        extra = by_cp.get(cp)
        if extra and extra["codepoint"] not in seen_cp:
            icons.append(extra)
            seen_cp.add(extra["codepoint"])

    used: dict[str, int] = {}
    rows = []
    skipped_tone = 0
    for icon in icons:
        cp = icon["codepoint"]
        if has_skin_tone(cp):
            skipped_tone += 1
            continue
        topic = lookup_emoji_topic(cp, topics)
        tags = icon.get("tags") or [cp]
        tag = tags[0]
        pinned = EMOJI_ID_BY_CODEPOINT.get(cp) or FOOD_ID_BY_CODEPOINT.get(cp)
        sid = pinned or slugify(tag)
        if sid in used:
            sid = f"{sid}-{cp}"
        used[sid] = used.get(sid, 0) + 1
        rows.append(
            {
                "id": sid,
                "source": "emoji",
                "label": title_from_tag(tag),
                "glyph": glyph_from_codepoint(cp),
                "codepoint": cp,
                "topic": topic,
                "popular": cp in EMOJI_ID_BY_CODEPOINT,
            }
        )
    print(f"emoji skipped (skin-tone variants): {skipped_tone}", flush=True)
    return rows


def slug_name(slug: str) -> str:
    m = re.match(r"^(\d+)-(.*)$", slug)
    return m.group(2) if m else slug


def lordicon_name_topics() -> dict[str, str]:
    categories = json.loads(fetch(LORDICON_CATEGORIES_URL))
    mapping: dict[str, str] = {}
    for cat in categories:
        title = cat["title"]
        if title == "popular":
            continue
        topic = LORDICON_CATEGORY_TO_TOPIC.get(title, DEFAULT_LORDICON_TOPIC)
        data = json.loads(
            fetch(
                "https://lordicon.com/api/library/icons"
                f"?family=wired&style=flat&category={title}"
            )
        )
        for icon in data.get("icons") or []:
            name = icon["name"]
            prev = mapping.get(name)
            if prev is None or LORDICON_TOPIC_RANK[topic] < LORDICON_TOPIC_RANK[prev]:
                mapping[name] = topic
        print(f"  lordicon {title}: {len(data.get('icons') or [])} → {topic}", flush=True)
    return mapping


def lordicon_rows(name_topics: dict[str, str]) -> list[dict]:
    data = json.loads(fetch(LORDICON_POPULAR_URL))
    slug_to_id = {slug: sid for sid, slug, _ in LORDICON_ORIGINALS}
    slug_to_id.update({slug: sid for sid, slug, _ in LORDICON_HANDPICKED})
    rows = []
    seen_ids: set[str] = set()

    def topic_for(slug: str, sid: str) -> str:
        return (
            name_topics.get(slug_name(slug))
            or name_topics.get(sid)
            or DEFAULT_LORDICON_TOPIC
        )

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
                "topic": topic_for(slug, sid),
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
                "topic": topic_for(slug, sid),
                "popular": True,
            }
        )
    return rows


def prune_unreferenced(root: Path, keep: set[Path]) -> int:
    removed = 0
    for path in sorted(root.rglob("*"), reverse=True):
        if path.is_file() and path.resolve() not in keep:
            path.unlink()
            removed += 1
        elif path.is_dir() and not any(path.iterdir()):
            path.rmdir()
    return removed


def main() -> int:
    print("fetch Unicode emoji-test.txt", flush=True)
    topics = parse_emoji_topics(fetch(EMOJI_TEST_URL).decode("utf-8"))
    print(f"unicode fully-qualified: {len(topics)}", flush=True)

    emoji_rows = noto_emoji_rows(topics)
    print("fetch Lordicon categories", flush=True)
    lord_rows = lordicon_rows(lordicon_name_topics())
    print(f"emoji {len(emoji_rows)} lordicon {len(lord_rows)}", flush=True)

    keep: set[Path] = set()
    jobs = []
    with ThreadPoolExecutor(max_workers=16) as pool:
        for row in emoji_rows:
            dest = EMOJI_DIR / row["topic"] / f"{row['id']}.json"
            keep.add(dest.resolve())
            old = [EMOJI_DIR / f"{row['id']}.json"]
            jobs.append(
                pool.submit(
                    lambda r=row, d=dest, o=old: (
                        r["id"],
                        "emoji",
                        place_file(
                            d,
                            o,
                            lambda dest, cp=r["codepoint"]: download_emoji(cp, dest),
                        ),
                    )
                )
            )
        for row in lord_rows:
            json_path = LORD_DIR / row["topic"] / f"{row['id']}.json"
            svg_path = LORD_DIR / row["topic"] / f"{row['id']}.svg"
            keep.add(json_path.resolve())
            keep.add(svg_path.resolve())

            def do_lord(r=row, jp=json_path, sp=svg_path):
                moved_json = place_file(
                    jp,
                    [LORD_DIR / f"{r['id']}.json"],
                    lambda dest: None,
                )
                moved_svg = place_file(
                    sp,
                    [LORD_DIR / f"{r['id']}.svg"],
                    lambda dest: None,
                )
                if (
                    jp.exists()
                    and jp.stat().st_size > 0
                    and sp.exists()
                    and sp.stat().st_size > 0
                ):
                    status = (
                        "skip"
                        if moved_json == "skip" and moved_svg == "skip"
                        else "move"
                    )
                    return r["id"], "lordicon", status
                download_lordicon_pair(r["slug"], jp, sp)
                return r["id"], "lordicon", "ok"

            jobs.append(pool.submit(do_lord))

        fail = []
        ok = 0
        moved = 0
        for fut in as_completed(jobs):
            try:
                _sid, _src, status = fut.result()
                ok += 1
                if status == "move":
                    moved += 1
                if ok % 25 == 0:
                    print(f"  {ok}/{len(jobs)}", flush=True)
            except Exception as e:
                fail.append(str(e))
                print("FAIL", e, flush=True)

    catalog = []
    for row in emoji_rows:
        catalog.append(
            {
                "id": row["id"],
                "source": "emoji",
                "label": row["label"],
                "glyph": row["glyph"],
                "popular": row["popular"],
                "topic": row["topic"],
            }
        )
    for row in lord_rows:
        catalog.append(
            {
                "id": row["id"],
                "source": "lordicon",
                "label": row["label"],
                "popular": row["popular"],
                "topic": row["topic"],
            }
        )
    CATALOG.parent.mkdir(parents=True, exist_ok=True)
    CATALOG.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")

    pruned = prune_unreferenced(EMOJI_DIR, keep) + prune_unreferenced(LORD_DIR, keep)
    print(
        f"wrote {CATALOG} entries={len(catalog)} ok={ok} moved={moved} "
        f"pruned={pruned} fail={len(fail)}"
    )
    missing = [p for p in keep if not p.exists()]
    if missing:
        print("missing files:", *[str(p) for p in missing[:20]], sep="\n  ")
        return 1
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
