import {fundingWindow, invitedPhase} from './funding-window.mjs';

// Sample sessions never read or write personal browser storage.
export const examples = {
  computing: {researchText:'My lab studies artificial intelligence and machine learning',stage:'faculty',societies:['IEEE'],institutions:[]},
  ecology: {researchText:'I study salt marsh restoration, coastal ecology, and climate adaptation',stage:'phd',societies:['Ecological Society of America'],institutions:['University of Bristol']},
};

export function upcomingSaved(records, today, days=30) {
  const until=new Date(Date.parse(today+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
  return records.filter(o=>{
    const {status,deadline}=fundingWindow(o,today);
    return !o.archived&&!invitedPhase(o)&&['open','rolling'].includes(status)&&deadline>=today&&deadline<=until;
  }).sort((a,b)=>a.deadline.localeCompare(b.deadline));
}
