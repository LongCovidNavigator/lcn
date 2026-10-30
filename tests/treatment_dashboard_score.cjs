const assert=require('node:assert/strict'),score=require('../scripts/treatment_dashboard_score');
const best={effect:[0,0,0,10],pem:[10,0,0,0],gamechanger:[10,0],setting:[10,0,0,0],access:[0,0,0,10],'unit_cost:GKV':[10],'total_cost:GKV':[10]};
const calc=(counts,travel={},independent=false)=>score(counts,'GKV',null,independent,travel,[0]);
const full=calc(best,{noTravel:true});assert.equal(full.earned,100);assert.equal(full.coverage,100);assert.equal(full.score,100);assert.equal(full.rows.reduce((n,r)=>n+r.weight,0),100);assert.equal(full.fieldCount,7);
const weights=Object.fromEntries(full.rows.map(r=>[r.key,r.weight]));assert.equal(weights.setting+weights.pem+weights.distance,30);assert.equal(weights.access+weights.total_cost,30);assert.equal(weights.effect+weights.gamechanger,40);assert(!full.rows.some(r=>r.key==='providers'));
assert.equal(calc({}).score,null);assert.equal(calc({setting:[9]}).available,0);assert.equal(calc({setting:[10]}).earned,5);
assert.equal(calc(best,{},true).rows.find(r=>r.key==='distance').value,1);assert.equal(calc(best).rows.find(r=>r.key==='distance').value,null);
for(const [distance,value] of [[0,14/15],[20,14/15],[20.1,.6],[50,.6],[100,.4],[300,.2],[800,.1],[801,0]])assert.equal(calc(best,{distance}).rows.find(r=>r.key==='distance').value,value);
const cost=(total,unit)=>calc({'total_cost:GKV':total,'unit_cost:GKV':unit});
assert.equal(cost([10],[29]).costBasis,'total_cost');assert.equal(cost([10],[30]).costBasis,'unit_cost');assert.equal(cost([9],[10]).costBasis,'unit_cost');assert.equal(cost([10],[9]).costBasis,'total_cost');
assert.equal(cost([10,0,0,0,0,0,0,0,11],[10]).costBasis,'unit_cost');assert.equal(cost([10,0,0,0,0,0,0,0,11],[9]).coverage,0);
assert.equal(cost([],Array(8).fill(0).concat([50])).coverage,0);assert.equal(cost([],Array(9).fill(0).concat([10])).earned,20);
assert.equal(calc(best,{noTravel:true}).rows.filter(r=>r.key.includes('cost')).length,1);
assert.equal(score(best,'GKV',1,false,{distance:10}).earned,score(best,'GKV',999,false,{distance:10}).earned);
assert.equal(score(best,'PKV').rows.find(r=>r.key.includes('cost')).value,null);
console.log('PASS: 30/30/40; provider count excluded; one 20-point cost basis, +20 boundary, unreliable/unknown costs; no-travel and distance bands; ten-answer threshold.');

// One prescription journey halves the deduction, not the remaining points.
for(const [distance,points] of [[20,14.5],[50,12],[100,10.5],[300,9],[800,8.25],[801,7.5]]){
  const row=calc(best,{distance,prescriptionRequired:true,oneOffPrescription:true},true).rows.find(r=>r.key==='distance');
  assert.equal(row.value*15,points);assert.equal(row.noTravel,false);
}
assert.equal(calc(best,{prescriptionRequired:true,oneOffPrescription:true},true).rows.find(r=>r.key==='distance').value,null);
assert.equal(calc(best,{distance:801,prescriptionRequired:true},true).rows.find(r=>r.key==='distance').value,0);
assert.equal(calc(best,{prescriptionRequired:true,oneOffPrescription:true,noTravel:true},true).rows.find(r=>r.key==='distance').value,1);
console.log('PASS: prescription overrides home exemption, half deduction once, full deduction recurring, unknown distance and remote exemption.');

const game=(share,peers)=>score({gamechanger:[share*100,(1-share)*100]},'GKV',null,false,{},peers).rows.find(r=>r.key==='gamechanger');
assert.equal(game(.2,[.01,.05,.1]).value,1);
assert.equal(game(.01,[.05,.1,.2]).value,0);
assert.equal(game(.1,[.05,.2]).value,.5);
assert.equal(game(.1,[.1,.1]).value,.5);
assert.equal(game(.1,[]).value,null);
assert.equal(game(.1,[.2]).rawValue,.1);
assert.ok(Math.abs(game(.1,[.01,.02,.03,.2,.3,.4,.5,.6,.7,.8]).value-.25)<1e-12);
console.log('PASS: relative Gamechanger top/bottom decile, interpolation, ties, missing peers and retained raw share.');
