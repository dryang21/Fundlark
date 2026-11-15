"""Build a navigational directory of official funder sites (NOT verified open awards).

All URL endpoints are official organizations; directory inclusion is not a funding
eligibility or current-call claim. Owners should recheck links periodically.
"""
import json
from pathlib import Path

# id | name | region | kind | fields (comma separated) | official URL | description
RAW = '''
us-grants|Simpler.Grants.gov|United States|Government|all|https://simpler.grants.gov/search|Cross-agency federal grant search; verify applicant type and deadlines
us-nsf|U.S. National Science Foundation|United States|Government|computing,engineering,physical,climate,math,social,education,life|https://www.nsf.gov/funding|Research grants, fellowships and solicitations across NSF directorates
us-nih|National Institutes of Health|United States|Government|medicine,life,social,computing|https://www.grants.nih.gov/funding/explore-nih-opportunities|Search biomedical and health funding via NIH filters to Grants.gov
us-neh|National Endowment for the Humanities|United States|Government|humanities,arts,education|https://www.neh.gov/grants|Humanities research, fellowships, education, infrastructure and organizations
us-nea|National Endowment for the Arts|United States|Government|arts,humanities,education|https://www.arts.gov/grants|Arts program opportunities, many intended for organizations rather than individuals
us-usda|USDA National Institute of Food and Agriculture|United States|Government|agriculture,life,climate,education|https://www.nifa.usda.gov/grants/funding-opportunities|Agriculture, food systems, rural research and education
us-doe|Department of Energy Office of Science|United States|Government|physical,engineering,climate,computing,math|https://www.energy.gov/science/office-science-funding-opportunities|Energy, physical sciences and basic science announcements
us-nasa|NASA NSPIRES|United States|Government|physical,engineering,climate,computing,math|https://nspires.nasaprs.com/external/|Space science and aeronautics research solicitations
us-epa|Environmental Protection Agency Grants|United States|Government|climate,medicine,agriculture,social|https://www.epa.gov/grants|Environmental research, environmental health and related grants
us-cdmrp|Congressionally Directed Medical Research Programs|United States|Government|medicine,life,engineering|https://cdmrp.health.mil/funding/|U.S. defense-sponsored health research competitions
us-ed-ies|Institute of Education Sciences|United States|Government|education,social,math,computing|https://ies.ed.gov/funding|Education science and evaluation funding
us-doe-arpae|ARPA-E|United States|Government|engineering,climate,physical,business|https://arpa-e.energy.gov/|High-impact energy research and technological innovation
us-noaa|NOAA|United States|Government|climate,life,agriculture,physical|https://www.noaa.gov/|Ocean, weather and climate agency; search program funding pages
us-fulbright|Fulbright Scholar Program|United States|Government|all|https://fulbrightscholars.org/|International scholarship and research exchanges; citizenship rules vary
us-nea-state|National Assembly of State Arts Agencies|United States|Society|arts,humanities|https://nasaa-arts.org/|Directory and information on state arts agencies and funding
uk-ukri|UK Research and Innovation Funding Finder|United Kingdom|Government|all|https://www.ukri.org/opportunity/|All UKRI councils and Innovate UK open and upcoming calls
uk-mrc|Medical Research Council|United Kingdom|Government|medicine,life|https://www.ukri.org/councils/mrc/|Medical research programmes and fellowships through UKRI
uk-esrc|Economic and Social Research Council|United Kingdom|Government|social,education,business|https://www.ukri.org/councils/esrc/|Social sciences and interdisciplinary research
uk-ahrc|Arts and Humanities Research Council|United Kingdom|Government|humanities,arts,social|https://www.ukri.org/councils/ahrc/|Arts and humanities research through UKRI
uk-epsrc|Engineering and Physical Sciences Research Council|United Kingdom|Government|engineering,physical,computing,math|https://www.ukri.org/councils/epsrc/|Engineering, physical sciences, computing and mathematics
uk-nerc|Natural Environment Research Council|United Kingdom|Government|climate,life,physical|https://www.ukri.org/councils/nerc/|Natural environment, climate and earth research
uk-bbsrc|Biotechnology and Biological Sciences Research Council|United Kingdom|Government|life,agriculture|https://www.ukri.org/councils/bbsrc/|Biosciences and agricultural biotechnology
uk-innovate|Innovate UK|United Kingdom|Government|engineering,computing,business,climate|https://www.ukri.org/councils/innovate-uk/|Innovation and industrial research partnerships
uk-wellcome|Wellcome Funding|United Kingdom|Foundation|medicine,life,social,humanities,climate|https://wellcome.org/research-funding|Health research and interdisciplinary early career schemes
uk-britacad|British Academy Funding|United Kingdom|Society|humanities,social,business,education|https://www.thebritishacademy.ac.uk/funding/|Humanities and social science funding and fellowships
uk-royalsociety|Royal Society Grants|United Kingdom|Society|physical,life,math,engineering,computing|https://royalsociety.org/grants/|Science research support and early-career fellowships
uk-leverhulme|Leverhulme Trust|United Kingdom|Foundation|all|https://www.leverhulme.ac.uk/|Research fellowships and grants across disciplines
uk-royal-acad-eng|Royal Academy of Engineering|United Kingdom|Society|engineering,computing,business|https://raeng.org.uk/|Engineering research, innovation and early-career programmes
eu-portal|EU Funding & Tenders Portal|Europe / EU|Government|all|https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/home|EU funding calls, research grants, partnerships and tenders
eu-erc|European Research Council|Europe / EU|Government|all|https://erc.europa.eu/|Starting, Consolidator and Advanced Grants for frontier research
eu-msca|Marie Skłodowska-Curie Actions|Europe / EU|Government|all|https://marie-sklodowska-curie-actions.ec.europa.eu/|Doctoral, postdoctoral and researcher-mobility programmes
eu-cost|COST European Cooperation in Science and Technology|Europe / EU|Government|all|https://www.cost.eu/|Research networks and collaborative activities; not a substitute for research project grants
eu-eit|European Institute of Innovation and Technology|Europe / EU|Government|engineering,computing,climate,medicine,business|https://eit.europa.eu/|Knowledge-innovation communities and innovation funding
de-dfg|German Research Foundation (DFG)|Germany|Government|all|https://www.dfg.de/en/research-funding/funding-opportunities/programmes|Research projects, individual investigator and early-career programmes
ch-snsf|Swiss National Science Foundation|Switzerland|Government|all|https://www.snf.ch/en|Swiss research grants and fellowships
fr-anr|French National Research Agency|France|Government|all|https://anr.fr/en/|French national calls and research partnerships
ca-calendar|Canada Tri-Agency Funding Calendar|Canada|Government|all|https://www.canada.ca/en/research-coordinating-committee/program-calendar.html|CIHR, NSERC, SSHRC and CFI upcoming opportunities
ca-cihr|Canadian Institutes of Health Research|Canada|Government|medicine,life,social|https://cihr-irsc.gc.ca/e/193.html|Health research awards and funding programmes
ca-nserc|Natural Sciences and Engineering Research Council|Canada|Government|engineering,physical,computing,math,life,climate|https://www.nserc-crsng.gc.ca/|Natural sciences, engineering, research partnerships and trainees
ca-sshrc|Social Sciences and Humanities Research Council|Canada|Government|social,humanities,education,arts,business|https://www.sshrc-crsh.gc.ca/|Humanities, social science and education awards
ca-mitacs|Mitacs|Canada|Foundation|engineering,computing,life,business,social|https://www.mitacs.ca/|Innovation internships and research partnerships
au-arc|Australian Research Council|Australia|Government|all|https://www.arc.gov.au/funding-and-research|Discovery and Linkage grants; ARC excludes medical research in core NCGP
au-nhmrc|National Health and Medical Research Council|Australia|Government|medicine,life|https://www.nhmrc.gov.au/funding|Australian health and medical research grants
nz-mbie|New Zealand Ministry of Business, Innovation and Employment|New Zealand|Government|all|https://www.mbie.govt.nz/science-and-technology/science-and-innovation/|New Zealand research and innovation portfolio
jp-jsps|Japan Society for the Promotion of Science|Japan|Government|all|https://www.jsps.go.jp/english/|Japanese scientific research and international fellowship programs
sg-nrf|National Research Foundation Singapore|Singapore|Government|all|https://www.nrf.gov.sg/|Research and innovation initiatives in Singapore
in-dst|India Department of Science and Technology|India|Government|engineering,physical,life,computing,climate|https://dst.gov.in/|Research initiatives and national funding programs
br-fapesp|São Paulo Research Foundation (FAPESP)|Brazil|Government|all|https://fapesp.br/calls|State-level grant calls including young investigators, collaboration and disciplinary awards
za-nrf|South African National Research Foundation|South Africa|Government|all|https://www.nrf.ac.za/funding/|Research funding programmes, fellowships, chairs and collaborative calls
cn-nsfc|National Natural Science Foundation of China|China|Government|life,medicine,physical,engineering,math,computing,climate|https://www.nsfc.gov.cn/english/site_1/index.html|Research, early investigator, international scientist and collaboration programmes
es-aei|Spanish State Research Agency (AEI)|Spain|Government|all|https://www.aei.gob.es/convocatorias/buscador-convocatorias|Spanish national research and early-career fellowship application calls
nl-nwo|Dutch Research Council (NWO)|Netherlands|Government|all|https://www.nwo.nl/en|Dutch researcher and science funding programmes
at-fwf|Austrian Science Fund (FWF)|Austria|Government|all|https://www.fwf.ac.at/en/|Austrian basic science project grants and career programmes
intl-twas|The World Academy of Sciences|International|Society|life,physical,math,engineering,computing,agriculture|https://twas.org/opportunities|Funding, training and international fellowships for scientists in the Global South
kr-nrf|National Research Foundation of Korea|South Korea|Government|all|https://www.nrf.re.kr/eng/|National research fellowships and academic programmes in South Korea
chile-anid|National Agency for Research and Development (ANID)|Chile|Government|all|https://anid.cl/|Chile research funding, doctoral, postdoctoral and international calls
ca-cfi|Canada Foundation for Innovation|Canada|Foundation|medicine,life,physical,engineering,computing,climate|https://www.innovation.ca/|Research equipment and institutional infrastructure programmes
intl-hfsp|Human Frontier Science Program|International|Foundation|life,medicine,physical,computing|https://www.hfsp.org/funding|International fundamental life-science research and fellowships
intl-embo|EMBO|International|Society|life,medicine|https://www.embo.org/funding/|Molecular biology fellowships and collaborative research support
intl-icgeb|International Centre for Genetic Engineering and Biotechnology|International|Government|life,medicine,agriculture|https://www.icgeb.org/|Biotechnology training and international collaboration
f-simons|Simons Foundation|International|Foundation|math,physical,life,computing|https://www.simonsfoundation.org/funding-opportunities/|Mathematics, theoretical science, life science, autism and research funding
f-sloan|Alfred P. Sloan Foundation|United States|Foundation|math,physical,computing,business,social,climate|https://sloan.org/grants|Science, technology, economics, and early-career awards
f-spencer|Spencer Foundation|United States|Foundation|education,social,humanities|https://www.spencer.org/grant_types|Education research grant programs and fellowships
f-mellon|Mellon Foundation|United States|Foundation|humanities,arts,education,social|https://www.mellon.org/grants|Humanities, culture, arts and higher education funding
f-templeton|John Templeton Foundation|International|Foundation|physical,life,humanities,social|https://www.templeton.org/grants|Research in science, philosophy and interdisciplinary inquiry
f-gates|Gates Foundation|International|Foundation|medicine,life,agriculture,education,social|https://www.gatesfoundation.org/about/how-we-work/grant-opportunities|Global health and development grant opportunity announcements
f-czi|Chan Zuckerberg Initiative|United States|Foundation|life,medicine,computing,education|https://chanzuckerberg.com/science/|Science and biomedical research programmes
f-aha|American Heart Association Funding|United States|Society|medicine,life,computing|https://professional.heart.org/en/research-programs/aha-funding-opportunities|Cardiovascular and related health research funding
f-hhmi|Howard Hughes Medical Institute|United States|Foundation|life,medicine,education|https://www.hhmi.org/programs|Biomedical science investigator and career programs
f-acs|American Chemical Society|International|Society|physical,engineering,education|https://www.acs.org/|Chemistry society; navigate to grants and awards pages
f-aps|American Physical Society|International|Society|physical,math,engineering|https://www.aps.org/|Physics society programs, fellowships and awards
f-acm|Association for Computing Machinery|International|Society|computing,math,education|https://www.acm.org/|Computing society award and scholarship resources
f-agu|American Geophysical Union|International|Society|climate,physical,life|https://www.agu.org/|Earth and space science society funding and awards
industry-google|Google Academic Research Awards|International|Industry|computing,physical,engineering|https://research.google/programs-and-events/google-academic-research-awards/|Academic research proposals; calls and eligibility vary by cycle
industry-amazon|Amazon Research Awards|International|Industry|computing,engineering,business|https://www.amazon.science/research-awards/call-for-proposals|Research awards and calls in computing and adjacent areas
industry-nvidia|NVIDIA Academic Grant Program|International|Industry|computing,engineering,medicine,physical|https://www.nvidia.com/en-us/industries/higher-education-research/academic-grant-program/|Academic GPU, computation and research technology support
industry-openai|OpenAI Researcher Access|International|Industry|computing,medicine,social,humanities|https://openai.com/form/researcher-access-program/|Research API credit program with specific scope and conditions
industry-microsoft|Microsoft Research Academic Programs|International|Industry|computing,engineering,social,medicine|https://www.microsoft.com/en-us/research/academic-program/|Microsoft Research academic collaboration programmes
industry-anthropic|Anthropic AI for Science|International|Industry|computing,life,medicine,physical|https://www.anthropic.com/ai-for-science|Claude credit-based support for science research; verify current call
industry-meta|Meta Research|International|Industry|computing,social,medicine|https://research.facebook.com/|Research programs and collaborative areas, not a guarantee of open funding
industry-ibm|IBM Research|International|Industry|computing,physical,engineering,medicine|https://research.ibm.com/|Research partnerships and programs; directory, not current grant data
'''
rows=[]
for line in RAW.strip().splitlines():
    parts=line.split('|')
    assert len(parts)==7,(line,len(parts))
    id,name,region,kind,fields,url,description=parts
    assert url.startswith('https://'),url
    rows.append({'id':id,'name':name,'region':region,'kind':kind,'fields':fields.split(','),'url':url,'description':description,'listing_type':'official_source_directory'})
assert len(set(x['id'] for x in rows))==len(rows)
out={'schema_version':1,'generated_at':'2026-11-14','description':'Official funding and research sponsor entry points; NOT individually indexed or verified-open grants. Program eligibility and deadlines require official confirmation.','sources':rows}
Path('docs/demo/source-hubs.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print('hubs',len(rows),'regions',len(set(x['region'] for x in rows)))
