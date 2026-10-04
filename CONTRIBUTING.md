# Contributing to Face Fraud Atlas

Contributions should make a research claim easier to inspect, compare, or reproduce. A useful addition includes its primary source, its evaluation conditions, and a clear account of what it does and does not demonstrate.

The project accompanies an anonymous manuscript draft. Do not add inferred author identities, affiliations, acceptance claims, or publication badges. The repository maintainer is `xukun12138`; maintenance is separate from manuscript authorship.

## Choose a contribution

- **Add a paper or official resource:** use the [add-paper issue form](.github/ISSUE_TEMPLATE/add-paper.yml), or submit a pull request with the source record and supporting evidence.
- **Correct a record, count, or interpretation:** use the [data-correction form](.github/ISSUE_TEMPLATE/data-correction.yml). Identify the record ID, field, current value, proposed value, and source location.
- **Improve the interface or documentation:** describe the reader's task and the observed behavior. Include the viewport or keyboard steps for an interface issue.
- **Improve a figure or analytical tool:** preserve its input data, generation logic, assumptions, and explanatory label. Separate measured facts from calculated scenarios and illustrations.

You do not need a pull request to report an uncertainty. A precise source-backed issue is valuable on its own.

## Evidence for bibliographic records

Use the publisher, official proceedings, original paper, or authors' dataset/project page whenever available. Secondary lists are useful for discovery; verify the bibliographic fields at the primary source before treating a record as checked.

For a new publication, provide the full title, authors, publication venue, formal publication year, publication type, and an accessible source pointer. Supply volume, issue, and pages only when supported. An accepted author manuscript without verified publication metadata remains labeled accordingly. A preprint date is not the year of a later proceedings publication. A workshop paper is not a main-conference paper.

Preserve the source wording for names and titles. If a proceedings site and publisher assign different page ranges, identify which edition the record represents rather than silently combining both. Bibliographic verification does not imply uniform full-text reading. State the supported evidence in `evidence_note` and preserve the collection's reading and evidence scope in `scope_note` and `evidence_policy`; do not infer a per-paper full-text reading status.

Method notes should summarize the mechanism in your own words. Record relevant prerequisites: input modality, clip duration, trusted reference, auxiliary labels, pretraining, target-domain access, or access to an analysis model. Do not invent performance numbers or universal experimental conclusions.

Financial relevance must distinguish direct financial-system evidence from remote identity-verification research and a reasoned transfer from general benchmarks. Describe the protected component or assertion. A media classifier's score is not a measured fraud-loss reduction or proof of business authorization.

## Evidence for benchmark records

Every count needs a **version, unit, and source location**. Keep missing values empty in CSV and `null` in generated JSON; zero means an observed zero, not unavailable information. Never recover exact class counts from a rounded percentage.

Examples of distinctions to preserve:

- OULU-NPU access recordings and enrollment recordings are separate counting scopes.
- A multichannel presentation can yield several channel streams; CASIA-SURF and CeFA stream counts are not presentation counts.
- The WMCA paper's collection and an expanded website release must not be merged.
- SiW's original-paper count and later releases may differ. SiW-M's reported total and class-count sum contain a documented discrepancy; preserve both with an explanation.
- Captured actors, benchmark identities, source videos, manipulated variants, frames, and face sequences describe different entities.

Do not sum or rank incompatible units. Dataset size does not establish model quality, demographic fairness, attack realism, or validity for a particular bank workflow. Protocol and modality fields must describe the specific version counted.

## Edit and regenerate

1. Update `data/catalog-records.csv`, `data/benchmark-sources.csv`, or the relevant original source file. Keep existing IDs stable; reuse the publication's existing record if adding a newer verified version rather than creating a duplicate by default.
2. Update the bibliography in `paper-source/` if bibliographic fields change. The manuscript's bibliography intentionally omits external-link fields; preserve provenance in the catalog and audit materials.
3. Run `python scripts/build_catalog.py` from the repository root. Review the four generated `site/data/` JSON files and automatically synchronized full catalog CSV downloads. Refresh the figure/download manifest and research bundles separately when affected. Do not edit exported CSVs as source data or hand-edit generated statistics to conceal a mismatch.
4. Run `python scripts/validate_site.py`, then preview with `python -m http.server 8765 --directory site`. Check that the record appears in search and relevant filters, that its source opens correctly, and that exported fields preserve its semantics.
5. In the pull request, explain the correction, cite its primary evidence and location, and state which generated or downloadable files changed.

See [DATA_SCHEMA.md](docs/DATA_SCHEMA.md) for collection and field semantics. A schema change also needs corresponding reader, export, validation, and documentation changes.

## Analytical and protocol tools

Calculator inputs are user-supplied scenarios. Label the positive event, denominator, units, and independence assumptions. Repeated-attempt calculations using `1 - (1 - p)^k` require independent attempts with the same per-attempt success probability. Products across a workflow require conditional stage probabilities for that chain, unless independence is separately justified. Expected cost should use mutually exclusive final outcomes rather than count the same error at several intermediate gates.

Protocol exports should declare attack entry and media operation separately, attacker permissions, defender observations, trusted references, training and target-data access, split isolation, threshold selection, session outcome, and retry policy. Do not turn an incomplete protocol into a claim of compliance or certification.

## Rights and review

Submit only material you are entitled to contribute. Link to original biometric datasets and publications rather than uploading their images, videos, PDFs, or restricted files. Preserve third-party asset notices. The repository's MIT license covers code; it does not assign a new license to manuscript text, research data compilations, or external material.

Maintainer review checks the evidence, counting semantics, scope of the claim, and consistency with the generated site. A contribution can remain unresolved when the available source does not determine a field. Acceptance into the catalog is curation, not peer review or endorsement of the method.
