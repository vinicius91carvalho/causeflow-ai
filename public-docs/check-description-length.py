#!/usr/bin/env python3
"""Check that all .mdx description fields are <= 160 characters.

Called by check-invariants.sh. Exits 0 if all pass, 1 if any exceed limit.
"""
import os
import sys

def _extract_description(content):
    """Extract the `description` field from YAML frontmatter."""
    if not content.startswith('---'):
        return None
    end = content.find('\n---', 3)
    if end == -1:
        return None
    frontmatter = content[3:end]
    for line in frontmatter.splitlines():
        stripped = line.strip()
        if stripped.startswith('description:'):
            val = stripped[len('description:'):].strip()
            # Strip surrounding quotes if present
            if val and len(val) >= 2:
                if (val[0] == '"' and val[-1] == '"') or \
                   (val[0] == "'" and val[-1] == "'"):
                    val = val[1:-1]
            return val
    return None

def main(root):
    fail = False
    for dirpath, _, files in os.walk(root):
        for f in files:
            if not f.endswith('.mdx'):
                continue
            if '/node_modules/' in dirpath or '/.mintlify/' in dirpath or '/drafts/' in dirpath:
                continue
            path = os.path.join(dirpath, f)
            with open(path) as fh:
                content = fh.read()
            desc = _extract_description(content)
            if desc is not None and len(desc) > 160:
                print(f'DESCRIPTION TOO LONG ({len(desc)} chars): {path}')
                fail = True
    if fail:
        sys.exit(1)

if __name__ == '__main__':
    main(sys.argv[1])
