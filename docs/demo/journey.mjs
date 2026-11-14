export {cvReview, cvSuggestions} from './cv-profile.mjs?v=cv-profile-7';

// Sample sessions never read or write personal browser storage.
export const examples = {
  computing: {researchText:'My lab studies artificial intelligence and machine learning',stage:'faculty',societies:['IEEE'],institutions:[]},
  ecology: {researchText:'I study salt marsh restoration, coastal ecology, and climate adaptation',stage:'phd',societies:['Ecological Society of America'],institutions:['University of Bristol']},
};

export function upcomingSaved(records, today, days=30) {
  const until=new Date(Date.parse(today+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
  return records.filter(o=>!o.archived && ['open','rolling'].includes(o.status) && /^\d{4}-\d{2}-\d{2}$/.test(o.deadline||'')&&o.deadline>=today&&o.deadline<=until)
    .sort((a,b)=>a.deadline.localeCompare(b.deadline));
}
