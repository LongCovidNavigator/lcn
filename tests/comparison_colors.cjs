const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const provider=require('../scripts/doctor_relative_score_view');
const treatment=fs.readFileSync('scripts/treatments_nd_reduced.js','utf8');
const context={};
vm.createContext(context);
for(const name of ['topPercentLabel','relativeScoreLevel']) {
 vm.runInContext(treatment.match(new RegExp('function '+name+'\\([^]*?\\n  }'))[0],context);
}
for(const rank of [1,20,20.01,40,40.01,60,60.01,80,80.01,100]) {
 assert.equal(context.relativeScoreLevel(rank),provider.relativeScoreLevel(rank));
 assert.equal(context.topPercentLabel(rank),provider.topPercentLabel(rank));
}
assert(treatment.includes("const badgeLevel=rank!=null?"));
const doctor=fs.readFileSync('scripts/arzt_detail_konzept.js','utf8');
assert(!doctor.slice(doctor.indexOf('function dashboard()'),doctor.indexOf('function dashboard()')+2500).includes('effectComparison()'));
const save=doctor.slice(doctor.indexOf('async function saveLocation('),doctor.indexOf('  function clearLocation()'));
const status={textContent:''},stored={};
let refreshed=false;
const form={elements:{doctor_location_query:{value:'Marl'}},querySelector:()=>status,setAttribute(){},removeAttribute(){}};
const sandbox={AbortController,locationRequest:null,isSubmission:false,fetch:async()=>({ok:true,json:async()=>({ok:true,result:{formatted:'Marl',city:'Marl',lat:51.65,lng:7.09}})}),localStorage:{setItem:(k,v)=>stored[k]=v,removeItem(){}},refreshLocation:()=>{refreshed=true;},notify(){}};
vm.createContext(sandbox);
vm.runInContext(save,sandbox);
sandbox.saveLocation(form).then(()=>{
 assert(refreshed,'Enter submission must refresh the map without a submit button');
 assert.equal(JSON.parse(stored.lcn_shared_location_preference).label,'Marl');
 console.log('PASS: shared provider/treatment color tiers, full percentile range, dashboard comparison removed, button-free location submission.');
}).catch(error=>{console.error(error);process.exitCode=1;});
