<p align="center">
  <img src="docs/assets/readme-cover.svg" alt="Face Fraud Atlas — evidence, identity, provenance, authorization" width="100%">
</p>

# Face Fraud Atlas

**An evidence-centered research companion for face fraud detection and digital financial security.**

### [Open the interactive website ↗](https://xukun12138.github.io/face-fraud-atlas/)

[Explore papers](https://xukun12138.github.io/face-fraud-atlas/#library) · [Compare benchmarks](https://xukun12138.github.io/face-fraud-atlas/#benchmarks) · [Use research tools](https://xukun12138.github.io/face-fraud-atlas/#tools) · [Get editable figures](https://xukun12138.github.io/face-fraud-atlas/#figures)

[中文说明](README.zh-CN.md) · [Data schema](docs/DATA_SCHEMA.md) · [Contributing](CONTRIBUTING.md) · [Project design](docs/PROJECT_DESIGN.zh-CN.md) · [Deployment](docs/DEPLOYMENT.zh-CN.md)

Face Fraud Atlas connects presentation attack detection, digital manipulation detection, identity morphing, recognition evasion, and media injection to financial verification workflows. It helps readers ask what a detector observes, what assertion that observation supports, and what remains to be established before authority is granted.

The organizing framework has four requirements: **media authenticity, identity consistency, capture and session provenance, and valid business authorization**. A visually authentic face, a correct identity match, and an authorized financial action require different evidence.

The website opens in **English and light mode**. Language and theme controls remember your explicit choices. All 141 research records include English contribution, limitation and evidence-scope notes. The layout keeps text readable on phones, expands scientific figures to their natural proportions, and keeps wide comparison tables inside their own scrolling area.

> **Research status:** this resource accompanies an anonymous research manuscript draft. The website is live on GitHub Pages; literature, benchmark definitions and analytical scenarios retain their source and scope notes.

## Explore the evidence

| Module | What you can do | How to interpret it |
| --- | --- | --- |
| **Paper explorer** | Search, filter by topic/year/publication form, inspect source links, and export a reading selection | Bibliographic verification does not imply uniform full-text reading; official resources are distinguishable from research publications |
| **Benchmark atlas** | Inspect dataset scale, modalities, versions, and protocols | Counts retain their original units; videos, images, face sequences, and channel streams are not pooled or ranked together |
| **Risk laboratory** | Explore prevalence, recall, false alarms, and expected alert composition | Transparent analytical scenarios; no uploaded faces, trained model, or detector inference |
| **Protocol builder** | Select a workflow, attack entry, and held-out factors; download a study design as JSON | Includes threshold, grouping, and event requirements; additional experiment-specific permissions must be specified before evaluation |
| **Figure gallery** | Inspect ten figures alongside source data and interpretation notes | Source-derived statistics are distinguished from schematic illustrations and analytical curves |
| **Research downloads** | Read the draft, inspect LaTeX and bibliography, and reuse the figure workflow subject to its rights | Original sources remain the authority for cited research and dataset access |

### Curated collection

The collection contains **141 research publications and 12 official resources**: 153 catalog records in total. The companion also provides **12 benchmark records and 10 editable research figures**. These are different collections; benchmark and figure counts are not additional publication counts. Bibliographic and benchmark provenance is included with the research materials. Future changes should update the generated statistics from the source records.

The catalog is a selective, source-checked collection. It is not an exhaustive census, a citation-ranking service, or evidence that every paper received the same depth of full-text analysis. Financial relevance distinguishes source-supported system evidence from an interpretation of how a general biometric or media method could transfer to finance.

## A useful reading route

1. **Start with the protected assertion.** Is the question about media alteration, enrollment identity, a fresh capture, or authorization of a particular action?
2. **Find comparable methods.** Filter publications by topic, year, and publication form; search their method notes. Inspect evidence, modality, and learning conditions before comparing headline results.
3. **Check the benchmark record.** Read its version, counting unit, split, and caveats. A larger collection does not establish a harder or more realistic financial threat model.
4. **Make the decision assumptions explicit.** Change the risk calculator's inputs, then inspect how prevalence, recall, and false-alarm rates affect the expected alert composition.
5. **Export a protocol and reading list.** Use the exported design as a starting point, and complete its attacker permissions, target-data access, and outcome denominators for your experiment.

## Run locally

The website is static HTML, CSS, JavaScript, and JSON. No npm packages or model downloads are required. With Python 3 installed, run the following from the repository root:

```sh
python scripts/build_catalog.py
python scripts/validate_site.py
python -m http.server 8765 --directory site
```

Open **http://localhost:8765/**. Use an HTTP server because the browser loads local JSON files. The interface is designed for desktop and mobile screens; deployment acceptance should include both widths and keyboard access.

## Research materials

| Material | Repository path |
| --- | --- |
| Anonymous manuscript PDF | [site/downloads/manuscript.pdf](site/downloads/manuscript.pdf) |
| Main LaTeX source | [site/downloads/manuscript.tex](site/downloads/manuscript.tex) |
| Bibliography | [site/downloads/sample-base.bib](site/downloads/sample-base.bib) |
| Complete LaTeX project | [site/downloads/latex-project.zip](site/downloads/latex-project.zip) |
| Figure data, editable sources, and provenance | [site/downloads/Figure_Data.zip](site/downloads/Figure_Data.zip) |
| Paper catalog CSV | [site/downloads/paper-catalog.csv](site/downloads/paper-catalog.csv) |
| Benchmark catalog CSV | [site/downloads/benchmark-catalog.csv](site/downloads/benchmark-catalog.csv) |

The bibliography used in the manuscript omits DOI and URL fields for its presentation format. The catalog and source notes retain source links so the underlying metadata can be checked. The website provides dataset descriptions and original-source pointers, rather than redistributing biometric datasets.

## Maintain the atlas

```text
data/                       Editable catalog and benchmark source tables
paper-source/               Manuscript bibliography and research sources
Figure_Data/                Editable figure materials and provenance
scripts/build_catalog.py    Source tables → browser-ready JSON
site/
  data/                     Generated collections, asset manifest, English reading notes
  assets/figures/            Website figure previews
  downloads/                Public research download bundle
docs/                       Design, schema, deployment, and cover asset
.github/                    Contribution forms and Pages workflow
```

Edit `data/catalog-records.csv`, `data/benchmark-sources.csv`, and the relevant research source files; regenerate the JSON and full catalog CSV downloads with `scripts/build_catalog.py`, then run `python scripts/validate_site.py`. Keep stable record IDs, cite the primary metadata source, and explain any version or unit change. The download manifest and research bundles are updated separately when affected. See [CONTRIBUTING.md](CONTRIBUTING.md) for the review process and [DATA_SCHEMA.md](docs/DATA_SCHEMA.md) for field semantics.

## Attribution and rights

Maintainer: **[xukun12138](https://github.com/xukun12138)**. Repository maintenance does not identify the authors of the anonymous manuscript.

The [MIT license](LICENSE) applies to this project's code. Manuscript text, research data compilations, figures, and third-party materials have separate rights; the code license does not grant rights to those materials. No blanket Creative Commons license is asserted for the manuscript or catalog. Preserve the license and attribution accompanying each third-party asset, and consult the original dataset or publication owner for reuse terms.

When using a method or dataset, cite its original publication. When referring to this evolving collection, identify the repository revision or release and the date consulted; do not describe the accompanying draft as a published CSUR article.

## Design references

The organizational design draws on the explicit evaluation structure of [DeepfakeBench](https://github.com/SCLBD/DeepfakeBench), the modality and learning-regime taxonomy of [DeepFAS](https://github.com/ZitongYu/DeepFAS), the operation-based curation of [Awesome Deepfake Generation and Detection](https://github.com/flyingby/Awesome-Deepfake-Generation-and-Detection), and the evidence-to-materials navigation of [Nerfies](https://nerfies.github.io/) and [SMERF](https://smerf-3d.github.io/). These are independent projects; their code and imagery have not been copied into this atlas.
