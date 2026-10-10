const {buildSync}=require('esbuild');
const {writeFileSync}=require('node:fs');
const {createHash}=require('node:crypto');
const result=buildSync({entryPoints:['beta/evolution-xlsx.js'],bundle:true,minify:true,format:'iife',globalName:'GIEvolutionExport',platform:'browser',target:'es2022',write:false,legalComments:'inline'});
const code=result.outputFiles[0].text;
for(const file of ['docs/evolution-export.js','design/evolution-export.js'])writeFileSync(file,code);
process.stdout.write(createHash('sha256').update(code).digest('hex').slice(0,12));
