#!/usr/bin/env python3
"""Python fallback when Node.js is unavailable for spell closure."""

import sys


def validate_all():
    print("Spell closure validation requires Node.js. Install Node or run: node scripts/build-sources.js")
    return 1


def sync_all():
    print("Sync spells requires Node.js. Install Node or run: node scripts/build-sources.js --sync-spells")
    return 1


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "validate"
    if cmd == "validate":
        sys.exit(validate_all())
    if cmd == "sync":
        sys.exit(sync_all())
