#!/usr/bin/env bash
#
# check-no-provider-data.sh
# -------------------------
# Pre-push guardrail for geo-geojson-toolkit (Memo 092 / PRD-G1).
#
# Purpose:
#   Prevents accidental commit of third-party geodata (OSM, BKG, GDI, WFS
#   exports, kommunale Open-Data GeoJSON, etc.) into this public repo. Such
#   data is licensed (ODbL, DL-DE-BY, CC-BY, ...) and MUST NOT be
#   redistributed via this repository.
#
# Usage:
#   bash scripts/check-no-provider-data.sh
#
# Exit codes:
#   0 = clean (no suspicious files found)
#   1 = suspicious files detected (commit/push should be aborted)
#
# Scan sources:
#   - git diff --cached --name-only   (staged files)
#   - git status --porcelain          (untracked + modified files)
#
# Detection heuristics (any match flags the file):
#   1. Path indicators: file path contains a known geo-provider slug
#      (osm, bkg, gdi, wfs, geofabrik, openaddresses, overpass).
#   2. Binary signature: file has a .db extension outside the synthetic
#      fixture directory (tests/fixtures/synthetic-geojson/).
#   3. GeoJSON payload: a .geojson/.json file outside the synthetic fixture
#      and node_modules is flagged for manual review (could be foreign data).
#
# Whitelist (NEVER flagged):
#   - tests/fixtures/synthetic-geojson/source/*.geojson   (CC0 synthetic)
#   - tests/fixtures/synthetic-geojson/README.md
#   - tests/fixtures/synthetic-geojson/LICENSE
#   - tests/fixtures/synthetic-geojson/build-fixture.mjs
#   - tests/manual/run-*.mjs
#   - scripts/check-no-provider-data.sh                   (this script)
#   - package.json / package-lock.json
#
# How to extend:
#   - Add a new provider slug: append to PROVIDER_PATH_SLUGS array below.
#   - Whitelist a known-safe path: append to WHITELIST_PATHS or
#     WHITELIST_GLOBS array below (globs use bash pattern matching).
#

set -euo pipefail

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

PROVIDER_PATH_SLUGS=(
    "osm"
    "bkg"
    "gdi"
    "wfs"
    "geofabrik"
    "openaddresses"
    "overpass"
)

# Exact-match whitelist (path relative to repo root)
WHITELIST_PATHS=(
    "tests/fixtures/synthetic-geojson/README.md"
    "tests/fixtures/synthetic-geojson/LICENSE"
    "tests/fixtures/synthetic-geojson/build-fixture.mjs"
    "scripts/check-no-provider-data.sh"
    "package.json"
    "package-lock.json"
)

# Glob-match whitelist (bash pattern; expanded via [[ $path == $glob ]])
WHITELIST_GLOBS=(
    "tests/fixtures/synthetic-geojson/source/*.geojson"
    "tests/manual/run-*.mjs"
    "node_modules/*"
    "coverage/*"
)

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

is_whitelisted() {
    local path="$1"
    local entry
    for entry in "${WHITELIST_PATHS[@]}"; do
        if [[ "$path" == "$entry" ]]; then
            return 0
        fi
    done
    for entry in "${WHITELIST_GLOBS[@]}"; do
        # shellcheck disable=SC2053
        if [[ "$path" == $entry ]]; then
            return 0
        fi
    done
    return 1
}

scan_path_slug() {
    local path="$1"
    local lower
    lower="$( printf '%s' "$path" | tr '[:upper:]' '[:lower:]' )"
    local slug
    for slug in "${PROVIDER_PATH_SLUGS[@]}"; do
        if [[ "$lower" =~ (^|[^a-z])${slug}([^a-z]|$) ]]; then
            printf '%s' "$slug"
            return 0
        fi
    done
    return 1
}

scan_geojson_payload() {
    local path="$1"
    local lower
    lower="$( printf '%s' "$path" | tr '[:upper:]' '[:lower:]' )"
    [[ "$lower" == *.geojson || "$lower" == *.json ]] || return 1
    return 0
}

scan_sqlite_db() {
    local path="$1"
    [[ "$path" == *.db ]] || return 1
    if [[ "$path" == tests/fixtures/synthetic-geojson/*.db ]]; then
        return 1
    fi
    return 0
}

collect_candidate_files() {
    local seen=$'\n'
    local line status path

    if git rev-parse --git-dir >/dev/null 2>&1; then
        while IFS= read -r line; do
            [[ -z "$line" ]] && continue
            path="$line"
            if [[ "$seen" != *$'\n'"$path"$'\n'* ]]; then
                seen="${seen}${path}"$'\n'
                printf '%s\n' "$path"
            fi
        done < <( git diff --cached --name-only --diff-filter=ACMR 2>/dev/null )

        while IFS= read -r line; do
            [[ -z "$line" ]] && continue
            status="${line:0:2}"
            path="${line:3}"
            path="${path#\"}"
            path="${path%\"}"
            [[ "$status" == " D" || "$status" == "D " ]] && continue
            if [[ "$seen" != *$'\n'"$path"$'\n'* ]]; then
                seen="${seen}${path}"$'\n'
                printf '%s\n' "$path"
            fi
        done < <( git status --porcelain -uall 2>/dev/null )
    fi
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

main() {
    local -a candidates=()
    local line
    while IFS= read -r line; do
        [[ -n "$line" ]] && candidates+=( "$line" )
    done < <( collect_candidate_files )

    local -a findings=()
    local path
    local candidate_count=${#candidates[@]}

    if (( candidate_count > 0 )); then
    for path in "${candidates[@]}"; do
        if is_whitelisted "$path"; then
            continue
        fi

        local slug_hit
        if slug_hit=$( scan_path_slug "$path" ); then
            findings+=( "[path-slug:${slug_hit}] ${path}" )
            continue
        fi

        if scan_sqlite_db "$path"; then
            findings+=( "[sqlite-db] ${path}" )
            continue
        fi

        if scan_geojson_payload "$path"; then
            findings+=( "[geojson-payload] ${path}" )
            continue
        fi
    done
    fi

    local finding_count=${#findings[@]}
    if (( finding_count > 0 )); then
        printf 'ERROR: possible third-party geodata detected in staged/untracked files.\n' >&2
        printf '       Only the CC0 synthetic fixture may live in this public repo.\n' >&2
        printf '       Move foreign geodata outside the worktree (or add to\n' >&2
        printf '       .gitignore) before committing.\n\n' >&2
        printf 'Offending files (%d):\n' "$finding_count" >&2
        local entry
        for entry in "${findings[@]}"; do
            printf '  - %s\n' "$entry" >&2
        done
        exit 1
    fi

    printf 'OK: no third-party geodata detected (%d files scanned).\n' "$candidate_count"
    exit 0
}

main "$@"
