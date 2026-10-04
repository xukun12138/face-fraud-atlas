#!/usr/bin/env python3
"""Build Face Fraud Atlas data using only the Python standard library.

Portable inputs: paper-source/sample-base.bib, data/catalog-records.csv,
data/benchmark-sources.csv. The initial import may additionally use a reviewed
TSV with --verification. --materialize-inputs saves portable local inputs.
No network fetches, invented performance values, or guessed code links.
"""
from pathlib import Path
import argparse, collections, csv, datetime, io, json, re, shutil, unicodedata

SCHEMA_VERSION = "1.0"
ROLES = ["PAD", "digital", "generation", "morph", "adversarial", "systems/privacy", "surveys"]
PUBLICATION_FORMS = {"article", "conference", "workshop", "chapter", "preprint", "official"}
SECTIONS = {
    "PAD": "4 · Face Presentation Attack Detection",
    "digital": "5 · Digital Face Manipulation",
    "generation": "3 / 5 · Attack Mechanisms and Digital Manipulation",
    "morph": "6 · Morphing and Reference-Identity Attacks",
    "adversarial": "6 · Adversarial Recognition and Model Compromise",
    "systems/privacy": "8 · Trustworthy Verification and Data Governance",
    "surveys": "1 / 2 · Introduction and Review Foundations",
    "official": "2 / 7 / 8 · Definitions, Evaluation and Governance",
}
NUMERIC = {
    "identity_count", "real_count", "attack_count", "total_count",
    "full_collection_including_enrollment", "enrollment_count", "class_sum",
    "presentation_total", "streams_per_presentation", "dataset_introduction_year",
    "channels_per_presentation", "additional_release_real_videos", "test_list_count",
    "raw_manipulations", "standard_benchmark_total", "hidden_set_count",
    "face_image_count", "deepfake_source_video_count", "broader_acquisition_actor_count",
    "broader_raw_source_video_count",
}

def read_text(path):
    data = Path(path).read_bytes()
    for encoding in ("utf-8-sig", "gb18030", "cp1252"):
        try:
            value = data.decode(encoding)
            if "\ufffd" not in value:
                return value
        except UnicodeDecodeError:
            pass
    raise ValueError(f"Cannot decode input without replacement characters: {path}")

def read_rows(path, delimiter=","):
    return list(csv.DictReader(io.StringIO(read_text(path)), delimiter=delimiter))

def braced(text, pos):
    assert text[pos] == "{"
    start = pos + 1
    pos += 1
    depth = 1
    while depth:
        if pos >= len(text):
            raise ValueError("Unclosed BibTeX brace")
        if text[pos] == "\\":
            pos += 2
            continue
        if text[pos] == "{": depth += 1
        elif text[pos] == "}": depth -= 1
        pos += 1
    return text[start:pos - 1], pos

def parse_bib(text):
    records = {}
    for match in re.finditer(r"@(\w+)\s*\{\s*([\w-]+)\s*,", text):
        kind, key = match.groups()
        if kind.lower() in {"comment", "preamble", "string"}:
            continue
        pos = match.end()
        fields = {}
        while pos < len(text):
            while text[pos].isspace() or text[pos] == ",": pos += 1
            if text[pos] == "}":
                pos += 1
                break
            field = re.match(r"(\w+)\s*=\s*", text[pos:])
            if field is None:
                raise ValueError(f"Unsupported BibTeX field in {key}: {text[pos:pos + 60]}")
            name = field.group(1).lower()
            pos += field.end()
            if text[pos] == "{": value, pos = braced(text, pos)
            elif text[pos] == '"':
                end = pos + 1
                while text[end] != '"' or text[end - 1] == "\\": end += 1
                value = text[pos + 1:end]
                pos = end + 1
            else:
                token = re.match(r"[^,}\n]+", text[pos:])
                value = token.group()
                pos += token.end()
            fields[name] = value.strip()
        if key in records: raise ValueError(f"Duplicate citation key: {key}")
        records[key] = {"entry_type": kind.lower(), "bibtex": text[match.start():pos].strip(), **fields}
    return records

