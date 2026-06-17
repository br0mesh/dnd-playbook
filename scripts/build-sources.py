#!/usr/bin/env python3
"""Regenerate *-sources.js / *-index.js and split legacy bilingual markdown."""

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA_SPLIT = re.compile(r"##\s+Українська\s+Версія", re.I)
EN_VERSION = re.compile(r"##\s+English\s+Version\s*", re.I)

MODULE_MAP = {
    "characters-index.json": ("CHARACTERS_LIBRARY_INDEX", "__CHARACTERS_MD__"),
    "spells-index.json": ("SPELL_LIBRARY_INDEX", "__SPELL_MD__"),
    "monsters-index.json": ("MONSTERS_LIBRARY_INDEX", "__MONSTERS_MD__"),
    "npc-index.json": ("NPC_LIBRARY_INDEX", "__NPC_MD__"),
    "items-index.json": ("ITEMS_LIBRARY_INDEX", "__ITEMS_MD__"),
    "maps-index.json": ("MAPS_LIBRARY_INDEX", "__MAPS_MD__"),
    "dm-script-index.json": ("DMSCRIPT_LIBRARY_INDEX", "__DMSCRIPT_MD__"),
}


def walk_md_dirs():
    for base in (os.path.join(ROOT, "Shared"), os.path.join(ROOT, "scenarios")):
        for dirpath, _, filenames in os.walk(base):
            for name in filenames:
                yield os.path.join(dirpath, name)


def find_index_files():
    for path in walk_md_dirs():
        base = os.path.basename(path)
        if base.endswith("-index.json") and base in MODULE_MAP:
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


def write_index(index_path, slugs):
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(slugs, f, indent=2)
        f.write("\n")


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


def build_sources():
    for index_path in find_index_files():
        base = os.path.basename(index_path)
        index_global, md_global = MODULE_MAP[base]
        dir_name = os.path.dirname(index_path)
        slugs = read_index(index_path)
        write_index(index_path, slugs)

        sources_name = base.replace("-index.json", "-sources.js")
        index_js_name = base.replace(".json", ".js")
        sources_path = os.path.join(dir_name, sources_name)
        index_js_path = os.path.join(dir_name, index_js_name)

        lines = ["window." + md_global + " = window." + md_global + " || {};"]
        for slug in slugs:
            en_path = os.path.join(dir_name, slug + ".en.md")
            ua_path = os.path.join(dir_name, slug + ".ua.md")
            if not os.path.exists(en_path):
                print("Skip sources for missing EN:", en_path)
                continue
            with open(en_path, encoding="utf-8") as f:
                en = f.read()
            ua = ""
            if os.path.exists(ua_path):
                with open(ua_path, encoding="utf-8") as f:
                    ua = f.read()
            entry = "window." + md_global + '["' + slug + '"] = { en: ' + json.dumps(en, ensure_ascii=True)
            if ua:
                entry += ", ua: " + json.dumps(ua, ensure_ascii=True)
            entry += " };"
            lines.append(entry)

        with open(sources_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")

        with open(index_js_path, "w", encoding="utf-8") as f:
            f.write("window." + index_global + " = " + json.dumps(slugs) + ";\n")

        print("built:", os.path.relpath(sources_path, ROOT), ",", os.path.relpath(index_js_path, ROOT))


def main():
    args = sys.argv[1:]
    if "--split-legacy" in args:
        split_legacy()
    if "--validate-only" not in args:
        build_sources()
    if "--validate" in args or "--validate-only" in args:
        validate()


if __name__ == "__main__":
    main()
