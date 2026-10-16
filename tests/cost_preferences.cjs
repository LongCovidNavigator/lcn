const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
(async()=>{
  const stored=new Map();
  let done;
  const ready=new Promise(resolve=>done=resolve);
  const window={dispatchEvent:()=>done()};
  const sandbox={window,Intl,Event,localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)},
    fetch:async()=>({ok:true,json:async()=>({ok:true,date:'2026-10-15',rates:{EUR:1,CHF:.9305,USD:1.1208,GBP:.8461}})})};
  const source=fs.readFileSync(require.resolve('../scripts/cost_preferences.js'),'utf8');
  vm.runInNewContext(source,sandbox);await ready;
  const cost=window.LCNCost;
  assert.equal(cost.context(),'GKV');
  assert.equal(cost.systems.DE.some(([key])=>key==='DE-SELF'),false);
  cost.set({currency:'GBP'});
  assert.equal(cost.context(),'GKV'); // Display conversion must never move an answer to another bucket.
  assert.equal(cost.amount('bis 100 €'),'bis 100 €');
  assert.equal(cost.converted('bis 100 €'),'≈ bis 84,61 £');
  assert.equal(cost.converted('kostenlos'),'');
  cost.set({country:'CH',currency:'CHF'});
  assert.equal(cost.context(),'CH-BASIC-CHF');
  assert.equal(cost.amount('bis 100 €'),'bis 100 CHF');
  assert.equal(cost.converted('bis 100 €'),'');
  cost.set({currency:'EUR'});
  assert.equal(cost.context(),'CH-BASIC-CHF');
  assert.equal(cost.converted('bis 100 €'),'≈ bis 107,47 €');
  cost.set({currency:'USD'});
  assert.equal(cost.converted('bis 100 €'),'≈ bis 120,45 $');
  const restored={dispatchEvent(){}};vm.runInNewContext(source,{...sandbox,window:restored});
  assert.equal(restored.LCNCost.get().country,'CH');assert.equal(restored.LCNCost.get().currency,'USD');assert.equal(restored.LCNCost.context(),'CH-BASIC-CHF');
  console.log('PASS: native currency contexts, EUR/CHF/USD/GBP conversion, no German self-pay option, persistence.');
})().catch(error=>{console.error(error);process.exitCode=1;});