ACCENTS = {
    "'": "\u0301", chr(96): "\u0300", '"': "\u0308", "^": "\u0302",
    "~": "\u0303", "=": "\u0304", ".": "\u0307", "u": "\u0306",
    "v": "\u030c", "H": "\u030b", "c": "\u0327", "k": "\u0328",
    "b": "\u0331", "d": "\u0323", "r": "\u030a",
}
ACCENT_PATTERN = re.compile(r"""\\(['"\x60^~=.uvHckbdr])\s*(?:\{([^{}]+)\}|([A-Za-z]))""")

def tex_text(value):
    if not value: return ""
    text = value.replace(r"\i", "i").replace(r"\j", "j")
    def accent(match):
        letter = match.group(2) or match.group(3)
        return unicodedata.normalize("NFC", letter + ACCENTS[match.group(1)])
    text = ACCENT_PATTERN.sub(accent, text)
    for command, glyph in {"ss": "ß", "o": "ø", "O": "Ø", "ae": "æ", "AE": "Æ",
                           "oe": "œ", "OE": "Œ", "l": "ł", "L": "Ł"}.items():
        text = re.sub(r"\\" + command + r"(?![A-Za-z])", glyph, text)
    for old, new in {r"\&": "&", r"\_": "_", r"\%": "%", r"\#": "#",
                     r"\$": "$", r"\{": "{", r"\}": "}"}.items():
        text = text.replace(old, new)
    text = re.sub(r"\\(?:textit|textbf|textsc|emph|mathrm|textrm)\s*\{([^{}]*)\}", r"\1", text)
    text = text.replace("{", "").replace("}", "").replace("---", "—").replace("--", "–")
    text = re.sub(r"\s+", " ", text).strip()
    if "\\" in text: raise ValueError(f"Unconverted TeX command: {text}")
    return unicodedata.normalize("NFC", text)

def author_list(value):
    depth, start, pos = 0, 0, 0
    chunks = []
    while pos < len(value):
        if value[pos] == "\\":
            pos += 2
            continue
        if value[pos] == "{": depth += 1
        elif value[pos] == "}": depth -= 1
        elif depth == 0 and value[pos:pos + 5] == " and ":
            chunks.append(value[start:pos])
            pos += 5
            start = pos
            continue
        pos += 1
    if value[start:].strip(): chunks.append(value[start:])
    result = []
    for chunk in chunks:
        name = tex_text(chunk)
        if name.count(",") == 1:
            last, first = (p.strip() for p in name.split(",", 1))
            name = f"{first} {last}"
        result.append(name)
    return result

def boolean(value):
    text = str(value).strip().lower()
    if text in {"true", "1", "yes"}: return True
    if text in {"false", "0", "no", ""}: return False
    raise ValueError(f"Invalid boolean value: {value!r}")

def integer(value, field="count"):
    text = str(value).strip()
    if not text: return None
    if not re.fullmatch(r"[0-9]+", text):
        raise ValueError(f"{field} must be a nonnegative integer or empty: {value!r}")
    return int(text)

def year_value(value, field="year"):
    year = integer(value, field)
    if year is None or not 1000 <= year <= 9999:
        raise ValueError(f"{field} must be a four-digit year: {value!r}")
    return year

def search_date(value):
    if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
        raise ValueError("Search cutoff must use YYYY-MM-DD")
    return datetime.date.fromisoformat(value).isoformat()
def first_url(value):
    urls = [url.rstrip(";,") for url in re.findall(r"https?://[^\s|]+", value or "")]
    # Prefer a recorded primary-source page over a bibliographic API, especially
    # when the API source is only its generic /works endpoint.
    primary = [url for url in urls if "api.crossref.org" not in url]
    specific = [url for url in urls if url.rstrip("/") != "https://api.crossref.org/works"]
    return (primary or specific or urls or [""])[0]
def venue(record, form):
    for field in ("journal", "booktitle", "institution", "howpublished"):
        if record.get(field): return tex_text(record[field])
    if form != "official" and record.get("entry_type") == "misc" and record.get("note"):
        return tex_text(record["note"])
    return "; ".join(author_list(record.get("author", "")))

