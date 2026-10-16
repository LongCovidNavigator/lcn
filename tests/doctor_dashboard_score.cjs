const assert=require('node:assert/strict');
const calculate=require('../scripts/doctor_dashboard_score.js');
const options=(count,index,size)=>({options:Array.from({length:size},(_,i)=>({count:i===index?count:0}))});
const input={questions:{},costKey:'costs-gkv',treatmentCount:60,categoryCount:8,editorialCount:4,editorialTotal:29,distance:10};
for(const [key,size] of [['adaptation',5],['costs-gkv',6],['wait',5],['wait-followup',5],['effect',4],['appointment-0-1',2],['appointment-1-2',2]])input.questions[key]=options(9,0,size);
let result=calculate(input);
assert.equal(result.fieldCount,9);
assert.equal(result.availableFieldCount,2); // Therapy profile and personal travel only.
for(const row of result.rows.filter(row=>row.answerCount))assert.equal(row.value,null);
for(const q of Object.values(input.questions))q.options[0].count=10;
result=calculate(input);
assert.equal(result.availableFieldCount,9);
assert.equal(result.coverage,100);
assert.equal(result.rows.reduce((sum,row)=>sum+row.weight,0),100);
for(const [index,points] of [[0,0],[1,5],[2,10],[3,15]]){
 input.questions.effect=options(10,index,4);
 const row=calculate(input).rows.find(row=>row.key==='effect');
 assert.equal(row.value*row.weight,points);
 assert.equal(row.scalePoints[index],points);
}
input.questions['appointment-0-1']=options(9,0,2);
input.questions['appointment-0-2']=options(10,1,2);
assert.equal(calculate(input).rows.find(row=>row.label==='Ersttermin aus der Ferne').value,0); // Nine yes votes must not override ten no votes.
delete input.questions['appointment-0-2'];
assert.equal(calculate(input).rows.find(row=>row.label==='Ersttermin aus der Ferne').value,null);
for(const key of ['wait','wait-followup'])delete input.questions[key];
result=calculate(input);
assert.equal(result.availableFieldCount,6);
assert(result.dataCoverage<70);
input.questions.wait=options(10,0,5);
result=calculate(input);
assert.equal(result.availableFieldCount,7);
assert(result.dataCoverage>=70);
console.log('PASS: ten-answer threshold, equal effect scale, grouped therapy field, remote eligibility, 70% boundary, 100-point weights.');

const travel = data => calculate(data).rows.find(row=>row.label==='Persönliche Anreise');
assert.equal(travel({questions:{},onlineFirst:true}).value,1);
assert.equal(travel({questions:{},distance:10}).value,.8);
assert.equal(travel({questions:{'appointment-0-2':options(10,0,2)}}).value,null);
assert.equal(travel({questions:{'appointment-0-2':options(10,0,2),'appointment-1-2':options(10,0,2)}}).value,1);
assert.equal(travel({questions:{'appointment-0-2':options(10,0,2),'appointment-1-2':options(10,1,2)},distance:10}).value,.8);
assert.equal(travel({questions:{'appointment-0-2':options(10,1,2)},onlineFirst:true}).value,null);
assert.equal(travel({questions:{'appointment-0-3':options(10,0,2)}}).value,null);

const costEight={questions:{'costs-gkv':{options:Array.from({length:8},(_,i)=>({count:i===7?10:0}))}},costKey:'costs-gkv'};assert.equal(calculate(costEight).rows.find(r=>r.label==='Eigene Therapiekosten').value,0);costEight.questions['costs-gkv'].options[7].count=0;costEight.questions['costs-gkv'].options[0].count=10;assert.equal(calculate(costEight).rows.find(r=>r.label==='Eigene Therapiekosten').value,1);
