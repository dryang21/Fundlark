// The society directory is bundled; ROR is queried only when the user requests a registry search.
export const organizationKey = value => String(value??'').normalize('NFKC').toLowerCase()
  .replace(/&/g,'and').replace(/[^\p{L}\p{N}]/gu,'');

export const localInstitutions = [
  ['Stanford University','Stanford','Leland Stanford Junior University'],
  ['Harvard University','Harvard'],
  ['Massachusetts Institute of Technology','MIT'],
  ['University of California, San Francisco','UCSF','University of California San Francisco'],
  ['University of California, Berkeley','UC Berkeley','Berkeley'],
  ['University of California, Los Angeles','UCLA','UC Los Angeles'],
  ['University of California, San Diego','UC San Diego','UCSD'],
  ['University of Washington','UW Seattle'],
  ['University of Michigan','UMich','University of Michigan Ann Arbor'],
  ['Duke University','Duke'],
  ['University of Pennsylvania','UPenn','Penn'],
  ['Carnegie Mellon University','CMU'],
  ['Johns Hopkins University','JHU','Johns Hopkins'],
  ['National Institutes of Health','NIH'],
  ['University of Toronto','U of T','U Toronto'],
  ['University of British Columbia','UBC'],
  ['McGill University','McGill'],
  ['University of Oxford','Oxford University'],
  ['University of Cambridge','Cambridge University'],
  ['University College London','UCL'],
  ['Imperial College London','Imperial'],
  ['ETH Zurich','ETH Zürich','ETHZ'],
  ['École Polytechnique Fédérale de Lausanne','EPFL'],
  ['Technical University of Munich','TUM','Technische Universität München'],
  ['National University of Singapore','NUS'],
  ['Nanyang Technological University','NTU Singapore'],
  ['University of Tokyo','UTokyo'],
  ['Tsinghua University','Tsinghua'],
  ['Peking University','PKU'],
  ['University of Melbourne','UniMelb'],
  ['University of Sydney','USyd'],
  ['Universidade de São Paulo','University of São Paulo','USP'],
  ['University of Cape Town','UCT'],
].map(([name,...aliases])=>({name,aliases}));

export const societyOptions = sources => sources.filter(item=>item.kind==='society').map(({name,alias})=>({name,aliases:[alias]}));
export const organizationLabel = entry => {
  const alias=entry.aliases?.[0];
  return alias&&organizationKey(alias)!==organizationKey(entry.name)?`${entry.name} (${alias})`:entry.name;
};

export function resolveOrganization(value, options) {
  const key=organizationKey(value);
  const exact=options.find(entry=>[entry.name,organizationLabel(entry)].some(label=>organizationKey(label)===key));
  if(exact)return exact.name;
  const aliases=options.filter(entry=>entry.aliases?.some(label=>organizationKey(label)===key));
  return aliases.length===1?aliases[0].name:value.trim();
}

export function searchOrganizations(value, options, limit=8) {
  const words=value.trim().toLowerCase().split(/\s+/).map(organizationKey).filter(Boolean);
  const query=organizationKey(value);
  if(value.trim()&&!query)return [];
  return options.flatMap(entry=>{
    const keys=[entry.name,...(entry.aliases||[])].map(organizationKey);
    const rank=keys.includes(query)?0:keys.some(key=>key.startsWith(query))?1:
      words.every(word=>keys.some(key=>key.includes(word)))?2:3;
    return rank<3?[{entry,rank}]:[];
  }).sort((a,b)=>a.rank-b.rank||a.entry.name.localeCompare(b.entry.name)).slice(0,limit).map(({entry})=>entry);
}

export function registryOrganizations(data) {
  if(!Array.isArray(data?.items))return [];
  return data.items.flatMap(item=>{
    const names=Array.isArray(item.names)?item.names:[];
    const name=names.find(entry=>entry.types?.includes('ror_display'))?.value;
    if(item.status!=='active'||typeof name!=='string'||typeof item.id!=='string'||!/^https:\/\/ror\.org\/[a-z0-9]+$/.test(item.id))return [];
    const location=item.locations?.[0]?.geonames_details;
    return [{name,aliases:names.filter(entry=>entry.value!==name&&typeof entry.value==='string').map(entry=>entry.value),
      location:[location?.name,location?.country_name].filter(Boolean).join(', '),id:item.id}];
  });
}
