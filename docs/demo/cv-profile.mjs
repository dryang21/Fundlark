import {SOCIETIES, societyKey} from './matching.mjs?v=membership-6';

const topicHeading = /^(?:research (?:interests?|topics?|focus|areas?|specialt(?:y|ies)|expertise|summary|profile|keywords|overview|themes|program(?:me)?|statement)|(?:current |selected )?research projects?|research methods|areas of (?:research|expertise)|technical (?:skills|expertise)|keywords|specialties)$/i;
const memberHeading = /^(?:(?:current |professional |scientific |academic |society )*(?:memberships?|societ(?:y|ies))|professional (?:associations|organizations)|(?:professional |society )?memberships? (?:and|&) affiliations)$/i;
const currentHeading = /^(?:(?:current|present) (?:academic |professional |research )?(?:appointments?|positions?|employment|roles?|affiliations?|institutions?|occupation)|career stage)$/i;
const employmentHeading = /^(?:(?:academic |professional |research |clinical |industry |industrial |work |faculty |previous |past |selected |chronology of )*(?:appointments?|positions?|employment|experiences?)(?: (?:and|&) (?:employment|affiliations))?|(?:employment|work) (?:history|record)|professorships|positions held)$/i;
const educationHeading = /^(?:education(?: (?:and|&) (?:training|clinical training))?|academic (?:background|qualifications)|degrees?|(?:clinical |professional )?training)$/i;
const serviceHeading = /^(?:professional |academic )?service (?:and|&) affiliations$/i;
const otherHeading = /^(?:(?:selected|professional|academic|refereed|peer.reviewed|invited|conference|journal|research|leadership|current|past|previous)\s+)*(?:publications?|presentations?|honou?rs?|awards?|service|leadership|conferences?|talks?|lectures?|teaching|mentoring|patents?|references?|funding|grants?|fellowships?|certifications?|outreach|activities|contact|biography|languages|skills)\b/i;
const activeYear = /\b(?:since\s+(?:19|20)\d{2}|(?:19|20)\d{2}\s*(?:[-–—−]\s*(?:to\s+)?|to\s+)(?:the present|present|current|ongoing|today|to date|date|now)\b)/i;
const openYear = /\b(?:19|20)\d{2}\s*[-–—−](?=\s*(?:[,;]|$|[\p{L}])\s*)/iu;
const closedDate = /\b(?:19|20)\d{2}\s*(?:[-–—−]|to)\s*(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|spring|summer|fall|autumn|winter)\.?\s+)?(?:19|20)?\d{2}\b/i;
const monthRange = /\b(0?[1-9]|1[0-2])\/(19\d{2}|20\d{2})\s*(?:[-–—−]|to)\s*(?:(0?[1-9]|1[0-2])\/(19\d{2}|20\d{2})|(present|current|ongoing|now))\b/i;
const former = /\b(?:former|previously|expired|lapsed|retired|emerit(?:us|a|i)|past member|inactive)\b/i;
const rolePatterns = [
  ['postdoc', /\bpost[- ]?doc(?:toral)?\b/i],
  ['resident', /\b(?:medical physics |clinical |physician |radiation oncology )?residen(?:t|cy)\b/i],
  ['faculty', /\b(?:professor|faculty(?!\s+of\b)|lecturer|reader in)\b/i],
  ['phd', /\b(?:(?:ph\.?\s?d\.?|dphil|doctoral|doctorate)\s+(?:student|candidate|researcher)|(?:student|candidate)\s+(?:for|in)\s+(?:a\s+)?(?:ph\.?\s?d\.?|doctorate))\b/i],
  ['masters', /\b(?:master(?:['’]s|s)?|m\.?s\.?c?\.?|m\.?eng\.?)\s+(?:student|candidate)\b/i],
  ['undergrad', /\b(?:undergraduate (?:student|research assistant|researcher)|bachelor(?:['’]s|s)? (?:student|candidate)|b\.?s\.? (?:student|candidate))\b/i],
  ['staff', /\b(?:research (?:staff|scientist|engineer|associate|specialist|professional|technician)|(?:staff|data|applied|principal|senior) scientist|(?:software|robotics|machine learning|staff) engineer|scientific officer)\b/i],
];
const orgWord = /(?:\buniv\.(?=\s)|universit(?:y|é|ät|aire|at)\b|\b(?:college|institut(?:e|ion|o)?|laborator(?:y|ies)|hospitals?|academ(?:y|ia)|polytechnic|school|research cent(?:er|re)|national lab|clinic)\b)/i;
const degree = /\b(?:ph\.?\s?d\.?|dphil|doctor of philosophy|master[’'s]*|m\.?s\.?c?\.?|m\.?eng\.?|bachelor[’'s]*|b\.?s\.?c?\.?)\b/i;
const membershipGrade = '(?:(?:current|active|student|graduate student|senior|professional|regular|general|full|associate|affiliate|life|paid)\\s+)?member(?:ship)?';
const memberPrefix = new RegExp(`^(?:${membershipGrade}|fellow)(?:\\s*[:,–—-]\\s*|\\s+of\\s+)(.+)$`, 'i');
const memberSuffix = new RegExp(`(?:\\s*[,–—:(]\\s*|\\s+-\\s+|\\s+)(?:${membershipGrade}|\\b(?:student|associate|senior|life|active|regular|professional|full|affiliate)\\s+member|fellow)\\)?\\s*$`, 'i');
const privateText = /@|https?:|\bwww\.|\b\d{5,}\b/iu;
const tidy = value => value.trim().replace(/^[\s•·▪○◦*{\-–—]+|[\s.;]+$/gu,'');
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const normal = value => value.normalize('NFKC').toLowerCase().replace(/[-‐‑–—−\s]+/g,' ').trim();

function sectionOf(label) {
  if (topicHeading.test(label)) return 'topics';
  if (memberHeading.test(label)) return 'members';
  if (currentHeading.test(label)) return 'current';
  if (employmentHeading.test(label)) return /^(?:previous|past)\b/i.test(label)?'past':'employment';
  if (educationHeading.test(label)) return 'education';
  if (serviceHeading.test(label)) return 'service';
  if (label.length<=70 && otherHeading.test(label) && !/[.!?]/.test(label) && label.split(/\s+/).length<=8) return 'other';
  return '';
}

function institutionNames(line, explicit=false) {
  line=line.replace(/^\s*(?:.+?\b(?:professor|lecturer|resident|researcher|scientist|engineer|candidate|student)\b[^:,]*):\s+/i,'');
  const parts = line.replace(/\s*\([^)]*(?:\)|$)\s*/g,' ')
    .replace(activeYear,' ').replace(openYear,' ').replace(monthRange,' ')
    .replace(/^\s*(?:(?:current |primary |secondary )?(?:institution|affiliation|employer)\s*:\s*)/i,'')
    .split(/[,;|]|\s+at\s+|\s+[–—]\s+| {2,}/i)
    .map(tidy).filter(Boolean);
  return parts.flatMap((part,index)=>{
    if(privateText.test(part) || /^(?:(?:the )?(?:dept\.|department|division|faculty of|program(?:me)?|lab group)|school of|university or|office|building|level)\b/i.test(part) ||
      /\b(?:university of|univ\. of|institute for|school of|college of)$/i.test(part)||/^(?:university|institute|academy|college|school|laboratory)$/i.test(part)||
      rolePatterns.some(([,pattern])=>pattern.test(part)) || /^(?:ph\.?d\.?|m\.?s\.?c?\.?|b\.?s\.?)/i.test(part))return [];
    if (/^(?:the )?University of (?:California|Texas)$/i.test(part) && /^[\p{Lu}][\p{L} .-]{1,25}$/u.test(parts[index+1]||''))
      return [part+', '+parts[index+1]];
    return orgWord.test(part)||(explicit&&!/^[\d(]/.test(part))?[part]:[];
  });
}

// Keeps excerpts in the temporary review only; the profile stores chosen values.
export function cvReview(text, sources=[], catalogTopics=[], today=new Date()) {
  const body = text.slice(0,50000).normalize('NFKC')
    .replace(/([\p{L}])[-‐‑]\s*\r?\n\s*(?=\p{Ll})/gu,'$1-')
    .replace(/(\b(?:19|20)\d{2}\s*[-–—−])\s*\r?\n\s*(?=(?:present|ongoing|today|now)\b)/gi,'$1')
    .replace(/(\b(?:19|20)\d{2}\s*[-–—−]\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*|(?:spring|summer|fall|autumn|winter)\s*))\r?\n\s*(?=(?:19|20)\d{2}\b)/gi,'$1 ')
    .replace(/^\s*(current|present)\s*\r?\n\s*(position|appointment|occupation|affiliation)\s*:?[ \t]*$/gim,'$1 $2');
  const result={topics:[],societies:[],institutions:[],stage:''};
  const evidence={topics:new Map(),societies:new Map(),institutions:new Map(),stage:new Map()};
  const stageScores=new Map();
  const currentLines=[], researchLines=[];
  const knownSocieties=new Map(SOCIETIES.map(name=>[societyKey(name),name]));
  for(const source of sources.filter(source=>source.kind==='society')){
    const name=source.alias||source.name;
    for(const label of [source.name,source.alias].filter(Boolean))knownSocieties.set(societyKey(label),name);
  }
  const remember=(key,value,line)=>{
    value=tidy(value);
    if(!value||value.length>160||privateText.test(value))return false;
    const id=key==='societies'?societyKey(value):normal(value).replace(key==='institutions'?/^the /:/^$/,'');
    if(!id||evidence[key].has(id)||evidence[key].size>=12)return false;
    const excerpt=tidy(line);
    evidence[key].set(id,{value,excerpt:excerpt&&!privateText.test(excerpt)?excerpt.slice(0,160):''});
    if(key!=='stage')result[key].push(value);
    return true;
  };
  const registerRole=(stage,score,line)=>{
    if(!stage)return;
    if((stageScores.get(stage)||0)>=score)return;
    evidence.stage.delete(stage);remember('stage',stage,line);stageScores.set(stage,score);
  };
  const lines=body.split(/\r?\n/).map(tidy);
  const month=today.getFullYear()*12+today.getMonth()+1;
  let section='', heading='', sectionRows=0, appointment=null, previousEntry=null;
  for(const [index,original] of lines.entries()){
    if(!original)continue;
    const lineWithoutNumber=original.replace(/^[\uE000-\uF8FF]\s*|^\d{1,2}[.)]\s*/u,'');
    const parts=[lineWithoutNumber.match(/^([^:]{1,70}):\s*(.*)$/),lineWithoutNumber.match(/^(.{1,70}?) {2,}(.*)$/)];
    const colon=parts.find(part=>part&&sectionOf(part[1].trim()));
    const label=(colon?colon[1]:lineWithoutNumber).trim();
    const nextSection=sectionOf(label);
    if(nextSection){
      section=nextSection;heading=label;sectionRows=0;appointment=null;previousEntry=null;
      if(!colon?.[2])continue;
    }
    const line=nextSection?colon[2]:lineWithoutNumber;
    sectionRows++;
    if(section==='topics'&&sectionRows<=16&&!privateText.test(line)) {
      researchLines.push(line);
    }
    // A publication, a talk, a committee role or an honor does not establish membership.
    const memberContext=section==='members'&&sectionRows<=30;
    if(memberContext||section==='service'||(!section&&index<30)){
      const items=line.split(/;|[•▪]/u);
      for(const item of items.flatMap(part=>{
        // A membership list may use commas; preserve "Member, X" and "X, Member".
        const value=part.replace(activeYear,' ').trim();
        if(part.includes(',')&&!memberPrefix.test(value)&&!memberSuffix.test(value))return part.split(',');
        return [part];
      })){
        let name=tidy(item.replace(/^\s*(?:journal|conference|awards|membership)\s*:\s*/i,''));
        if(former.test(name)||closedDate.test(name)||/\b(?:invited|pending|applicant|presented|conference on|panelist|organizer|committee|workshop|best paper|award)\b/i.test(name))continue;
        name=tidy(name.replace(activeYear,' ').replace(openYear,' ').replace(/\s*\((?:since\s+)?\d{4}[^)]*\)\s*$/i,'')
          .replace(/[,\s]*(?:since\s+\d{4}\)?|\d{4}\s*[-–—−]\s*(?:present|current|ongoing|now)?)\s*$/i,''));
        const member=name.match(memberPrefix);
        const suffix=memberSuffix.test(name);
        if(!memberContext&&!member&&!suffix)continue;
        name=tidy(member?.[1]||name.replace(memberSuffix,''));
        const alias=knownSocieties.get(societyKey(name));
        const short=name.match(/^(.*?)\s*\(([\p{Lu}\d-]{2,12})\)$/u);
        const canonical=alias||(short&&(knownSocieties.get(societyKey(short[1]))||knownSocieties.get(societyKey(short[2]))))||name;
        if(!/^\p{N}|\b(?:annual meeting|editorial board|volunteer|alumni|summer school|representative)\b/iu.test(name)&&name.split(/\s+/).length<=15 && (member || suffix || alias || /\b(?:society|association|academy|institute|union|federation|council|chapter|college|network)\b/i.test(name) || /^[\p{Lu}][\p{Lu}\d-]{1,10}$/u.test(name)))remember('societies',canonical.replace(/[,;]+$/,''),original);
      }
    }

    if(!['','current','employment','education'].includes(section))continue;
    if(section==='current'&&sectionRows>12)continue;
    if(/\b(?:faculty |research |academic |thesis |dissertation |ph\.?d\.? )?(?:advisor|adviser|supervisor|mentor)\s*:/i.test(line))continue;
    const dates=line.match(monthRange);
    const inRange=dates && Number(dates[2])*12+Number(dates[1])<=month && (dates[5]||Number(dates[4])*12+Number(dates[3])>=month);
    const active=activeYear.test(line);
    const expected=line.match(/(?:\b((?:19|20)\d{2})\s*\(expected\)|\bexpected\D{0,18}((?:19|20)\d{2}))/i);
    const expectedEnrollment=section==='education'&&expected&&Number(expected[1]||expected[2])>=today.getFullYear();
    if(former.test(line)||/\b(?:incoming|starting in|will join)\b/i.test(line)||(dates?!inRange:!active&&!expectedEnrollment&&closedDate.test(line))){
      appointment=null;previousEntry=null;continue;
    }
    if(privateText.test(line))continue;
    if(section==='education'&&expected&&Number(expected[1]||expected[2])<today.getFullYear())continue;
    const hasDate=active||Boolean(inRange)||Boolean(expectedEnrollment)||['current','employment','education'].includes(section)&&openYear.test(line);
    const stage=rolePatterns.find(([,pattern])=>pattern.test(line))?.[0];
    const shortHeader=!section&&index<14&&line.length<=160&&stage&&!/\b(?:office|provost|advisor|of faculty|faculty and)\b/i.test(line);
    const explicitInstitution=section==='current'&&/affiliation|institution/i.test(heading);
    const entryScore=section==='current'?4:hasDate?3:shortHeader?1:0;
    const student=stage&&['phd','masters','undergrad'].includes(stage);
    const degreeWithDate=section==='education'&&hasDate&&degree.test(line);
    // A completed degree is historical; an ongoing enrollment may be current.
    if(section==='education'&&!appointment&&!hasDate&&!student)continue;
    if(section==='education'&&stage&&!student&&!hasDate&&!(appointment&&index-appointment.index<=3))continue;
    const enrollmentStage=degreeWithDate&&!stage?(/\b(?:ph\.?\s?d\.?|dphil|doctor of philosophy)\b/i.test(line)?'phd':/\b(?:master|m\.?s\.?c?|m\.?eng)\b/i.test(line)?'masters':'undergrad'):'';
    if(entryScore||section==='education'&&student){
      if(stage||enrollmentStage||hasDate||explicitInstitution||section==='current'&&orgWord.test(line)){
        appointment={index,score:entryScore||2,line,stage:stage||enrollmentStage,section,hasOrg:false};
        currentLines.push(line);
        registerRole(appointment.stage,appointment.score,line);
        const names=institutionNames(line,explicitInstitution&&!stage);
        for(const name of names)remember('institutions',name,original);
        appointment.hasOrg=names.length>0;
      }
    }
    if(appointment&&appointment.index!==index&&appointment.section===section&&index-appointment.index<=3&&!/\b(?:19|20)\d{2}\b/.test(line)){
      const names=institutionNames(line);
      if(stage&&!appointment.stage){
        registerRole(stage,appointment.score,line);
        appointment.stage=stage;
        currentLines.push(line);
      }
      if(!appointment.hasOrg&&names.length){
        for(const name of names)remember('institutions',name,original);
        appointment.hasOrg=true;
        currentLines.push(line);
      }
    }
    // Several CV layouts put the date after the role and institution.
    if(hasDate&&!stage&&appointment&&section!=='education'&&previousEntry&&index-previousEntry.index<=2){
      if(!appointment.stage&&previousEntry.stage){
        registerRole(previousEntry.stage,entryScore,previousEntry.line+' · '+line);
        appointment.stage=previousEntry.stage;
      }
      if(!appointment.hasOrg)for(const name of institutionNames(previousEntry.line))remember('institutions',name,previousEntry.line);
    }
    if(inRange&&appointment?.index===index&&!appointment.hasOrg){
      const prior=lines[index-1]||'';
      if(!former.test(prior)&&!closedDate.test(prior)&&!monthRange.test(prior)){
        const names=institutionNames(prior);
        for(const name of names)remember('institutions',name,prior);
        appointment.hasOrg=names.length>0;
      }
    }
    if(stage||orgWord.test(line))previousEntry={index,line,stage};
  }

  const generic=new Set(['and','with','for','the','other','research','science','systems','technology','engineering','award','impact','annual','year','conference','program','education','student','paper','best','based','university','meeting','journal','field','work','national','international','medicine']);
  const fields=[...new Set([...sources.flatMap(source=>source.fields||[]),...catalogTopics].map(normal))]
    .filter(term=>term.length>=2&&term.length<=100&&!generic.has(term)&&(term.length>2||['ai','ml','vr','ar'].includes(term)));
  const corpus=normal(body.replace(/\S+@\S+|https?:\/\/\S+/gi,' '));
  const focused=normal(researchLines.join(' ')), current=normal(currentLines.join(' '));
  const ranked=fields.flatMap(term=>{
    const re=new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(term)}(?![\\p{L}\\p{N}])`,'gu');
    const hits=[...corpus.matchAll(re)];
    const inResearch=re.test(focused);
    return hits.length?[{term,re,score:Math.min(hits.length,6)+Number(inResearch)*12+Number(re.test(current))*3+(term.includes(' ')?3:0),first:hits[0].index,focused:inResearch}]:[];
  }).sort((a,b)=>b.score-a.score||a.first-b.first);
  for(const phrase of researchLines.join('; ').replace(/\b(?:and|or);\s+/ig,'').split(/[,;|•]+/u).map(tidy)){
    if(phrase.split(/\s+/).length<=8&&!generic.has(normal(phrase))&&!/\b(?:references available|curriculum vitae)\b/i.test(phrase))remember('topics',phrase,phrase);
  }
  for(const {term,re,focused:inResearch} of ranked){
    if(result.topics.length>=12||(!inResearch&&result.topics.length>=8))break;
    if(result.topics.some(topic=>normal(topic).includes(term)))continue;
    const excerpt=(inResearch?researchLines:lines).find(line=>!privateText.test(line)&&re.test(normal(line)));
    remember('topics',term,excerpt||'');
  }
  const ordered=[...stageScores].sort((a,b)=>b[1]-a[1]);
  if(ordered.length&&(ordered.length===1||ordered[0][1]>ordered[1][1]))result.stage=ordered[0][0];
  const stages=ordered.filter(([,score])=>score===ordered[0][1]).map(([stage])=>evidence.stage.get(stage));
  return {result,evidence,stages};
}

export function cvSuggestions(...args) { return cvReview(...args).result; }
