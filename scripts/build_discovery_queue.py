"""Generate transparent institution/company discovery queues, NOT funding listings."""
from __future__ import annotations
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/global'
INSTITUTIONS={
'United States':['Stanford University','Harvard University','Massachusetts Institute of Technology','University of California Berkeley','University of California Los Angeles','University of California San Diego','University of California San Francisco','California Institute of Technology','Princeton University','Yale University','Columbia University','University of Pennsylvania','Cornell University','Duke University','Northwestern University','University of Chicago','University of Washington','University of Michigan','Johns Hopkins University','Carnegie Mellon University','Georgia Institute of Technology','University of Texas at Austin','Rice University','Brown University','New York University','University of Wisconsin Madison','University of North Carolina Chapel Hill','University of California Davis','University of Illinois Urbana-Champaign','University of Maryland'],
'United Kingdom':['University of Oxford','University of Cambridge','Imperial College London','University College London','King’s College London','University of Edinburgh','University of Manchester','University of Bristol','University of Warwick','University of Glasgow','University of Birmingham','University of Southampton','University of Leeds','University of Sheffield'],
'Canada':['University of Toronto','University of British Columbia','McGill University','University of Waterloo','University of Alberta','McMaster University','Université de Montréal','University of Ottawa','University of Calgary','Queen’s University'],
'Australia':['University of Melbourne','University of Sydney','Australian National University','UNSW Sydney','Monash University','University of Queensland','University of Adelaide','University of Western Australia','University of Technology Sydney','RMIT University','Macquarie University'],
'New Zealand':['University of Auckland','University of Otago','Victoria University of Wellington','University of Canterbury'],
'Hong Kong':['University of Hong Kong','Chinese University of Hong Kong','Hong Kong University of Science and Technology','City University of Hong Kong','Hong Kong Polytechnic University','Hong Kong Baptist University','Lingnan University','Education University of Hong Kong'],
'Singapore':['National University of Singapore','Nanyang Technological University','Singapore Management University','Singapore University of Technology and Design','Singapore Institute of Technology','Duke-NUS Medical School','A*STAR research institutes'],
'China':['Tsinghua University','Peking University','Fudan University','Shanghai Jiao Tong University','Zhejiang University','University of Science and Technology of China','Nanjing University'],
'Japan':['University of Tokyo','Kyoto University','Osaka University','Tohoku University','Tokyo Institute of Science','Nagoya University','RIKEN research centers'],
'South Korea':['Seoul National University','KAIST','POSTECH','Yonsei University','Korea University'],
'Taiwan':['National Taiwan University','National Tsing Hua University','National Yang Ming Chiao Tung University'],
'India':['Indian Institute of Science','IIT Bombay','IIT Delhi','IIT Madras','IIT Kanpur','IIT Kharagpur','University of Delhi'],
'Germany':['Technical University of Munich','Ludwig Maximilian University of Munich','Heidelberg University','RWTH Aachen University','Humboldt University of Berlin','Freie Universität Berlin','University of Freiburg','University of Bonn','University of Göttingen','Max Planck institutes'],
'France':['PSL University','Sorbonne University','Université Paris-Saclay','École Polytechnique','Sciences Po','CNRS research institutes'],
'Netherlands':['Delft University of Technology','University of Amsterdam','Leiden University','Utrecht University','Wageningen University & Research','Erasmus University Rotterdam'],
'Switzerland':['ETH Zurich','École Polytechnique Fédérale de Lausanne','University of Zurich','University of Geneva','University of Basel'],
'Sweden':['Karolinska Institutet','KTH Royal Institute of Technology','Lund University','Uppsala University','Chalmers University of Technology'],
'Denmark':['University of Copenhagen','Technical University of Denmark','Aarhus University'],
'Norway':['University of Oslo','Norwegian University of Science and Technology','University of Bergen'],
'Finland':['University of Helsinki','Aalto University','University of Turku'],
'Austria':['University of Vienna','Vienna University of Technology','Medical University of Vienna'],
'Belgium':['KU Leuven','Ghent University','Université catholique de Louvain'],
'Italy':['University of Bologna','Politecnico di Milano','Sapienza University of Rome','Scuola Normale Superiore'],
'Spain':['University of Barcelona','Autonomous University of Barcelona','Complutense University of Madrid','Polytechnic University of Madrid'],
'Ireland':['Trinity College Dublin','University College Dublin'],
'Brazil':['University of São Paulo','University of Campinas','Federal University of Rio de Janeiro'],
'South Africa':['University of Cape Town','University of the Witwatersrand','Stellenbosch University'],
'Israel':['Hebrew University of Jerusalem','Technion – Israel Institute of Technology','Weizmann Institute of Science','Tel Aviv University'],
'United Arab Emirates':['Khalifa University','Mohamed bin Zayed University of Artificial Intelligence','New York University Abu Dhabi'],
}
COMPANIES={
'AI & cloud':['OpenAI','Anthropic','Google DeepMind','Google Research','Microsoft Research','Meta AI','Amazon Science','NVIDIA','AWS','IBM Research','Apple Machine Learning Research','Salesforce Research','Adobe Research','Databricks','Cohere','Hugging Face','AI2 (Allen Institute for AI)','Tencent AI Lab','Baidu Research','Alibaba DAMO Academy','Huawei Research','ByteDance Research','Samsung AI Research','Sony AI','Oracle','SAP','ServiceNow Research','Snowflake','Cloudflare','Cisco Research','MongoDB'],
'Semiconductors & hardware':['Intel','AMD','Qualcomm','TSMC','ASML','Broadcom','Arm','Micron','Texas Instruments','Applied Materials','Lam Research','KLA'],
'Biopharma & healthcare':['Pfizer','AstraZeneca','Roche','Novartis','Merck & Co.','GSK','Moderna','Bristol Myers Squibb','Eli Lilly','Bayer','Sanofi','Johnson & Johnson','AbbVie','Amgen','Regeneron','Genentech','BioNTech','Takeda','Siemens Healthineers','GE HealthCare','Philips','Medtronic','Elekta','Varian','Thermo Fisher Scientific','Illumina','Abbott'],
'Energy, mobility & manufacturing':['Siemens','Bosch','Toyota','BMW','Volkswagen','Shell','BP','TotalEnergies','ExxonMobil','Schneider Electric','ABB','Hitachi','Panasonic','Airbus','Boeing','Rolls-Royce','General Electric','Autodesk'],
'Finance & communications':['Bloomberg','JPMorgan Chase','Goldman Sachs','Visa','Mastercard','AT&T','Verizon','Ericsson','Nokia'],
}

