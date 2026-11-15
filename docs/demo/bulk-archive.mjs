const BASE='https://www.grants.gov/search-results-detail/';

export function readBulkArchive(data,revision,count){
  if(data.schema_version!==1||data.archive_revision!==revision||!Array.isArray(data.rows)||data.rows.length!==count)
    throw new Error('Archive snapshot does not match the current catalog');
  const ids=new Set();
  return data.rows.map(([key,title,funder,deadline,cooperative,number,amount_min,amount_max])=>{
    if(!/^\d{1,20}$/.test(key)||ids.has(key)||!title||!funder)throw new Error('Invalid archive record');
    ids.add(key);
    const usd=n=>`$${n.toLocaleString('en-US')}`;
    const amount=amount_min&&amount_max&&amount_min!==amount_max?`${usd(amount_min)}–${usd(amount_max)}`:
      amount_max?`Up to ${usd(amount_max)}`:amount_min?`From ${usd(amount_min)}`:null;
    return {id:`grantsgov-bulk-${key}`,url:BASE+key,title,funder,deadline,opportunity_number:number,
      category:'Government',country_or_region:'United States',origin:'grantsgov_bulk',
      program_status_scope:'specific_call',source_checked_at:data.checked_at,status:'closed',review_needed:true,
      funding_type:cooperative?'Cooperative agreement':'Federal grant',amount_min,amount_max,amount,
      currency:amount?'USD':null};
  });
}