def evidence(key, role, form, finance):
    if key in {"S31", "S32"}:
        level = "direct-system"
        boundary = ("Application/system experiments include financial identity or payment-related workflows. "
                    "Findings concern tested versions, privileges and outcomes, not current vulnerabilities "
                    "or measured financial loss.")
    elif key in {"S12", "S30", "R13"}:
        level = "identity-verification"
        boundary = ("Studies identity/document verification, operational verification, or simulated "
                    "detector–recognizer composition. It does not establish deployed banking loss reduction.")
    elif form == "official" or role in {"surveys", "generation", "systems/privacy"}:
        level = "context"
        boundary = ("Background capabilities, conceptual synthesis, governance, fairness or privacy context, "
                    "rather than direct financial detector deployment evidence.")
    else:
        level = "component-transfer"
        boundary = ("Component, benchmark or general biometric evidence. Financial use is a transfer "
                    "argument requiring validation of the actual workflow.")
    if key == "STD09":
        boundary += " This is an ongoing evaluation resource; 2026 is its recorded access year, not a finalized standard edition."
    return level, boundary + (("\nOriginal reviewed relevance note: " + finance.strip()) if finance else "")

def merge_records(rows, verified):
    audit = {r.get("key", r.get("id", "")): r for r in verified}
    result = []
    for row in rows:
        key = row.get("id", row.get("key", ""))
        old = audit.get(key, {})
        new = dict(row)
        new["id"] = key
        for dest, candidates in {
            "section": ["section", "chapter_group"], "method": ["method"],
            "contribution": ["contribution"], "limitation": ["limitation", "limitations"],
            "finance_relevance": ["finance_relevance"],
        }.items():
            if not new.get(dest):
                new[dest] = next((old.get(c, "") for c in candidates if old.get(c)), "")
        if not new.get("metadata_source"): new["metadata_source"] = old.get("verification_source", "")
        result.append(new)
    return result

def build_catalog(bib, rows, search_cutoff="2026-10-04"):
    ids = [r["id"] for r in rows]
    if len(ids) != len(set(ids)) or set(ids) != set(bib):
        raise ValueError("Record IDs must be unique and exactly match the final bibliography")
    papers = []
    for row in rows:
        key = row["id"]
        record = bib[key]
        role = row.get("primary_role", "") or ("official" if row.get("publication_form") == "official" else "")
        form = row.get("publication_form", "") or ("official" if role == "official" else "")
        if role not in ROLES + ["official"] or form not in PUBLICATION_FORMS:
            raise ValueError(f"Invalid classification: {key}")
        if (role == "official") != (form == "official"):
            raise ValueError(f"Official role and publication form must agree: {key}")
        if key == "S12" and role != "morph": raise ValueError("S12 must be assigned to morph")
        if key == "D05" and form != "preprint": raise ValueError("D05 is the dataset technical report")
        year = year_value(record["year"], f"{key} bibliography year")
        if row.get("year") and year_value(row["year"], f"{key} record year") != year:
            raise ValueError(f"Year conflict: {key}")
        level, note = evidence(key, role, form, row.get("finance_relevance", ""))
        papers.append({
            "id": key, "title": tex_text(record["title"]),
            "authors": author_list(record.get("author", "")), "venue": venue(record, form), "year": year,
            "primary_role": role, "publication_form": form,
            "core_venue": boolean(row.get("selected_core_venue", row.get("selected_top_venue", "False"))),
            "section": SECTIONS[role], "evidence_level": level, "evidence_note": note,
            "contribution": row.get("contribution", "").strip(),
            "limitations": row.get("limitation", row.get("limitations", "")).strip(),
            "source_url": first_url(row.get("metadata_source", row.get("verification_source", ""))),
            "bibtex": record["bibtex"], "is_research": role != "official",
            "method": row.get("method", "").strip(), "publication_note": tex_text(record.get("note", "")),
        })
    papers.sort(key=lambda p: (not p["is_research"], -p["year"], p["id"]))
    research = [p for p in papers if p["is_research"]]
    official = [p for p in papers if not p["is_research"]]
    return {
        "schema_version": SCHEMA_VERSION, "search_cutoff": search_date(search_cutoff),
        "research_count": len(research), "official_count": len(official), "default_scope": "research",
        "scope_note": ("Selective integrative review of abstracts and selected accessible full texts. "
                       "Metadata verification does not imply uniform full-text reading."),
        "evidence_policy": ("Levels describe relationship to financial verification, not paper quality. "
                            "Contribution and limitation text preserves reviewed annotations; missing "
                            "annotations remain empty."),
        "papers": papers,
    }

