const assert=require('node:assert/strict');
const calculate=require('../scripts/doctor_dashboard_score.js');
const options=(count,index,size)=>({options:Array.from({length:size},(_,i)=>({count:i===index?count:0}))});
const input={questions:{},costKey:'costs-gkv',treatmentCount:60,categoryCount:8,editorialCount:4,editorialTotal:29,distance:10};
for(const [key,size] of [['adaptation',5],['costs-gkv',6],['wait',5],['wait-followup',5],['effect',4],['appointment-0-1',2],['appointment-1-2',2]])input.questions[key]=options(10,0,size);
let result=calculate(input);
assert.equal(result.fieldCount,9);
assert.equal(result.availableFieldCount,2); // Therapy profile and personal travel only.
for(const row of result.rows.filter(row=>row.answerCount))assert.equal(row.value,null);
for(const q of Object.values(input.questions))q.options[0].count=11;
result=calculate(input);
assert.equal(result.availableFieldCount,9);
assert.equal(result.coverage,100);
assert.equal(result.rows.reduce((sum,row)=>sum+row.weight,0),100);
for(const [index,points] of [[0,0],[1,5],[2,10],[3,15]]){
 input.questions.effect=options(11,index,4);
 const row=calculate(input).rows.find(row=>row.key==='effect');
 assert.equal(row.value*row.weight,points);
 assert.equal(row.scalePoints[index],points);
}
input.questions['appointment-0-1']=options(10,0,2);
input.questions['appointment-0-2']=options(11,1,2);
assert.equal(calculate(input).rows.find(row=>row.label==='Ersttermin aus der Ferne').value,0); // Ten yes votes must not override eleven no votes.
delete input.questions['appointment-0-2'];
assert.equal(calculate(input).rows.find(row=>row.label==='Ersttermin aus der Ferne').value,null);
for(const key of ['wait','wait-followup'])delete input.questions[key];
result=calculate(input);
assert.equal(result.availableFieldCount,6);
assert(result.dataCoverage<70);
input.questions.wait=options(11,0,5);
result=calculate(input);
assert.equal(result.availableFieldCount,7);
assert(result.dataCoverage>=70);
console.log('PASS: eleven-answer threshold, equal effect scale, grouped therapy field, remote eligibility, 70% boundary, 100-point weights.');
