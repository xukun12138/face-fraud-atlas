"""Validate portable resources and scientific data boundaries, without networking."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'site'
errors = []

def require(condition, message):
    if not condition:
        errors.append(message)

def local_file(url, origin=SITE):
    split = urlsplit(url)
    if split.scheme or split.netloc or not split.path:
        return
    path = (origin / unquote(split.path)).resolve()
    require(path.is_relative_to(ROOT), f'Path leaves project: {url}')
    require(path.is_file(), f'Missing local resource: {url}')

class Links(HTMLParser):
    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        for attr in ('src','href'):
            if attr in values:
                local_file(values[attr])

Links().feed((SITE/'index.html').read_text(encoding='utf8'))
documents = {path.stem:json.loads(path.read_text(encoding='utf8')) for path in (SITE/'data').glob('*.json')}
papers=documents['catalog']['papers']
ids={paper['id'] for paper in papers}
require(len(ids)==len(papers), 'Duplicate literature IDs')
require(all(p['title'] and p['venue'] and p['source_url'] and p['bibtex'] for p in papers),'Incomplete source-backed metadata')
research=[p for p in papers if p['is_research']]
english_notes = documents.get('reading-notes.en', {})
require(english_notes.get('schema_version') == '1.0', 'Missing or unsupported English reading notes')
notes = english_notes.get('notes', {})
require(set(notes) == {p['id'] for p in research}, 'English reading-note IDs disagree with the research collection')
for paper_id, note in notes.items():
    require(all(isinstance(note.get(key), str) and note[key].strip()
                for key in ('contribution', 'limitations', 'evidence_note')),
            f'Incomplete English reading note: {paper_id}')
stats=documents['stats']
require(documents['catalog']['research_count']==len(research),'Research count disagreement')
require(documents['catalog']['official_count']==len(papers)-len(research),'Official count disagreement')
for scenario in documents['taxonomy']['scenarios']:
    # All nested citation arrays must resolve, independent of schema extensions.
    def visit(value, key=''):
        if isinstance(value,dict):
            for k,v in value.items(): visit(v,k)
        elif isinstance(value,list):
            if key in ('citations','references','source_ids'):
                for citation in value:
                    if isinstance(citation,str): require(citation in ids,f'Unknown taxonomy citation: {citation}')
            else:
                for v in value: visit(v,key)
    visit(scenario)
for benchmark in documents['benchmarks']['benchmarks']:
    require(benchmark['id'] in ids,f'Unknown benchmark citation: {benchmark["id"]}')
    require(benchmark.get('version') and benchmark.get('unit'),f'Missing counting context: {benchmark["id"]}')
for figure in documents['assets']['figures']:
    for ext in ('png','svg','pdf'): local_file(figure[ext])
    require(not any(figure.get(key) for key in ('source', 'source_folder', 'source_url')),
            f'Nonpublic figure source advertised: {figure["id"]}')
for item in documents['assets']['downloads']: local_file(item['href'])
for private_path in ('Figure_Data', 'site/downloads/manuscript.pdf',
                     'site/downloads/manuscript.tex', 'site/downloads/latex-project.zip',
                     'site/downloads/Figure_Data.zip'):
    require(not (ROOT/private_path).exists(), f'Nonpublic material present: {private_path}')
require(not any(path.is_symlink() for path in SITE.rglob('*')), 'Unexpected site symlink')
if errors:
    print('\n'.join(errors)); sys.exit(1)
print(f'Validated {len(papers)} literature records, {len(documents["benchmarks"]["benchmarks"])} benchmark records, public figure previews and every HTML/manifest resource; nonpublic materials absent.')