def build_benchmarks(rows, catalog):
    ids = {p["id"] for p in catalog["papers"]}
    result = []
    for row in rows:
        key = row["citekey"]
        if key not in ids: raise ValueError(f"Unknown benchmark citation: {key}")
        benchmark_id = row.get("id", "").strip() or key
        if not row.get("dataset", "").strip() or not row.get("unit", "").strip():
            raise ValueError(f"Benchmark dataset name and count unit are required: {benchmark_id}")
        counts = {f: integer(row.get(f, ""), f"{benchmark_id}.{f}") for f in sorted(NUMERIC)}
        real, attack, total = counts["real_count"], counts["attack_count"], counts["total_count"]
        conflict = bool(row.get("count_consistency", "").strip())
        if all(v is not None for v in (real, attack, total)) and real + attack != total:
            conflict = True
            if not row.get("count_consistency", "").strip():
                raise ValueError(f"Document the class/total count discrepancy: {benchmark_id}")
        extra = {f: v for f, v in counts.items() if f not in {
            "identity_count", "real_count", "attack_count", "total_count"} and v is not None}
        result.append({
            "id": benchmark_id, "citekey": key, "name": row["dataset"], "dataset": row["dataset"],
            "year": year_value(row["year"], f"{benchmark_id} benchmark year"), "version": row.get("version", ""),
            "identity_count": counts["identity_count"], "identity_scope": row.get("identity_scope", ""),
            "real_count": real, "attack_count": attack, "total_count": total,
            "unit": row["unit"], "modalities": [v.strip() for v in row.get("modalities", "").split(";") if v.strip()],
            "protocol": row.get("split_protocol", ""),
            "notes": [row[f].strip() for f in ("count_basis", "count_consistency") if row.get(f, "").strip()],
            "count_basis": row.get("count_basis", ""), "derivation": row.get("derivation", ""),
            "source_url": row.get("source_url", ""), "source_location": row.get("source_location", ""),
            "verified_on": row.get("verified_on", ""), "count_discrepancy": conflict,
            "additional_counts": extra, "evidence_level": "component-transfer",
        })
    if len({r["id"] for r in result}) != len(result):
        raise ValueError("Benchmark IDs must be unique; provide an id for additional versions of one cited dataset")
    return {
        "schema_version": SCHEMA_VERSION,
        "scope_note": ("Original-paper versions and units are preserved. Counts are not detector "
                       "performance, financial outcomes or independent trial counts. Missing counts "
                       "remain null. Streams, images, recordings and sequences must not be aggregated."),
        "benchmarks": result,
    }

