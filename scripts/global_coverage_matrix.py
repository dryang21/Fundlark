"""Inspect research-field x region gaps without pretending generic programs cover every field."""
from __future__ import annotations
import json
from collections import Counter,defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
REG=ROOT/'data/global'
FIELDS={
'Computing and AI':['computer science','artificial intelligence','machine learning','robotics','natural language','AI safety','software','data science'],
'Medicine and health':['biomedicine','health','medicine','clinical','public health','cancer','radiotherapy'],
'Life sciences':['life science','biology','neuroscience','genomics','bioinformatics','molecular biology'],
'Engineering':['engineering','manufacturing','semiconductors','robotics','communications','transportation'],
'Physics/chemistry/materials':['physics','chemistry','materials','nanotechnology','quantum','photonics'],
'Climate and earth':['climate','earth science','geophysics','environment','conservation'],
'Mathematics/statistics':['mathematics','statistics','probability','statistics'],
'Social sciences':['social science','economics','psychology','policy','anthropology'],
'Humanities':['humanities','history','literature','linguistics','philosophy','archaeology'],
'Education':['education','pedagogy','learning sciences'],
'Agriculture':['agriculture','food security','crop','soil','agronomy'],
'Arts and design':['arts','design','music','film','creative'],
'Business/law/policy':['business','economics','law','legal','policy','management'],
}

def matrix(records):
    regions=sorted({x['country_or_region'] for x in records}|{'United States','Canada','United Kingdom','European Union','Australia','Hong Kong','Singapore','Japan','India','New Zealand','China','South Korea','International'})
    entries=[]
    for region in regions:
        subset=[x for x in records if x['country_or_region']==region]
        for field,terms in FIELDS.items():
            matched=[]
            for x in subset:
                topics=' '.join(str(t) for t in x.get('topics',[])).lower()
                if any(term.lower() in topics for term in terms):matched.append(x)
            entries.append({'region':region,'field':field,'program_family_records':len(matched),
                            'uncovered_in_curated_global_seed':len(matched)==0,
                            'status_note':'Zero means no curated topical program record, not no funding exists.'})
    return {'schema_version':1,'source':'program-registry global seed only','fields':list(FIELDS),
            'regions':regions,'matrix':entries}

def main():
    rec=json.loads((REG/'program-registry.json').read_text())['opportunities']
    m=matrix(rec)
    (REG/'research-field-region-matrix.json').write_text(json.dumps(m,indent=2)+'\n')
    missing=[x for x in m['matrix'] if x['uncovered_in_curated_global_seed']]
    lines=['# Field × region coverage gaps','',
           f'**{len(FIELDS)} research-field groups** × **{len(m["regions"])} regions** are checked against the additional program seed registry.',
           f'Cells with zero curated topical program families: **{len(missing)} of {len(m["matrix"])}**. These are discovery priorities, not claims that funding does not exist.','',
           '| Region | Indexed topical categories in new seed | Categories not covered in seed |','|---|---:|---:|']
    for region in m['regions']:
        entries=[x for x in m['matrix'] if x['region']==region]
        lines.append(f'| {region} | {sum(x["program_family_records"]>0 for x in entries)} | {sum(x["program_family_records"]==0 for x in entries)} |')
    lines+=['','All field assignment is a conservative literal-term heuristic. General/all-discipline funding is **not** automatically counted for each field. Explore official sources and review access rules before adding calls.']
    (ROOT/'docs/research/global-field-region-gaps.md').write_text('\n'.join(lines)+'\n')
    print(f'{len(FIELDS)} fields × {len(m["regions"])} regions; {len(missing)} zero/under-indexed cells')

if __name__=='__main__':main()
