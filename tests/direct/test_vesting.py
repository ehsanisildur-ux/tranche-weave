import hashlib
import json
import re
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[2]
POLICY = json.loads((ROOT/'config/policy.json').read_text())
DOCS = {name: (ROOT/'records'/f'{name}.md').read_bytes() for name in ['planned','ambiguous','release','restore-failed','restore','handover']}
DECISIONS = {'planned':['NOT_MET']*2,'ambiguous':['UNKNOWN']*2,'release':['MET']*2,'restore-failed':['NOT_MET']*2,'restore':['MET']*2,'handover':['MET']*2}
POINT = {'planned':0,'ambiguous':0,'release':0,'restore-failed':1,'restore':1,'handover':2}
def addr(value): return '0x'+value.hex() if isinstance(value, bytes) else str(value)
def source(name): return f"https://raw.githubusercontent.com/ehsanisildur-ux/tranche-weave/{'a'*40}/records/{name}.md",hashlib.sha256(DOCS[name]).hexdigest()
def answer(name, decisions=None):
    lines=DOCS[name].decode().splitlines()[1:]
    return {'checks':[{'id':rule['id'],'decision':decision,'quote':lines[i] if decision!='UNKNOWN' else ''} for i,(rule,decision) in enumerate(zip(POLICY['checkpoints'][POINT[name]]['conditions'],decisions or DECISIONS[name]))]}
def mock(vm,name,independent=None,anchors=None,changed=None,report=None):
    vm.clear_mocks()
    vm.mock_web(re.escape(source(name)[0]),{'status':200,'body':changed or DOCS[name]})
    vm.mock_llm(r'.*TRANCHEWEAVE-LEADER.*',json.dumps(report or answer(name)))
    vm.mock_llm(r'.*TRANCHEWEAVE-VALIDATOR.*',json.dumps(answer(name,independent)))
    vm.mock_llm(r'.*TRANCHEWEAVE-ANCHORS.*',json.dumps({'valid':anchors or [True]*2}))
@pytest.fixture
def vest(direct_deploy,direct_vm,direct_alice,direct_bob):
    contract=direct_deploy(str(ROOT/'contracts/tranche_weave.py'),json.dumps(POLICY),json.dumps([{'address':addr(direct_alice),'weight':6000},{'address':addr(direct_bob),'weight':4000}]),101)
    direct_vm.sender=direct_alice
    return contract
def evaluate(c,vm,name):
    mock(vm,name);c.evaluate(POINT[name],*source(name))
def test_apportionment_and_full_release(vest,direct_vm):
    assert vest.get_state()['allocations']==[61,40]
    for name,credit in [('release',[20,13]),('restore',[40,26]),('handover',[61,40])]:
        evaluate(vest,direct_vm,name)
        state=vest.get_state();assert state['credited']==credit;assert state['issued']==sum(credit)
    assert vest.get_state()['next_checkpoint']==3
def test_blocked_and_unknown_do_not_issue(vest,direct_vm):
    for name in ['planned','ambiguous']: evaluate(vest,direct_vm,name)
    assert [row['outcome'] for row in vest.get_state()['attempts']]==['BLOCKED','REVIEW']
    assert vest.get_state()['issued']==0
    evaluate(vest,direct_vm,'release');assert vest.get_state()['issued']==33
def test_transfer_preserves_supply_and_later_credits(vest,direct_vm,direct_alice,direct_bob,direct_charlie):
    evaluate(vest,direct_vm,'release');vest.transfer(addr(direct_charlie),7)
    assert [vest.balance_of(addr(a)) for a in [direct_alice,direct_bob,direct_charlie]]==[13,13,7]
    evaluate(vest,direct_vm,'restore');evaluate(vest,direct_vm,'handover')
    assert [vest.balance_of(addr(a)) for a in [direct_alice,direct_bob,direct_charlie]]==[54,40,7]
    assert vest.get_state()['issued']==101
def test_no_checkpoint_skip_or_replay(vest,direct_vm):
    with direct_vm.expect_revert('Only current checkpoint'):vest.evaluate(1,*source('restore'))
    evaluate(vest,direct_vm,'release')
    with direct_vm.expect_revert('Only current checkpoint'):vest.evaluate(0,*source('release'))
def test_duplicate_failed_record(vest,direct_vm):
    evaluate(vest,direct_vm,'planned')
    with direct_vm.expect_revert('already evaluated'):vest.evaluate(0,*source('planned'))
def test_outsider_cannot_consume_attempts(vest,direct_vm,direct_charlie):
    direct_vm.sender=direct_charlie
    with direct_vm.expect_revert('Only allocated recipients'):vest.evaluate(0,*source('release'))
@pytest.mark.parametrize('amount',[0,-1,21])
def test_invalid_transfer(vest,direct_vm,direct_bob,amount):
    evaluate(vest,direct_vm,'release')
    with direct_vm.expect_revert():vest.transfer(addr(direct_bob),amount)
def test_self_transfer(vest,direct_vm,direct_alice):
    with direct_vm.expect_revert('Self transfer'):vest.transfer(addr(direct_alice),1)
def test_unvested_balance(vest,direct_vm,direct_bob):
    with direct_vm.expect_revert('Insufficient'):vest.transfer(addr(direct_bob),1)
@pytest.mark.parametrize('decision',['NOT_MET','UNKNOWN'])
def test_validator_exact_gate(vest,direct_vm,decision):
    evaluate(vest,direct_vm,'release')
    mock(direct_vm,'release',independent=[decision,'MET'])
    assert direct_vm.run_validator() is False
def test_validator_anchor_relevance(vest,direct_vm):
    evaluate(vest,direct_vm,'release');mock(direct_vm,'release',anchors=[False,True])
    assert direct_vm.run_validator() is False
def test_validator_refetches_bytes(vest,direct_vm):
    evaluate(vest,direct_vm,'release');mock(direct_vm,'release',changed=DOCS['release']+b'changed')
    assert direct_vm.run_validator() is False
def test_forged_quote(vest,direct_vm):
    report=answer('release');report['checks'][0]['quote']='This quote does not occur in the record.';mock(direct_vm,'release',report=report)
    with direct_vm.expect_revert('Unanchored'):vest.evaluate(0,*source('release'))
@pytest.mark.parametrize('url',['https://example.com/record.md',f"https://raw.githubusercontent.com/attacker/tranche-weave/{'a'*40}/records/release.md",f"https://raw.githubusercontent.com/ehsanisildur-ux/tranche-weave/{'a'*40}/records/../release.md"])
def test_source_restriction(vest,direct_vm,url):
    with direct_vm.expect_revert('pinned publisher'):vest.evaluate(0,url,'a'*64)
def test_tiny_supply_rounding(direct_deploy,direct_vm,direct_alice,direct_bob):
    c=direct_deploy(str(ROOT/'contracts/tranche_weave.py'),json.dumps(POLICY),json.dumps([{'address':addr(direct_alice),'weight':5000},{'address':addr(direct_bob),'weight':5000}]),1)
    direct_vm.sender=direct_alice
    assert c.get_state()['allocations']==[1,0]
    for name in ['release','restore']:evaluate(c,direct_vm,name);assert c.get_state()['issued']==0
    evaluate(c,direct_vm,'handover');assert c.get_state()['issued']==1
