const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const handlers={},historyCalls=[];
const panels=Object.fromEntries(['ueberblick','termin','wirkung'].map(id=>[id,{id,hidden:false,closest(){return this;}}]));
const links=Object.keys(panels).map(id=>({dataset:{view:id},setAttribute(){},removeAttribute(){},addEventListener(){}}));
const context={document:{getElementById:id=>panels[id]||null,querySelector:s=>s==='.nd-detail .detail-layout'?{contains:()=>true}:s==='.ux-detail #view-content'?{scrollIntoView(){}}:null,querySelectorAll:()=>links,addEventListener:(type,fn)=>handlers[type]=fn},window:{addEventListener(){}},location:{hash:'#termin'},history:{pushState:(...args)=>historyCalls.push(args)}};
vm.runInNewContext(fs.readFileSync('scripts/treatments_nd.js','utf8'),context);
function click(href,defaultPrevented=false){const event={defaultPrevented,target:{closest:()=>({getAttribute:()=>href})},preventDefault(){this.defaultPrevented=true;}};handlers.click(event);return event;}
assert.equal(panels.termin.hidden,false);
click('#',true);click('#');click('#missing-control');
assert.equal(historyCalls.length,0);
assert.equal(panels.termin.hidden,false);
click('#wirkung');
assert.equal(historyCalls.length,1);
assert.equal(panels.wirkung.hidden,false);
assert.equal(panels.termin.hidden,true);
console.log('PASS: popup close and unknown anchors preserve the active panel; content navigation still works.');
