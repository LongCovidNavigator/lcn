const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const score=require('../scripts/treatment_dashboard_score');
const source=fs.readFileSync(require.resolve('../scripts/treatments_nd_reduced.js'),'utf8');
const body=source.slice(source.indexOf('  function referenceProfile('),source.indexOf('  function renderSummaries('));
const compose=demo=>vm.runInNewContext(body+';referenceProfile',{demo});
(async()=>{
 const data=await(await fetch('http://localhost/lcn/api/treatment_answer.php?treatment_id=2')).json();
 assert.equal(data.ok,true);assert(data.comparison_profiles.length>6);
 for(const p of data.comparison_profiles){
  const combined=compose(true)(p,'GKV');
  const result=score(combined.counts,'GKV',p.provider_count,p.independent_at_home);
  assert.equal(result.available,7,'Every catalog therapy needs all seven dummy score fields');
  assert(result.rows.filter(r=>r.total!==null).every(r=>r.total>=10));
 }
 const profile={counts:{effect:[1,2,3,4]},dummy_counts:{effect:[5,6,7,8]}};
 assert.deepEqual(Array.from(compose(false)(profile,'GKV').counts.effect),[1,2,3,4]);
 assert.deepEqual(Array.from(compose(true)(profile,'GKV').counts.effect),[6,8,10,12]);
 assert.equal(score({effect:[0,0,0,9]}).available,0);
 assert.equal(score({effect:[0,0,0,10]}).available,1);
 assert.equal(score({effect:[0,0,0,10],pem:[10,0,0,0],gamechanger:[10,0]}).dataCoverage>70,false);
 assert.equal(score({effect:[0,0,0,10],pem:[10,0,0,0],gamechanger:[10,0],'unit_cost:GKV':[10],setting:[10]}).dataCoverage>70,true);
 console.log('PASS: '+data.comparison_profiles.length+' catalog therapies; separate dummy counts; ten-answer and >70% thresholds.');
})().catch(error=>{console.error(error);process.exitCode=1;});
