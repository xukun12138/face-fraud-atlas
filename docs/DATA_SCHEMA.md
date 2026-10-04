# Face Fraud Atlas data contract

Schema version: **1.0**. All JSON is UTF-8. This document describes the current browser data and exports, not a claim that an evaluation has been completed. Changes to field semantics require synchronized builder, interface, export, validation, and documentation updates.

## Sources and generated collections

From the repository root, `python scripts/build_catalog.py` reads local, portable inputs: `data/catalog-records.csv`, `data/benchmark-sources.csv`, and `paper-source/sample-base.bib`. It uses the Python standard library and does not retrieve network data. It generates the catalog, benchmarks, taxonomy, and statistics JSON files and automatically synchronizes `site/downloads/paper-catalog.csv` and `site/downloads/benchmark-catalog.csv`. The figure/download manifest and research bundles are updated separately during release preparation. Run `python scripts/validate_site.py` after rebuilding to check resources and data boundaries; the Pages build runs the same validator. The initial import options are described by `python scripts/build_catalog.py --help`; ordinary maintenance uses the local inputs.

| File | Top-level collection | Meaning |
| --- | --- | --- |
| `site/data/catalog.json` | `papers: object[]` | Research publications **and** official resources; 153 initial records, with 141 research and 12 official |
| `site/data/benchmarks.json` | `benchmarks: object[]` | Twelve initial source-verified benchmark records, retaining original counting scopes |
| `site/data/taxonomy.json` | `claims: object[]`, `scenarios: object[]` | Four evidence requirements and research scenarios |
| `site/data/stats.json` | Aggregate fields and count maps | Descriptive statistics of this selected corpus |
| `site/data/assets.json` | `figures: object[]`, `downloads: object[]` | Display and download manifest, maintained alongside the corresponding files |

The catalog key `papers` is retained for the interface contract; it does not mean every record is a research paper. By default the explorer selects research only. IDs are stable and match the manuscript's bibliography where applicable. Unknown strings are empty; unknown numerical benchmark values are `null`. Zero is a genuine reported or derived zero, not a missing-value marker.

## Catalog envelope

| Field | Type | Meaning |
| --- | --- | --- |
| `schema_version` | string | Contract version |
| `search_cutoff` | date string, `YYYY-MM-DD` | Explicit curator-supplied retrieval cutoff for the collection, not a publication date or inferred build time |
| `research_count`, `official_count` | integer | Generated collection counts |
| `default_scope` | string | Currently `research` |
| `scope_note` | string | Selective retrieval and nonuniform reading-depth statement |
| `evidence_policy` | string | Meaning of financial-evidence annotations |
| `papers` | array of records | Catalog entries |

### Publication/resource record

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | nonempty unique string | Stable identifier and BibTeX key |
| `title` | string | Verified full title |
| `authors` | string array | Verified author names or issuing organization; not inferred from repository ownership |
| `venue` | string | Formal venue or official issuing source |
| `year` | integer | Formal publication year or stated resource year |
| `primary_role` | enum string | Main organizational role listed below |
| `publication_form` | enum string | Publication/resource status listed below |
| `core_venue` | boolean | Project-selected venue flag; not a universal ranking or method-quality score |
| `section` | string | Location in the companion manuscript's structure |
| `is_research` | boolean | `false` for official resources |
| `evidence_level` | enum string | Relationship to the verification problem, not study quality |
| `evidence_note` | string | Explanation of that relationship and reviewed financial-relevance note |
| `method` | string | Reviewed mechanism or evidence description |
| `contribution` | string | Reviewed contribution summary; empty when no supported annotation is available |
| `limitations` | string | Reviewed limitations; not an invented uniform evaluation result |
| `source_url` | string | Bibliographic verification pointer, sometimes a primary publisher/proceedings page or metadata service; not necessarily code or a model |
| `bibtex` | string | Verified entry copied from the local bibliography; no reconstructed author list |
| `publication_note` | string | Important version or publication-status qualification |

