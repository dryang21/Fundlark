import importlib.util
from pathlib import Path
import pytest
spec=importlib.util.spec_from_file_location('update_openalex_taxonomy',Path(__file__).resolve().parents[1]/'scripts/update_openalex_taxonomy.py')
tax=importlib.util.module_from_spec(spec)
spec.loader.exec_module(tax)

def test_normalization_provenance_and_hierarchy():
    assert tax.clean({'display_name':'Computational Oncology','id':'https://openalex.org/topics/T1234',
      'field':{'display_name':'Medicine'},'subfield':{'display_name':'Oncology'}},'topics') == {
      'id':'openalex:topics:T1234','label':'Computational Oncology','fields':['Medicine'],'subfields':['Oncology'],'aliases':[]}
    assert tax.clean({'id':'x'},'topics') is None
    assert tax.clean({'display_name':'Oncology','id':'https://openalex.org/subfields/2711','field':{'display_name':'Medicine'},'display_name_alternatives':['Cancer medicine']},'subfields')['aliases']==['Cancer medicine']

def test_incomplete_download_not_written():
    with pytest.raises(ValueError,match='incomplete'):
        tax.build_snapshot(lambda endpoint,**kwargs: [{'id':'dummy','display_name':'Dummy field'}])

def test_snapshot_records_and_stable_schema():
    def fake(endpoint,**kwargs):
        n={'fields':26,'subfields':252,'topics':4516}[endpoint]
        return [{'display_name':f'Local {endpoint} {i}','id':f'https://openalex.org/{endpoint}/{i}',
                 'field':{'display_name':'Computer Science'},'subfield':{'display_name':'AI'}} for i in range(n)]
    snapshot=tax.build_snapshot(fake)
    assert snapshot['license']=='CC0'
    assert len(snapshot['concepts'])==4794
    assert snapshot['counts']['topics']==4516