def main():
    institutions=[]
    for region,names in INSTITUTIONS.items():
        for name in names:
            institutions.append({'name':name,'country_or_region':region,'type':'university_or_research_institution',
                'discovery_status':'not_yet_verified','internal_opportunities_indexed':False,
                'next_action':'Find official university research office internal grants, student funding, seed schemes and foundation relations pages; confirm whether a campus login is required.',
                'official_funding_page':None,'specific_programs':[]})
    industry=[]
    for segment,names in COMPANIES.items():
        for name in names:
            industry.append({'name':name,'segment':segment,'discovery_status':'not_yet_verified',
                'funding_program_confirmed':False,'official_funding_page':None,
                'next_action':'Check for active academic research awards, grants, fellowships, sponsorships, credits, datasets, and joint investigator programs. Do not count as an opportunity until confirmed.'})
    for name,entries in [('institution-discovery-queue.json',institutions),('industry-discovery-queue.json',industry)]:
        (OUT/name).write_text(json.dumps({'schema_version':1,'description':'Discovery targets only. These are NOT indexed funding opportunities or verified sponsors of current calls.','entries':entries},indent=2,ensure_ascii=False)+'\n')
    print(f'Created {len(institutions)} institution targets and {len(industry)} industry targets; no claims of current funding.')

if __name__=='__main__':main()
