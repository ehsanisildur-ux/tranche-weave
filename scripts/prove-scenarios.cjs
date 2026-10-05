const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const cli = process.env.GENLAYER_CLI_PATH;
const passwordFile = process.env.TRANCHEWEAVE_PASSWORD_FILE;
const account = process.env.TRANCHEWEAVE_ACCOUNT;
const address = process.env.TRANCHEWEAVE_DEPLOYER_ADDRESS;
if (!cli || !fs.existsSync(cli) || !passwordFile || !fs.existsSync(passwordFile) || !account || !/^0x[0-9a-f]{40}$/i.test(address || '')) throw Error('Set GENLAYER_CLI_PATH, TRANCHEWEAVE_PASSWORD_FILE, TRANCHEWEAVE_ACCOUNT and TRANCHEWEAVE_DEPLOYER_ADDRESS.');
const password = fs.readFileSync(passwordFile, 'utf8').trim();
const hook = path.join(__dirname, 'cli-config.cjs');
const source = fs.readFileSync(path.join(root, 'contracts/tranche_weave.py'));
const sourceHash = crypto.createHash('sha256').update(source).digest('hex');
const revision = fs.readFileSync(path.join(root, 'config/fixture-revision.txt'), 'utf8').trim();
const repo = 'ehsanisildur-ux/tranche-weave';
const journal = path.join(root, '.proof-journal/studionet');
const proofs = path.join(root, 'proofs');
fs.mkdirSync(journal, { recursive: true });
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const canonical = value => JSON.stringify(value,(_,item)=>item && !Array.isArray(item) && typeof item==='object' ? Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])) : item);
const equal = (a,b)=>canonical(a)===canonical(b);
const expectedDecisions={planned:['NOT_MET','NOT_MET'],ambiguous:['UNKNOWN','UNKNOWN'],release:['MET','MET'],'restore-failed':['NOT_MET','NOT_MET'],restore:['MET','MET'],handover:['MET','MET']};
const second='0x1111111111111111111111111111111111111111';
const third='0x2222222222222222222222222222222222222222';