def taxonomy():
    claims = [
        {"id": "media", "label": "Media authenticity", "description": "What evidence concerns the presentation or synthesis/alteration of media, and what can survive replay or processing?", "source_keys": ["R01", "R02", "R05", "STD04", "STD05"]},
        {"id": "identity", "label": "Identity consistency", "description": "Does the claimant correspond to the claimed identity, and was the enrolled or documentary reference already contaminated?", "source_keys": ["S04", "S05", "S06", "S30"]},
        {"id": "capture", "label": "Capture and session provenance", "description": "Do capture, liveness, matching and challenge decisions refer to the same trusted, fresh event rather than substituted inputs?", "source_keys": ["S31", "S32", "STD02"]},
        {"id": "authorization", "label": "Valid business authorization", "description": "Is the identity event bound to the intended account, privileges and requested action? Correct facial matching alone does not establish consent.", "source_keys": ["S31", "STD02", "STD03", "STD06"]},
    ]
    scenarios = [
        {"id": "print-and-replay", "label": "Printed portraits and ordinary replay", "description": "An artifact reaches the capture device. Reproduction and recapture cues depend on instrument and sensor.", "entry": "sensor-facing presentation", "production": "unmodified portrait or recording", "reference_risk": "Probe presentation changes; the enrolled reference need not be altered.", "claims": ["media", "identity", "capture"], "source_keys": ["P01", "P03", "P04", "P05"]},
        {"id": "mask-presentation", "label": "Three-dimensional mask presentation", "description": "A mask challenges planar assumptions and material/geometry evidence under the actual sensing configuration.", "entry": "sensor-facing presentation", "production": "manufactured physical instrument", "reference_risk": "Impersonation may use an otherwise genuine victim reference.", "claims": ["media", "identity", "capture"], "source_keys": ["P15", "P17", "P44"]},
        {"id": "synthetic-replay", "label": "Generated or manipulated media replay", "description": "Swapped, reenacted or generated content is displayed to a camera; synthesis and recapture are distinct observations.", "entry": "sensor-facing presentation", "production": "swap, reenactment or talking-face synthesis", "reference_risk": "A claimed identity may be reproduced without contaminating its reference.", "claims": ["media", "identity", "capture"], "source_keys": ["G01", "G03", "G06", "P09", "S32"]},
        {"id": "media-injection", "label": "Post-capture media injection", "description": "A processing path supplies recorded or synthetic media without physical traces expected from presentation attacks.", "entry": "post-capture injection", "production": "unmodified or manipulated digital media", "reference_risk": "Matching can accept an input whose capture provenance is invalid.", "claims": ["media", "identity", "capture", "authorization"], "source_keys": ["S31", "S32", "STD02"]},
        {"id": "reference-morph", "label": "Morph-contaminated enrollment", "description": "A multi-contributor portrait enters a reference before issuance. An authentic signature alone does not establish pre-signing identity correctness.", "entry": "enrollment/reference boundary", "production": "identity fusion", "reference_risk": "A persistent reference can match multiple contributors; later genuine probes do not repair enrollment.", "claims": ["identity", "authorization"], "source_keys": ["S04", "S05", "S06", "S08"]},
        {"id": "cross-side-substitution", "label": "Cross-component sample substitution", "description": "Liveness and matching accept different samples or events. Binding is needed even when both components report success.", "entry": "cross-component association or substitution", "production": "genuine or manipulated samples combined across events", "reference_risk": "Approved capture can be associated with a different matching probe or account reference.", "claims": ["identity", "capture", "authorization"], "source_keys": ["S31", "S32", "STD02"]},
    ]
    for item in claims + scenarios: item["title"] = item["label"]
    return {
        "schema_version": SCHEMA_VERSION,
        "scope_note": ("Conceptual synthesis of protected assertions and compatible pathways. Citations "
                       "support mechanisms and control assumptions, not a claim that every combination "
                       "was tested in financial deployment. The claims are not independent scores "
                       "or a security guarantee."),
        "claims": claims, "scenarios": scenarios,
    }

def build_stats(catalog, benchmarks):
    research = [p for p in catalog["papers"] if p["is_research"]]
    def count(field): return dict(sorted(collections.Counter(p[field] for p in research).items()))
    def form_ids(form): return sorted(p["id"] for p in research if p["publication_form"] == form)
    def percent(number, digits): return round(number / len(research) * 100, digits) if research else None
    preprints = form_ids("preprint")
    core = sum(p["core_venue"] for p in research)
    # Preserve the initial release wording while avoiding a one-report assumption
    # after a curator adds further independently reviewed records.
    status_note = ("Workshops, the book chapter and the sole technical report retain their actual status."
                   if len(preprints) == 1 and len(form_ids("chapter")) == 1
                   else "Workshops, book chapters and technical reports retain their actual status.")
    return {
        "schema_version": SCHEMA_VERSION, "search_cutoff": catalog["search_cutoff"],
        "total_records": len(catalog["papers"]), "research_records": len(research),
        "official_resources": catalog["official_count"], "benchmarks": len(benchmarks["benchmarks"]),
        "core_venue_records": core,
        "core_venue_percent": percent(core, 1),
        "preprint_records": len(preprints), "preprint_percent": percent(len(preprints), 2),
        "preprint_ids": preprints, "workshop_ids": form_ids("workshop"), "chapter_ids": form_ids("chapter"),
        "role_order": ROLES, "role_counts": count("primary_role"), "year_counts": count("year"),
        "publication_form_counts": count("publication_form"), "evidence_level_counts": count("evidence_level"),
        "counting_note": ("Counts describe this selected corpus, not field-wide prevalence, research quality, "
                          "detector performance or financial incident frequency."),
        "core_venue_note": "Project-selected flag, not a universal ranking. " + status_note,
    }

