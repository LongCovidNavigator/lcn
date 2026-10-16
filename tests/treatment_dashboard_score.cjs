const assert=require('node:assert/strict');
const score=require('../scripts/treatment_dashboard_score');
const best={effect:[0,0,0,10],pem:[10,0,0,0],gamechanger:[10,0],'unit_cost:GKV':[10],'total_cost:GKV':[10],setting:[10,0,0,0],access:[0,0,0,10]};
const full=score(best,'GKV',10);assert.equal(full.score,100);assert.equal(full.earned,100);assert.equal(full.coverage,100);assert.equal(full.available,7);assert.equal(full.rows.reduce((n,r)=>n+r.weight,0),100);
assert.equal(score({}).score,null);assert.equal(score({setting:[9]}).available,0);assert.equal(score({setting:[10]}).earned,10);
for(const key of ['setting','access']){const values=key==='setting'?[10,0,0,0]:[0,0,0,10];assert.equal(score({[key]:values}).earned,10);}
const setting=[0,1,2,3].map(i=>score({setting:Array.from({length:4},(_,j)=>j===i?10:0)}).earned);assert(setting.every((v,i)=>i===0||v<setting[i-1]));
const access=[3,0,1,2].map(i=>score({access:Array.from({length:4},(_,j)=>j===i?10:0)}).earned);assert(access.every((v,i)=>i===0||v<access[i-1]));
assert.equal(score({'unit_cost:GKV':[0,0,0,0,0,0,0,0,10]}).available,0);
assert.equal(score({'unit_cost:GKV':[0,0,0,0,0,0,0,0,0,10]}).earned,10);
assert.equal(score(best,'GKV',10).earned,100);assert.equal(score({},'GKV',true,true).earned,0);
const four={effect:best.effect,pem:best.pem,gamechanger:best.gamechanger,setting:best.setting};assert.equal(score(four).dataCoverage>70,false);four.access=best.access;assert.equal(score(four).dataCoverage>70,true);
console.log('PASS: seven fields, correct ordering, ten-answer threshold, >70% reference, 100-point maximum and no duplicate home bonus.');

for(const [count,earned] of [[0,0],[1,.5],[5,2.5],[10,5],[50,5]])assert.equal(score({},'GKV',count).rows.find(r=>r.key==='providers').value*5,earned);
assert.equal(score({},'GKV',null).rows.find(r=>r.key==='providers').value,null);
assert.equal(score({},'GKV',0,true).rows.find(r=>r.key==='providers').value,null);
assert.equal(score({},'GKV',10).dataCoverage,0);
assert.equal(score(best,'GKV',0,true).score,100);
console.log('PASS: provider weight capped at five, unknown counts omitted, self-management excluded, no artificial community coverage.');