`primary_role` values: `PAD`, `digital`, `generation`, `morph`, `adversarial`, `systems/privacy`, `surveys`, `official`. They are the atlas's organizational choices; a cross-task contribution can be discussed in several places while retaining one primary role for counting.

`publication_form` values: `article`, `conference`, `workshop`, `chapter`, `preprint`, `official`. Main proceedings and workshops retain different status. Early-access publication with verified publisher metadata is a publication, not automatically a preprint. Do not replace the formal year with an earlier preprint year.

`evidence_level` values:

| Value | Interpretation |
| --- | --- |
| `direct-system` | Evaluates a configured verification system or attack chain; this label alone does not imply a bank deployment experiment |
| `identity-verification` | Remote identity-verification or related enrollment evidence |
| `component-transfer` | Component, biometric, media, or benchmark evidence requiring workflow validation for financial use |
| `context` | Survey, generation capability, governance, or supporting context |

Official resources are included as context and counted separately. The initial research-only evidence counts are 2 direct-system, 3 identity-verification, 104 component-transfer, and 32 context. These counts describe curation, not prevalence of fraud, model performance, or strength of assurance.

The current schema does not assert a per-record uniform full-text reading status. The global `scope_note` and the reviewed annotations make its reading-depth boundary explicit. Bibliographic verification does not mean every technical conclusion has been independently reproduced.

## Benchmark record

`benchmarks.json` also has `schema_version` and `scope_note`. Its array records are:

| Field | Type | Meaning |
| --- | --- | --- |
| `id`, `citekey` | string | Stable record ID and corresponding publication key |
| `name`, `dataset` | string | Dataset label used in the interface and source |
| `year` | integer | Year of the cited publication; a distinct introduction year can be in `additional_counts` |
| `version` | string | Release/publication counting scope |
| `identity_count` | integer or null | Identities under the stated `identity_scope` |
| `identity_scope` | string | What is counted: recorded subjects, benchmark identities, source actors, or another stated entity |
| `real_count` | integer or null | Bona fide or real-media count in the specified version/unit |
| `attack_count` | integer or null | Presentation-attack or manipulated-media count in that same scope |
| `total_count` | integer or null | Reported total for that scope; not silently reconciled with contradictory class counts |
| `unit` | enum string | The entity counted, listed below |
| `modalities` | string array | Observed channels, e.g. `RGB`, `Depth`, `NIR`, `Thermal`, `Audio` |
| `protocol` | string | Original split and evaluation protocol |
| `notes` | string array | Version qualifications, discrepancies, and limitations |
| `count_basis` | string | Definition of the counted collection |
| `derivation` | string | Explicit arithmetic, if used; otherwise a source-reported value |
| `source_url` | string | Original paper or authors' source |
| `source_location` | string | Page, table, section, or other precise extraction location |
| `verified_on` | date string | Source-check date |
| `count_discrepancy` | boolean | Whether reported quantities require an explicit discrepancy note |
| `additional_counts` | object of integers | Separately named auxiliary counts; not automatic additions to `total_count` |
| `evidence_level` | string | Currently component-level benchmark evidence |

Counting units include `video`, `video_stream`, `multichannel_video`, `image`, and `face_sequence`; `presentation` is reserved for an explicitly counted presentation event. A channel-stream count and a synchronized presentation count differ even when each presentation has the same number of channels. Unit labels are not independent-trial declarations.

Concrete invariants:

- OULU-NPU's `total_count=4950` is the PAD access subset; `additional_counts` separately preserves the 990 enrollment recordings and the full original total of 5940.
- SiW retains the original paper's 4620 videos, rather than replacing that count with a different release.
- SiW-M preserves `total_count=1630` alongside `real_count=660` and `attack_count=968`; `count_discrepancy=true` explains the 1628 class sum. An unconditional `real + attack == total` assertion would erase the source discrepancy.
- WMCA retains the paper's 1679 multichannel recordings. Later expanded web releases are not combined with it.
- CASIA-SURF and CeFA count channel streams in their main scale fields and retain presentation counts separately.
- CelebA-Spoof has a verified total and identity count; exact class counts remain `null` because rounded class shares do not support exact integers.
- DFDC distinguishes the benchmark's 960 identities from a larger acquisition pool, and marks the real-media class count as an arithmetic derivation where appropriate.

Never sum counts across different units or versions, rank method quality by collection size, or treat all frames from one recording as independent statistical trials. `additional_counts` requires its named scope and notes; it is not a list of numbers to sum.

## Taxonomy and scenarios

Both collections are descriptive research synthesis. They do not encode independent probability scores.

| Collection | Fields |
| --- | --- |
| `claims` | `id`, `label`, `title`, `description`, `source_keys: string[]` |
| `scenarios` | `id`, `label`, `title`, `description`, `entry`, `production`, `reference_risk`, `claims: string[]`, `source_keys: string[]` |

Claim IDs are `media`, `identity`, `capture`, `authorization`, corresponding to media authenticity, identity consistency, capture/session provenance, and valid business authorization. `scenario.claims` identifies relevant assertions to check; it does **not** say all of them necessarily fail in that scenario. `source_keys` refers to existing catalog IDs. `entry` and `production` are separate axes: the delivery path is not the media-generation operation.

## Corpus statistics

`stats.json` contains `schema_version`, `search_cutoff`, `total_records`, `research_records`, `official_resources`, `benchmarks`, `core_venue_records`, `core_venue_percent`, `preprint_records`, `preprint_percent`, `preprint_ids`, `workshop_ids`, `chapter_ids`, `role_order`, `role_counts`, `year_counts`, `publication_form_counts`, `evidence_level_counts`, `counting_note`, and `core_venue_note`.

The role/year/publication/evidence maps and core/preprint percentages use **research records** as the denominator. `total_records` additionally includes official resources. The core-venue flag reflects the project's stated selection and preserves publication form. No field is a citation count, detector score, financial-loss estimate, or field-wide research census.

## Figure and download manifest

`assets.json` has `schema_version`, `figures`, and `downloads`. Local preview and download paths are relative to the served `site/` root, not to the domain root. A manifest entry must not advertise an absent file. Figure previews are under `assets/figures/`, and public research files are under `downloads/`.

| Figure field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Stable figure identifier, e.g. `Fig6` |
| `title`, `title_zh` | string | English and Chinese titles consistent with the actual figure |
| `data_type` | string | Current values: `conceptual`, `catalog-derived`, `source-derived`, `analytical scenarios` |
| `description` | string | Interpretation and editable-material note |
| `png`, `pdf`, `svg` | string | Local display/export paths |
| `source` | URL string | Intended public repository-tree link to the editable figure folder |
| `source_folder` | string | Corresponding path under the **repository root**, e.g. `Figure_Data/Fig6_Benchmarks`; not a path served under `site/` |

Each download record has `id`, `title`, and `href`; `href` is relative to `site/`. The initial manifest contains six material links, while the repository also includes `downloads/manuscript.tex` as a directly accessible source file. PNG/PDF/SVG are display/export formats; source materials must also retain data and provenance. The current ten-figure collection is not a hardcoded limit. Repository-tree links become public only when that repository is published; their presence in the manifest does not demonstrate a live deployment.

The interface can additionally consume `alt`, legacy `image`, or equivalent format links grouped in `files`. Those compatibility keys are optional and are not claimed to be present in every current record.

Interpretation notes must distinguish source-derived statistics, analytical scenarios, and schematic illustrations. Do not label synthetic feature patterns as model outputs or analytical curves as performance measurements. Material rights are separate from the code license; keep any per-asset third-party license and attribution.

## Explorer exports

