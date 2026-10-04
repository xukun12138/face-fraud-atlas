#!/usr/bin/env python3
"""Optionally validate the initial 2026-10-04 release, not future corpus builds.

These release-specific expectations are deliberately separate from the generic
builder and Pages workflow. A later reviewed corpus may validly change them.
"""
from pathlib import Path
import argparse
import json


def require(condition, message):
    if not condition:
        raise ValueError(message)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    data = args.root.resolve() / "site/data"
    catalog = json.loads((data / "catalog.json").read_text(encoding="utf-8"))
    benchmarks = json.loads((data / "benchmarks.json").read_text(encoding="utf-8"))
    stats = json.loads((data / "stats.json").read_text(encoding="utf-8"))
    papers = catalog["papers"]
    research = [paper for paper in papers if paper["is_research"]]
    official = [paper for paper in papers if not paper["is_research"]]
    require(catalog["search_cutoff"] == "2026-10-04", "Initial release search cutoff differs")
    require(len(research) == 141 and len(official) == 12, "Initial release requires 141 research and 12 official records")
    require(sum(paper["core_venue"] for paper in research) == 120, "Initial release requires 120 selected core-venue records")
    require(stats["research_records"] == 141 and stats["official_resources"] == 12,
            "Initial release statistics disagree with the catalog")
    require(stats["preprint_records"] == 1 and stats["preprint_ids"] == ["D05"],
            "Initial release preprint classification differs")
    require(stats["workshop_ids"] == ["P41", "S11", "S12"] and stats["chapter_ids"] == ["R13"],
            "Initial release publication-form classification differs")
    require(len(benchmarks["benchmarks"]) == 12, "Initial release requires 12 benchmark records")
    siwm = next((item for item in benchmarks["benchmarks"] if item["id"] == "P08"), None)
    require(siwm is not None and siwm["count_discrepancy"] and siwm["total_count"] == 1630
            and siwm["real_count"] == 660 and siwm["attack_count"] == 968,
            "Initial release must preserve the SiW-M primary-paper discrepancy")
    print("Initial 2026-10-04 release validation passed. This optional check does not constrain future corpus editions.")


if __name__ == "__main__":
    main()
