import {localInstitutions,organizationLabel,resolveOrganization,searchOrganizations,registryOrganizations,societyOptions} from './organizations.mjs?v=1';

export function setupOrganizations({$,esc,onAdd,onChange}){
  let societies=[], institutions=localInstitutions, registry=[], requestId=0;
  const controls=[
    ['societies','#societyInput','#addSociety','#societyOptions'],
    ['institutions','#institutionInput','#addInstitution','#institutionOptions'],
  ];
  const options=kind=>kind==='societies'?societies:institutions;
  const resolve=(kind,value)=>resolveOrganization(value,options(kind));

  function clearRegistry(){
    requestId++;
    registry=[];
    $('#registryOptions').hidden=true;
    $('#registryStatus').textContent='';
  }
  function add(kind,value){
    if(!value.trim())return;
    onAdd(kind,resolveOrganization(value,kind==='institutions'?[...institutions,...registry]:societies));
    const [,input,,panel]=controls.find(([key])=>key===kind);
    $(input).value='';
    $(panel).hidden=true;
    if(kind==='institutions')clearRegistry();
  }
  function render(panel,entries,kind,showLocation=false){
    const container=$(panel);
    container.hidden=!entries.length;
    container.innerHTML=entries.map((entry,index)=>`<button type="button" data-entry="${index}">${esc(organizationLabel(entry))}${showLocation&&entry.location?`<small>${esc(entry.location)}</small>`:''}</button>`).join('');
    container.onclick=event=>{
      const button=event.target.closest('[data-entry]');
      if(!button)return;
      add(kind,entries[Number(button.dataset.entry)].name);
      const [,input]=controls.find(([key])=>key===kind);
      $(input).focus();
      $(panel).hidden=true;
      onChange();
    };
  }
  for(const [kind,input,button,panel] of controls){
    const control=$(input);
    const suggest=()=>render(panel,searchOrganizations(control.value,options(kind)),kind);
    control.addEventListener('focus',suggest);
    control.addEventListener('input',()=>{
      if(kind==='institutions')clearRegistry();
      suggest();
    });
    const save=()=>{add(kind,control.value);onChange();};
    $(button).addEventListener('click',save);
    control.addEventListener('keydown',event=>{
      if(event.key==='Enter'){event.preventDefault();save();}
      if(event.key==='Escape')$(panel).hidden=true;
      if(event.key==='ArrowDown'&&!$(panel).hidden){
        event.preventDefault();$(panel).querySelector('button')?.focus();
      }
    });
    control.closest('fieldset').addEventListener('focusout',event=>{
      if(!control.closest('fieldset').contains(event.relatedTarget))$(panel).hidden=true;
    });
  }
  $('#lookupInstitution').addEventListener('click',async()=>{
    const query=$('#institutionInput').value.trim();
    clearRegistry();
    if(query.length<2){$('#registryStatus').textContent='Type at least two letters of an institution name.';return;}
    const request=requestId;
    $('#registryStatus').textContent='Searching the Research Organization Registry…';
    try{
      const url=new URL('https://api.ror.org/v2/organizations');
      url.searchParams.set('query',query);
      const response=await fetch(url,{signal:AbortSignal.timeout(6000),credentials:'omit',referrerPolicy:'no-referrer'});
      if(!response.ok)throw new Error('Registry unavailable');
      const results=registryOrganizations(await response.json()).slice(0,8);
      if(request!==requestId)return;
      registry=results;
      render('#registryOptions',registry,'institutions',true);
      $('#registryStatus').textContent=registry.length?'Choose an institution from the registry results.':'No registry results. You can still add the name you typed.';
    }catch{
      if(request===requestId)$('#registryStatus').textContent='The registry is unavailable. You can still add the name you typed.';
    }
  });
  return {
    consume(){for(const [kind,input] of controls)add(kind,$(input).value);},
    clear(){for(const [,input,,panel] of controls){$(input).value='';$(panel).hidden=true;}clearRegistry();},
    setDirectory(sources,names){
      societies=societyOptions(sources);
      institutions=[...localInstitutions];
      for(const name of new Set(names.filter(Boolean))){
        if(!institutions.some(entry=>entry.name===name))institutions.push({name,aliases:[]});
      }
    },
    resolve,
    display(kind,value){
      if(kind!=='societies')return value;
      const full=resolve(kind,value);
      const entry=societies.find(item=>item.name===full);
      return entry?organizationLabel(entry):value;
    },
  };
}
