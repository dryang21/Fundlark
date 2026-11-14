import json, urllib.request, pathlib, argparse
root=pathlib.Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description='Simulate Fundlark users with fictional CV fixtures on local Ollama.')
parser.add_argument('--model',default='qwen3.8:27b')
parser.add_argument('--phase',choices=('before','after'),default='after')
args=parser.parse_args()
workflows={
'before':'Type interests and optionally career stage and affiliations. Search a small static catalog, with official-source links or a copyable assistant request as fallback. A saved shortlist is available lower on the page. There is no CV import or return panel.',
'after':'Try an isolated AI faculty or coastal ecology example. Paste CV text or choose a TXT file; only checked suggestions are saved. PDF and Word need pasted text. Find funding in the same small catalog. For ecology, a catalog gap offers links to official ESA awards and Bristol sources; these do not establish eligibility. Save a lead and add a private next-step note. On the next visit, open the shortlist from a return panel showing changed details and listed deadlines in the next 30 days. These dates are from the catalog, not live checks or reminders.'
}
def review(case):
    cv=(root/'evals/cvs'/f'{case}.txt').read_text()
    prompt=f"""You are a researcher with limited CS knowledge, represented by this fictional CV:
{cv}
Review only the workflow below. Simulate first visit and return one week later. In 130 words or less describe one useful action, one remaining friction point and whether you would return. Do not claim you browsed; do not invent funding, notifications, or eligibility.
Workflow: {workflows[args.phase]}"""
    body=json.dumps(dict(model=args.model,prompt=prompt,stream=False,think=False,keep_alive='5m',options=dict(num_predict=280,temperature=0.3))).encode()
    with urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:11434/api/generate',data=body,headers={'Content-Type':'application/json'}),timeout=160) as response: result=json.load(response)
    return {'case':case,'phase':args.phase,'model':result.get('model'),'feedback':result.get('response',''),'done_reason':result.get('done_reason')}
for case in ('computing-faculty','coastal-ecology','medical-physics'):
    try: print(json.dumps(review(case)),flush=True)
    except Exception as exc: print(json.dumps({'case':case,'error':str(exc)}),flush=True)
