import {copyFile, mkdir} from 'node:fs/promises';
import {build} from 'esbuild';

const output = new URL('../docs/demo/cv-assets/', import.meta.url);
await mkdir(output, {recursive:true});
for (const file of ['pdf.min.mjs','pdf.worker.min.mjs']) {
  await copyFile(new URL('../node_modules/pdfjs-dist/legacy/build/'+file,import.meta.url), new URL(file,output));
}
await copyFile(new URL('../node_modules/pdfjs-dist/LICENSE',import.meta.url),new URL('pdfjs-LICENSE.txt',output));
await copyFile(new URL('../node_modules/mammoth/LICENSE',import.meta.url),new URL('mammoth-LICENSE.txt',output));
await build({stdin:{contents:"export {extractRawText} from 'mammoth';",resolveDir:process.cwd()},bundle:true,platform:'browser',format:'esm',minify:true,outfile:new URL('word.mjs',output).pathname,legalComments:'linked'});
