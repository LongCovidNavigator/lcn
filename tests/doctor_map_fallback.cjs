const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('scripts/arzt_detail_konzept.js','utf8');
const fn=source.slice(source.indexOf('  function createMap('),source.indexOf('  function savedLocation()'));
for(const [country,expected] of [['DE',[[47.2,5.8],[55.1,15.1]]],['AT',[[46.3,9.5],[49.1,17.2]]],['CH',[[45.8,5.9],[47.9,10.5]]],['CY',[[34.9,5.8],[55.1,33.6]]]]) {
 for(const own of [null,{lat:51.65,lng:7.09,label:'Marl'}]) {
  const fits=[],markers=[];
  const map={on(){return this;},latLngToContainerPoint:([lat,lng])=>({x:lng*100,y:lat*100}),fitBounds:b=>{fits.push(b);return map;},setView(){throw Error('Missing coordinates must use country bounds');}};
  const doctor={loc_country:country,loc_lat:country==='CY'?34.9:47.8,loc_lng:country==='CY'?33.6:10};
  const sandbox={state:{data:{item:doctor}},window:{LCNImages:{urls:{},configureLeaflet(){}}},document:{querySelector:()=>null},doctorId:1148,locationCity:'',locationRadiusEnabled:false,savedLocation:()=>own,practiceLocations:()=>[doctor],escape:v=>v,address:()=> 'Praxisadresse',L:{map:()=>map,control:{zoom:()=>({addTo(){}})},tileLayer:()=>({addTo(){}}),icon:()=>({}),marker:point=>{markers.push(point);return {addTo(){return this;},bindPopup(){return this;},bindTooltip(){return this;}};}}};
  vm.createContext(sandbox);vm.runInContext(source.slice(source.indexOf('  function isOnlinePostalAddress('),source.indexOf('  function dataStatus()')),sandbox);vm.runInContext(fn,sandbox);
  const element={replaceChildren(){},classList:{toggle(){}}};
  assert(sandbox.createMap(element));
  const bounds=own?[[doctor.loc_lat,doctor.loc_lng],[own.lat,own.lng]]:JSON.parse(JSON.stringify(expected));
  assert.deepEqual(JSON.parse(JSON.stringify(fits)),[bounds]);
  assert.equal(markers.length,own?2:1);
  doctor.loc_lat=null;doctor.loc_lng=null;fits.length=0;markers.length=0;
  assert.equal(sandbox.createMap(element),null);
  assert.equal(element.textContent,'Für diesen Arzt liegen keine Koordinaten vor.');
  assert.equal(markers.length,0);assert.equal(fits.length,0);
  doctor.loc_label='Online-Praxis / Postadresse – kein Vor-Ort-Behandlungsort';
  assert.equal(sandbox.createMap(element),null);
  assert(element.innerHTML.includes('Keine Vor-Ort-Behandlung'));
  assert(element.innerHTML.includes('Postadresse in Google Maps ansehen'));
  assert(element.innerHTML.includes('Praxisadresse'));
  doctor.loc_label='Praxis mit Online-Terminen';
  assert.equal(sandbox.isOnlinePostalAddress(doctor),false);
 }
}
console.log('PASS: DE/AT/CH overview with practice markers; missing coordinates show explicit message instead of a map.');