The browser CSV exports the current filtered selection, with columns `id`, `title`, `authors`, `venue`, `year`, `primary_role`, `publication_form`, `core_venue`, `is_research`, `evidence_level`, `source_url`. Multiple authors are joined with semicolons. The BibTeX export copies the selected records' stored `bibtex` entries; it does not guess missing metadata. With official resources hidden by default, initial exports contain research only; choosing official inclusion changes their scope.

The builder-generated repository CSVs contain every field of each catalog or benchmark record, with UTF-8 BOM encoding. Arrays and objects are serialized as JSON cells, booleans as lowercase `true`/`false`, and `null` as an empty cell. They are automatically refreshed by the build command and are distinct from the browser's filtered reading selection. Edit the canonical `data/` input CSVs rather than these downloads. Quote CSV strings correctly and preserve Unicode titles and names.

`python scripts/validate_site.py` checks the portable site without network access. `scripts/validate_release.py` is an optional check of the initial release's reviewed counts; it is not run by the general Pages workflow and should not prevent future source-checked additions. Use `--search-cutoff YYYY-MM-DD` when intentionally changing the declared retrieval cutoff.

## Analytical calculator

Current inputs are `prevalence`, `recall`, and `fpr` as **percentages in [0,100]**, plus `sessions` as an integer in [1,10^12]. The calculator converts percentages to probabilities internally. It does not estimate these inputs from media.

For `N=sessions`, `pi=prevalence/100`, `t=recall/100`, and `f=fpr/100`:

```text
TP = N*pi*t                 FP = N*(1-pi)*f
FN = N*pi*(1-t)             TN = N*(1-pi)*(1-f)
PPV = TP/(TP+FP), if TP+FP > 0
```

PPV is undefined when there are no expected alerts. Counts are expectations and may be fractional. Inputs are hypothetical; results are neither bank incident measurements nor the performance of a reviewed model. Positive events and their population must be defined for an experiment; manipulated media and unauthorized workflow events are different classes. The current calculator does not implement detector inference, repeated-attempt models, confidence-bound estimation, or cost optimization.

## Protocol-design export

Download filename: `face-fraud-protocol-design.json`. This export is created in the browser and is a study-design artifact.

| Field | Type / current value | Meaning |
| --- | --- | --- |
| `schema_version` | string, `1.0` | Export version |
| `exported_at` | ISO datetime string | Browser export timestamp, not evidence of completed evaluation |
| `status` | `study_design_not_completed_evaluation` | Explicit planning status |
| `protected_workflow` | string | Selected workflow or `unspecified` |
| `attacker_entry` | string | Selected entry or `unspecified` |
| `held_out_axes` | unique string array | Selected `identity`, `source`, `generator`, `device`, `time` factors |
| `validated_threshold_assumptions` | object | Requirements pending independent validation, described below |
| `grouping_requirements` | string array | Source-family grouping, adaptation/calibration separation, acquisition/reference/challenge/permission disclosure |
| `event_requirements` | string array | Same-event checks, account/action binding, final outcomes and review/fallback recording |
| `interpretation` | string | Design is not automated evaluation or deployment evidence |

Despite its compatibility-preserved name, `validated_threshold_assumptions` does **not** assert validated assumptions. It explicitly contains `status: requires_independent_validation`, `choose_threshold_on_validation_only: true`, `freeze_before_test: true`, `reuse_test_data_for_calibration: false`, `numerical_inputs_are_hypothetical: true`, `uncertainty_unit: independent_identity_or_session_as_appropriate`, and `proposed_operating_point` as the current numerical input object or `null` for invalid inputs.

An exported design still needs experiment-specific media operations, attacker and defender permissions, modalities, trusted references, data access, metrics and denominators, retry policy, and final business outcomes. Selecting a held-out axis does not prove it has been isolated in an actual dataset. Do not use the export as a compliance certificate, completed benchmark result, or validated threshold.