function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === 'node_config') continue;
    result[key] = /private.?key|api.?key|password|secret|authorization/i.test(key) ? 'REDACTED' : sanitize(item);
  }
  return result;
}
function save(name, value) { fs.writeFileSync(path.join(proofs, name + '.json'), JSON.stringify(sanitize(value), null, 2) + '\n'); }
function result(output) {
  const start = output.indexOf('Result:');
  if (start < 0) throw Error('CLI result missing: ' + output.slice(-300));
  return JSON.parse(output.slice(start + 7).trim());
}
function invoke(label, args, overrides = {}) {
  const file = path.join(journal, label + '.json');
  const prior = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  if (prior.complete && (!['receipt', 'call'].includes(args[0]) || prior.stdout.includes('Result:'))) return Promise.resolve(prior.stdout);
  if (prior.hash && args[0] === 'write') return Promise.resolve('Write Transaction Hash: ' + prior.hash);
  if (prior.hash && args[0] === 'deploy') overrides.TRANCHEWEAVE_RESUME_HASH = prior.hash;
  console.log('RUN', label);
  return new Promise((resolve, reject) => {
    const child = cp.spawn(process.execPath, ['--require', hook, cli, ...args], {
      cwd: root, windowsHide: true,
      env: { ...process.env, NO_COLOR: '1', TRANCHEWEAVE_ACCOUNT: account, ...overrides },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    child.stdin.end(password + '\n');
    let stdout = '', stderr = '', hash = prior.hash;
    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
      const found = stdout.match(/(?:Deployment|Write) Transaction Hash:\s*(0x[0-9a-f]{64})/i)?.[1];
      if (found && found !== hash) {
        hash = found;
        fs.writeFileSync(file, JSON.stringify({ hash, complete: false }));
        console.log('SUBMITTED', label, hash);
      }
    });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', code => {
      fs.writeFileSync(file, JSON.stringify({ hash, complete: code === 0, stdout, stderr }));
      if (code) reject(Error(label + ': ' + stderr.slice(-1200)));
      else resolve(stdout);
    });
  });
}
async function receipt(label, hash) {
  const data = result(await invoke(label + '-receipt', ['receipt', hash, '--retries', '300', '--interval', '3000']));
  save(label + '-receipt', data);
  const status = data.statusName || data.status_name;
  const execution = data.txExecutionResultName || data.consensus_data?.leader_receipt?.[0]?.execution_result;
  if (status !== 'FINALIZED' || data.result_name !== 'MAJORITY_AGREE' || !['SUCCESS', 'FINISHED_WITH_RETURN'].includes(execution)) throw Error(label + ': ' + status + '/' + data.result_name + '/' + execution);
  console.log('FINALIZED', label, hash, execution);
  return data;
}
async function rpc(method, params) {
  const response = await fetch('https://studio.genlayer.com/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(30000) });
  const data = await response.json();
  if (!response.ok || data.error) throw Error(JSON.stringify(data.error || response.status));
  return data.result;
}

(async()=>{
  if(await rpc('eth_chainId',[])!=='0xf22f') throw Error('Unexpected chain ID');
  const sources={};
  for(const name of Object.keys(expectedDecisions)) {
    const body=fs.readFileSync(path.join(root,'records',name+'.md'));
    const url=`https://raw.githubusercontent.com/${repo}/${revision}/records/${name}.md`;
    const upstream=await fetch(url);
    if(!upstream.ok || !body.equals(Buffer.from(await upstream.arrayBuffer()))) throw Error('Fixture mismatch '+name);
    sources[name]={url,sha256:digest(body)};
  }
  const deployed=result(await invoke('pool-deploy',['deploy']));
  const contract=deployed['Contract Address'], deployHash=deployed['Transaction Hash'];
  await receipt('pool-deploy',deployHash);
  const transactions=[{label:'pool-deploy',action:'deploy',hash:deployHash}];
  const steps=[
    {name:'planned-blocked',method:'evaluate',source:'planned',index:0,credits:[0,0],balances:[0,0,0],next:0,outcome:'BLOCKED'},
    {name:'unknown-review',method:'evaluate',source:'ambiguous',index:0,credits:[0,0],balances:[0,0,0],next:0,outcome:'REVIEW'},
    {name:'first-release',method:'evaluate',source:'release',index:0,credits:[20,13],balances:[20,13,0],next:1,outcome:'RELEASED'},
    {name:'transfer-vested',method:'transfer',credits:[20,13],balances:[13,13,7],next:1},
    {name:'restore-blocked',method:'evaluate',source:'restore-failed',index:1,credits:[20,13],balances:[13,13,7],next:1,outcome:'BLOCKED'},
    {name:'second-release',method:'evaluate',source:'restore',index:1,credits:[40,26],balances:[33,26,7],next:2,outcome:'RELEASED'},
    {name:'final-release',method:'evaluate',source:'handover',index:2,credits:[61,40],balances:[54,40,7],next:3,outcome:'RELEASED'},
  ];
  for(const step of steps) {
    // Leave room for receipt polls and shared gateway rate limits.
    await new Promise(resolve=>setTimeout(resolve,15000));
    const args=step.method==='evaluate'?[String(step.index),sources[step.source].url,sources[step.source].sha256]:[third,'7'];
    const output=await invoke(step.name,['write',contract,step.method,'--args',...args]);
    const hash=output.match(/Write Transaction Hash:\s*(0x[0-9a-f]{64})/i)?.[1];
    if(!hash) throw Error('Missing write hash');
    await receipt(step.name,hash);
    transactions.push({label:step.name,action:step.method,hash});
    const state=result(await invoke(step.name+'-state',['call',contract,'get_state']));
    const balances=[];
    for(const holder of [address,second,third]) balances.push(Number(result(await invoke(step.name+'-balance-'+holder,['call',contract,'balance_of','--args',holder]))));
    if(!equal(state.credited,step.credits) || Number(state.next_checkpoint)!==step.next || Number(state.issued)!==step.credits.reduce((a,b)=>a+b,0) || !equal(balances,step.balances)) throw Error('Unexpected vesting state '+step.name+': '+JSON.stringify(state));
    if(step.method==='evaluate') {
      const row=state.attempts.at(-1);
      if(!equal(row.report.checks.map(item=>item.decision),expectedDecisions[step.source]) || row.sha256!==sources[step.source].sha256 || row.outcome!==step.outcome) throw Error('Unexpected checkpoint judgment');
    }
    save(step.name,{network:'studionet',chain_id:61999,contract_address:contract,source_sha256:sourceHash,fixture_revision:revision,transaction:transactions.at(-1),holders:[address,second,third],balances,state});
    console.log('STATE VERIFIED',step.name,JSON.stringify(state.credited),JSON.stringify(balances));
  }
  const codeOutput=await invoke('pool-code',['code',contract]);
  const start=codeOutput.indexOf('# { "Depends":');
  if(start<0 || codeOutput.slice(start,start+source.length)!==source.toString()) throw Error('Deployed source mismatch');
  save('deployment',{network:'studionet',chain_id:61999,contract_address:contract,source_sha256:sourceHash,exact_source_match:true,fixture_revision:revision,sources,transactions});
  console.log('SOURCE VERIFIED',contract);
})().catch(error=>{console.error(error.message);process.exitCode=1});
