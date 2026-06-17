#!/usr/bin/env python3
"""Validate content indexes and spell closure; split legacy bilingual markdown."""

import json
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA_SPLIT = re.compile(r"##\s+Українська\s+Версія", re.I)
EN_VERSION = re.compile(r"##\s+English\s+Version\s*", re.I)

INDEX_BASENAMES = {
    "characters-index.json",
    "spells-index.json",
    "monsters-index.json",
    "npc-index.json",
    "items-index.json",
    "maps-index.json",
    "dm-script-index.json",
}


def walk_md_dirs():
    for base in (os.path.join(ROOT, "Shared"), os.path.join(ROOT, "scenarios")):
        for dirpath, _, filenames in os.walk(base):
            for name in filenames:
                yield os.path.join(dirpath, name)


def find_index_files():
    for path in walk_md_dirs():
        if os.path.basename(path) in INDEX_BASENAMES:
            yield path


def slug_from_index_entry(entry):
    s = str(entry).replace("\\", "/")
    s = s.split("/")[-1]
    s = re.sub(r"\.(en|ua)\.md$", "", s, flags=re.I)
    s = re.sub(r"\.md$", "", s, flags=re.I)
    return s


def read_index(index_path):
    with open(index_path, encoding="utf-8") as f:
        raw = json.load(f)
    if not isinstance(raw, list):
        raise ValueError("Index must be array: " + index_path)
    return [slug_from_index_entry(x) for x in raw]


def split_legacy_file(content, default_slug):
    if not UA_SPLIT.search(content) and not EN_VERSION.search(content):
        return None
    title_match = re.search(r"^#\s+(.+)$", content, re.M)
    en_title = default_slug
    ua_title = default_slug
    if title_match:
        parts = title_match.group(1).split(" / ")
        en_title = parts[0].strip()
        ua_title = " / ".join(parts[1:]).strip() if len(parts) > 1 else en_title

    ua_parts = UA_SPLIT.split(content, maxsplit=1)
    before_ua = ua_parts[0]
    ua_body = ua_parts[1].strip() if len(ua_parts) > 1 else ""

    after_title = re.sub(r"^#\s+.+\n?", "", before_ua, count=1).strip()
    en_match = EN_VERSION.search(after_title)
    preamble = ""
    en_body = ""
    if en_match:
        idx = en_match.start()
        preamble = after_title[:idx].strip()
        en_body = after_title[idx + len(en_match.group(0)) :].strip()
    else:
        en_body = after_title

    preamble_block = (preamble + "\n\n---\n\n") if preamble else ""
    en_file = "# " + en_title + "\n\n" + preamble_block + en_body + "\n"
    ua_file = None
    if ua_body:
        ua_file = "# " + ua_title + "\n\n" + preamble_block + ua_body + "\n"
    return en_file, ua_file


def split_legacy():
    count = 0
    for file_path in walk_md_dirs():
        if not file_path.endswith(".md"):
            continue
        if file_path.endswith(".en.md") or file_path.endswith(".ua.md"):
            continue
        if os.path.basename(file_path) == "README.md":
            continue
        with open(file_path, encoding="utf-8") as f:
            content = f.read()
        if not UA_SPLIT.search(content) and not EN_VERSION.search(content):
            continue
        dir_name = os.path.dirname(file_path)
        slug = os.path.splitext(os.path.basename(file_path))[0]
        en_path = os.path.join(dir_name, slug + ".en.md")
        ua_path = os.path.join(dir_name, slug + ".ua.md")
        if os.path.exists(en_path):
            print("skip (en exists):", os.path.relpath(file_path, ROOT))
            continue
        result = split_legacy_file(content, slug)
        if not result:
            continue
        en_file, ua_file = result
        with open(en_path, "w", encoding="utf-8") as f:
            f.write(en_file)
        if ua_file:
            with open(ua_path, "w", encoding="utf-8") as f:
                f.write(ua_file)
        os.remove(file_path)
        print("split:", os.path.relpath(file_path, ROOT))
        count += 1
    print("Split", count, "legacy file(s).")


def validate():
    errors = 0
    warnings = 0
    for index_path in find_index_files():
        dir_name = os.path.dirname(index_path)
        for slug in read_index(index_path):
            en_path = os.path.join(dir_name, slug + ".en.md")
            ua_path = os.path.join(dir_name, slug + ".ua.md")
            if not os.path.exists(en_path):
                print("MISSING EN:", os.path.relpath(en_path, ROOT))
                errors += 1
            if not os.path.exists(ua_path):
                print("WARN missing UA:", os.path.relpath(ua_path, ROOT))
                warnings += 1
    print("Validate:", errors, "error(s),", warnings, "warning(s).")
    if errors:
        sys.exit(1)


def run_spell_closure():
    node = shutil.which("node")
    if not node:
        print("Spell closure validation requires Node.js. Install Node or run: node scripts/build-sources.js")
        sys.exit(1)
    script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "spell-cli.js")
    result = subprocess.run([node, script, "validate"], cwd=ROOT)
    if result.returncode:
        sys.exit(result.returncode)


def run_spell_sync():
    node = shutil.which("node")
    if not node:
        print("Sync spells requires Node.js. Install Node or run: node scripts/build-sources.js --sync-spells")
        sys.exit(1)
    script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "spell-cli.js")
    result = subprocess.run([node, script, "sync"], cwd=ROOT)
    if result.returncode:
        sys.exit(result.returncode)


def main():
    args = sys.argv[1:]
    if "--split-legacy" in args:
        split_legacy()
    if "--sync-spells" in args:
        run_spell_sync()
    only_split_legacy = len(args) == 1 and args[0] == "--split-legacy"
    if not only_split_legacy:
        validate()
        run_spell_closure()


if __name__ == "__main__":
    main()
