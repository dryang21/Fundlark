export async function readCV(file) {
  const extension = file.name.toLowerCase().split('.').pop();
  if (!['txt','pdf','docx'].includes(extension)) throw new Error('Choose a PDF, Word (.docx), or text (.txt) file.');
  if (file.size > 8*1024*1024) throw new Error('Choose a CV smaller than 8 MB or paste an excerpt.');
  let text;
  if (extension==='txt') text=await file.text();
  else if (extension==='docx'){
    const {extractRawText}=await import('./cv-assets/word.mjs');
    text=(await extractRawText({arrayBuffer:await file.arrayBuffer()},{externalFileAccess:false})).value;
  } else {
    const {getDocument,GlobalWorkerOptions}=await import('./cv-assets/pdf.min.mjs');
    GlobalWorkerOptions.workerSrc=new URL('./cv-assets/pdf.worker.min.mjs',import.meta.url).href;
    const task=getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false});
    try {
      const pdf=await task.promise;
      text='';
      for(let page=1;page<=Math.min(pdf.numPages,20)&&text.length<50000;page++){
        const content=await (await pdf.getPage(page)).getTextContent();
        text+=content.items.map(item=>(item.str||'')+(item.hasEOL?'\n':' ')).join('')+'\n';
      }
    } finally { await task.destroy(); }
  }
  if(!text.trim())throw new Error('No readable text found. If this is a scanned PDF, paste text from an OCR copy.');
  return text.slice(0,50000);
}