def write_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

def write_csv(path, rows, encoding="utf-8"):
    fields = list(dict.fromkeys(k for row in rows for k in row))
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding=encoding, newline="") as file:
        writer = csv.DictWriter(file, fields)
        writer.writeheader()
        writer.writerows(rows)

def export_rows(rows):
    """Flatten generated records losslessly into spreadsheet-friendly CSV cells."""
    result = []
    for row in rows:
        values = {}
        for key, value in row.items():
            if isinstance(value, (list, dict)):
                value = json.dumps(value, ensure_ascii=False, sort_keys=True)
            elif isinstance(value, bool):
                value = str(value).lower()
            elif value is None:
                value = ""
            values[key] = value
        result.append(values)
    return result

def validate_taxonomy(tax, bib):
    for group in ("claims", "scenarios"):
        ids = [item["id"] for item in tax[group]]
        if len(ids) != len(set(ids)): raise ValueError(f"Duplicate taxonomy {group} ID")
        for item in tax[group]:
            if not set(item["source_keys"]).issubset(bib):
                raise ValueError(f"Absent taxonomy source: {item['id']}")
    claims = {item["id"] for item in tax["claims"]}
    for item in tax["scenarios"]:
        if not set(item["claims"]).issubset(claims):
            raise ValueError(f"Unknown scenario claim: {item['id']}")

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    default_root = Path(__file__).resolve().parents[1]
    parser.add_argument("--root", type=Path, default=default_root)
    parser.add_argument("--bib", type=Path)
    parser.add_argument("--records", type=Path)
    parser.add_argument("--benchmarks", type=Path)
    parser.add_argument("--verification", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--downloads", type=Path,
                        help="CSV export directory (default: site/downloads)")
    parser.add_argument("--search-cutoff", default="2026-10-04",
                        help="Declared literature search cutoff, YYYY-MM-DD; not inferred from build time")
    parser.add_argument("--materialize-inputs", action="store_true")
    args = parser.parse_args()
    root = args.root.resolve()
    bib_path = args.bib or root / "paper-source/sample-base.bib"
    records_path = args.records or root / "data/catalog-records.csv"
    benchmark_path = args.benchmarks or root / "data/benchmark-sources.csv"
    output = args.output or root / "site/data"
    downloads = args.downloads or root / "site/downloads"
    bib = parse_bib(read_text(bib_path))
    records = merge_records(read_rows(records_path), read_rows(args.verification, "\t") if args.verification else [])
    benchmark_rows = read_rows(benchmark_path)
    catalog = build_catalog(bib, records, args.search_cutoff)
    benchmarks = build_benchmarks(benchmark_rows, catalog)
    tax = taxonomy()
    validate_taxonomy(tax, bib)
    stats = build_stats(catalog, benchmarks)
    outputs = {"catalog.json": catalog, "benchmarks.json": benchmarks,
               "taxonomy.json": tax, "stats.json": stats}
    for name, obj in outputs.items(): write_json(output / name, obj)
    write_csv(downloads / "paper-catalog.csv", export_rows(catalog["papers"]), encoding="utf-8-sig")
    write_csv(downloads / "benchmark-catalog.csv", export_rows(benchmarks["benchmarks"]), encoding="utf-8-sig")
    if args.materialize_inputs:
        dest = root / "paper-source/sample-base.bib"
        dest.parent.mkdir(parents=True, exist_ok=True)
        if bib_path.resolve() != dest.resolve(): shutil.copyfile(bib_path, dest)
        write_csv(root / "data/catalog-records.csv", records)
        write_csv(root / "data/benchmark-sources.csv", benchmark_rows)
    print(json.dumps({"research": stats["research_records"], "official": stats["official_resources"],
                      "core_venues": stats["core_venue_records"], "benchmarks": stats["benchmarks"],
                      "outputs": list(outputs),
                      "csv_exports": ["paper-catalog.csv", "benchmark-catalog.csv"]}, indent=2))

if __name__ == "__main__":
    main()

