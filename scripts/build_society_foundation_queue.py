"""Seed discipline-by-discipline candidate organizations without inventing live awards."""
from __future__ import annotations
import json
from pathlib import Path

TARGETS={
'Computer science & AI':{
'Society':['Association for Computing Machinery','IEEE Computer Society','Association for the Advancement of Artificial Intelligence','Association for Computational Linguistics','Association for Women in Mathematics and Computing','IEEE Computational Intelligence Society','IEEE Robotics and Automation Society','International Machine Learning Society','Association for Information Science and Technology','USENIX Association','Computer Research Association','International Society for Bayesian Analysis'],
'Foundation':['Schmidt Sciences','Simons Foundation','Patrick J. McGovern Foundation','AI for Good Foundation','Mozilla Foundation','Open Philanthropy']},
'Medicine & public health':{
'Society':['American Association of Physicists in Medicine','American Society for Radiation Oncology','Radiological Society of North America','American Association for Cancer Research','American Society of Clinical Oncology','American Heart Association','American College of Radiology','Society for Imaging Informatics in Medicine','American Medical Informatics Association','European Society for Radiotherapy and Oncology','European Society of Radiology','American Academy of Neurology','American Society of Hematology'],
'Foundation':['American Cancer Society','Leukemia & Lymphoma Society','Susan G. Komen','Alzheimer’s Association','Cystic Fibrosis Foundation','Lung Cancer Research Foundation','Prostate Cancer Foundation','Gates Foundation','Robert Wood Johnson Foundation','Wellcome','Chan Zuckerberg Initiative']},
'Biology & life sciences':{
'Society':['Society for Neuroscience','American Society for Cell Biology','Genetics Society of America','Society for Experimental Biology','Society for Molecular Biology and Evolution','Ecological Society of America','European Molecular Biology Organization','Human Genome Organisation','Federation of European Biochemical Societies','International Society for Stem Cell Research','Biochemical Society'],
'Foundation':['Human Frontier Science Program','Howard Hughes Medical Institute','Burroughs Wellcome Fund','Gordon and Betty Moore Foundation','The Kavli Foundation','The Pew Charitable Trusts']},
'Engineering & technology':{
'Society':['Institute of Electrical and Electronics Engineers','American Society of Mechanical Engineers','American Institute of Chemical Engineers','SPIE','Optica','American Society for Engineering Education','Institution of Engineering and Technology','Institute of Industrial and Systems Engineers','Society of Automotive Engineers International','Royal Academy of Engineering','The Engineering Institute of Canada'],
'Foundation':['James S. McDonnell Foundation','Lemelson Foundation','Kavli Foundation','Sloan Foundation']},
'Physics chemistry & materials':{
'Society':['American Physical Society','American Chemical Society','Materials Research Society','Institute of Physics','Royal Society of Chemistry','European Physical Society','American Astronomical Society','American Vacuum Society','Electrochemical Society','American Nuclear Society','Minerals Metals & Materials Society'],
'Foundation':['Research Corporation for Science Advancement','Simons Foundation','Alfred P. Sloan Foundation','Camille and Henry Dreyfus Foundation','Alexander von Humboldt Foundation']},
'Climate earth & environment':{
'Society':['American Geophysical Union','European Geosciences Union','Geological Society of America','Geological Society of London','American Meteorological Society','Ecological Society of America','Society for Conservation Biology','International Union for Conservation of Nature','Oceanography Society','Society of Environmental Toxicology and Chemistry'],
'Foundation':['National Geographic Society','National Fish and Wildlife Foundation','Gordon and Betty Moore Foundation','Packard Foundation','Oak Foundation']},
'Mathematics & statistics':{
'Society':['American Mathematical Society','Society for Industrial and Applied Mathematics','Mathematical Association of America','Institute of Mathematical Statistics','London Mathematical Society','Royal Statistical Society','European Mathematical Society','International Statistical Institute','Canadian Mathematical Society'],
'Foundation':['Clay Mathematics Institute','Simons Foundation','Fields Institute','Heilbronn Institute for Mathematical Research','Oberwolfach Foundation']},
'Social and behavioral sciences':{
'Society':['American Sociological Association','American Psychological Association','Association for Psychological Science','American Economic Association','American Political Science Association','International Sociological Association','Society for Research in Child Development','Population Association of America','Society for Personality and Social Psychology','International Communication Association'],
'Foundation':['Russell Sage Foundation','Wenner-Gren Foundation','Ford Foundation','William T. Grant Foundation','Robert Wood Johnson Foundation','Templeton Foundation','Volkswagen Foundation']},
'Humanities and languages':{
'Society':['American Historical Association','Modern Language Association','American Philosophical Association','Archaeological Institute of America','Society for Classical Studies','Linguistic Society of America','Royal Historical Society','American Council of Learned Societies','Society of Biblical Literature','Association of Art Historians'],
'Foundation':['Mellon Foundation','Getty Foundation','American Philosophical Society','The Huntington','Gerda Henkel Foundation','Volkswagen Foundation','John Simon Guggenheim Memorial Foundation']},
'Education and learning':{
'Society':['American Educational Research Association','European Educational Research Association','Comparative and International Education Society','National Council of Teachers of Mathematics','Association for the Study of Higher Education','British Educational Research Association','International Society of the Learning Sciences','American Association of Colleges for Teacher Education'],
'Foundation':['Spencer Foundation','Jacobs Foundation','Kellogg Foundation','Arnold Ventures','William T. Grant Foundation','Gates Foundation','National Education Foundation']},
'Agriculture and food':{
'Society':['American Society of Agronomy','Crop Science Society of America','Soil Science Society of America','American Society for Horticultural Science','International Union of Forest Research Organizations','Institute of Food Technologists','International Society for Plant Pathology','American Society of Animal Science','Society for Applied Microbiology','Royal Society of Biology'],
'Foundation':['Foundation for Food & Agriculture Research','Rockefeller Foundation','World Food Prize Foundation','Global Crop Diversity Trust','Syngenta Foundation for Sustainable Agriculture']},
'Arts media & design':{
'Society':['College Art Association','Society of Architectural Historians','Society for Ethnomusicology','Society for Cinema and Media Studies','American Alliance of Museums','International Council of Museums','Design Research Society'],
'Foundation':['Creative Capital','Graham Foundation','Andy Warhol Foundation for the Visual Arts','New York Foundation for the Arts','Pollock-Krasner Foundation','Canada Council for the Arts','Arts Council England','Japan Foundation']},
'Business law & policy':{
'Society':['Academy of Management','American Finance Association','Law and Society Association','International Studies Association','American Accounting Association','Academy of International Business','American Marketing Association','Society for Human Resource Management','Society for Risk Analysis','American Bar Association'],
'Foundation':['Kauffman Foundation','Russell Sage Foundation','Brookings Institution','Ford Foundation','Open Society Foundations','Hewlett Foundation','Peterson Institute for International Economics']},
}

def main():
    records={}
    for field,by_type in TARGETS.items():
        for kind,names in by_type.items():
            for name in names:
                k=name.casefold()
                if k not in records:
                    records[k]={'name':name,'kind':kind,'fields':[],'status':'candidate_not_verified','specific_funding_link':None,'program_count_verified':0,'review_needed':True}
                if field not in records[k]['fields']:records[k]['fields'].append(field)
    path=Path(__file__).resolve().parents[1]/'data/global/society-foundation-discovery-queue.json'
    path.write_text(json.dumps({'schema_version':1,'description':'Candidate societies/foundations to review for official academic grant and fellowship programs; organizations are not opportunities.','entries':list(records.values())},indent=2,ensure_ascii=False)+'\n')
    print(f'{len(records)} distinct society/foundation candidates across {len(TARGETS)} fields')

if __name__=='__main__':main()
