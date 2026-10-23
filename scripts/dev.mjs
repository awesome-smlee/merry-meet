// Accept the preview supervisor's Vite-style flags while starting genuine Next.js.
import {spawn} from 'node:child_process';
const args=process.argv.slice(2),port=args.includes('--port')?args[args.indexOf('--port')+1]:'4173';
const child=spawn(process.execPath,['node_modules/next/dist/bin/next',args.includes('--strictPort')?'start':'dev','--hostname','0.0.0.0','--port',port],{stdio:'inherit'});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code||0));
