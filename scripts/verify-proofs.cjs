const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const digest=body=>crypto.createHash('sha256').update(body).digest('hex');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,'proofs',name+'.json')));
const deployment=read('deployment');
assert.equal(deployment.chain_id,61999);
assert.equal(deployment.source_sha256,digest(fs.readFileSync(path.join(root,'contracts/tranche_weave.py'))));
assert.equal(deployment.exact_source_match,true);
assert.equal(deployment.transactions.length,8);
const expected={
 'planned-blocked':{next:0,credits:[0,0],balances:[0,0,0],outcome:'BLOCKED'},
 'unknown-review':{next:0,credits:[0,0],balances:[0,0,0],outcome:'REVIEW'},
 'first-release':{next:1,credits:[20,13],balances:[20,13,0],outcome:'RELEASED'},
 'transfer-vested':{next:1,credits:[20,13],balances:[13,13,7]},
 'restore-blocked':{next:1,credits:[20,13],balances:[13,13,7],outcome:'BLOCKED'},
 'second-release':{next:2,credits:[40,26],balances:[33,26,7],outcome:'RELEASED'},
 'final-release':{next:3,credits:[61,40],balances:[54,40,7],outcome:'RELEASED'}
};
let priorCredits=[0,0];
for(const tx of deployment.transactions){
 const receipt=read(tx.label+'-receipt');
 assert.equal(receipt.hash,tx.hash);
 assert.equal(receipt.status_name||receipt.statusName,'FINALIZED');
 assert.equal(receipt.result_name,'MAJORITY_AGREE');
 assert(['SUCCESS','FINISHED_WITH_RETURN'].includes(receipt.txExecutionResultName||receipt.consensus_data.leader_receipt[0].execution_result));
 assert(Object.values(receipt.consensus_data.votes).filter(vote=>vote==='agree').length>=3);
 if(tx.action==='deploy') continue;
 const proof=read(tx.label),state=proof.state,check=expected[tx.label];
 assert(check,'Unknown scenario');
 assert.equal(proof.contract_address,deployment.contract_address);
 assert.equal(receipt.to_address.toLowerCase(),deployment.contract_address.toLowerCase());
 assert.equal(proof.source_sha256,deployment.source_sha256);
 assert.deepEqual(state.allocations,[61,40]);
 assert.deepEqual(state.credited,check.credits);
 assert.equal(Number(state.next_checkpoint),check.next);
 assert.deepEqual(proof.balances,check.balances);
 assert.equal(Number(state.issued),proof.balances.reduce((a,b)=>a+b,0));
 assert.equal(Number(state.issued),state.credited.reduce((a,b)=>a+b,0));
 const reconstructed=[0,0];
 let next=0;
 for(const row of state.attempts){
  assert.equal(row.checkpoint,next);
  const body=fs.readFileSync(path.join(root,'records',new URL(row.url).pathname.split('/').pop()));
  assert.equal(digest(body),row.sha256);
  assert(row.url.startsWith('https://raw.githubusercontent.com/'+state.policy.source_repository+'/'+deployment.fixture_revision+'/records/'));
  const decisions=row.report.checks.map(item=>item.decision);
  const outcome=decisions.every(item=>item==='MET')?'RELEASED':decisions.includes('NOT_MET')?'BLOCKED':'REVIEW';
  assert.equal(row.outcome,outcome);
  const rules=state.policy.checkpoints[next].conditions;
  assert.equal(row.report.checks.length,rules.length);
  row.report.checks.forEach((item,i)=>{
   assert.equal(item.id,rules[i].id);
   assert(['MET','NOT_MET','UNKNOWN'].includes(item.decision));
   if(item.quote) assert(body.toString().includes(item.quote));
   if(item.decision!=='UNKNOWN') assert(item.quote.length>=12);
  });
  const target=outcome==='RELEASED'?state.allocations.map(value=>Math.floor(value*state.policy.checkpoints[next].basis_points/10000)):reconstructed.slice();
  assert.deepEqual(row.deltas,target.map((value,i)=>value-reconstructed[i]));
  reconstructed.splice(0,2,...target);
  if(outcome==='RELEASED') next++;
 }
 assert.deepEqual(reconstructed,state.credited);
 assert.equal(next,Number(state.next_checkpoint));
 if(tx.action==='evaluate') assert.equal(state.attempts.at(-1).outcome,check.outcome);
 assert(state.credited.every((value,i)=>value>=priorCredits[i]));
 priorCredits=state.credited;
 console.log('VERIFIED',tx.label,JSON.stringify(state.credited),JSON.stringify(proof.balances));
}
assert.equal(Number(read('final-release').state.issued),101);
console.log('Verified eight finalized receipts, committed records, release deltas and supply conservation.');
