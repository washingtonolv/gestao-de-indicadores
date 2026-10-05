const {buildSync}=require('esbuild');
const result=buildSync({entryPoints:['beta/cloud.js'],bundle:true,minify:true,format:'iife',platform:'browser',target:'es2022',write:false,legalComments:'inline'});
process.stdout.write(result.outputFiles[0].text);
