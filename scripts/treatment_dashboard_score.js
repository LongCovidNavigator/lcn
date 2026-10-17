/* Personal orientation score: burden 30, access 30, experiences 40. */
(function(root){
  const definitions=[
    ['effect','Berichtete Zustandsveränderung',30,[0,1/3,2/3,1]],
    ['pem','Crash-/PEM-Risiko',10,[1,2/3,1/3,0]],
    ['gamechanger','Gamechanger',10,[1,0]],
    ['setting','Durchführungssetting',5,[1,2/3,1/3,0]],
    ['access','Zugangsweg',10,[2/3,1/3,0,1]]
  ];
  const costScale=[1,6/7,5/7,4/7,3/7,2/7,1/7,0,null,1];
  function field(counts,key,label,weight,scale,context){
    const values=counts[key+(key.includes('cost')?':'+context:'')]||[];
    const total=values.reduce((n,v,i)=>n+(scale[i]==null?0:Number(v||0)),0);
    const value=total>=10?values.reduce((n,v,i)=>n+Number(v||0)*(scale[i]??0),0)/total:null;
    return {key,label,weight,total,value,scale,notApplicable:Number(values[8]||0)};
  }
  function calculate(counts,context='GKV',unusedProviderCount=null,independentAtHome=false,travel={}){
    const rows=definitions.map(([key,label,weight,scale])=>field(counts,key,label,weight,scale,context));
    const unit=field(counts,'unit_cost','Kosten pro Einheit',20,costScale,context),total=field(counts,'total_cost','Gesamtkosten',20,costScale,context);
    const totalUnreliable=total.total<10||total.notApplicable>total.total;
    const chooseUnit=unit.total>=10&&(totalUnreliable||unit.total>=total.total+20);
    const cost=chooseUnit?unit:total;
    cost.reason=chooseUnit?(totalUnreliable?'Einzelkosten ersetzen nicht ausreichend auswertbare Gesamtkosten.':'Einzelkosten haben mindestens 20 auswertbare Angaben mehr als Gesamtkosten.'):'Gesamtkosten haben Vorrang. Einzelkosten übernehmen ab zehn auswertbaren Angaben bei unzureichenden Gesamtkosten oder mindestens 20 Angaben Vorsprung.';
    if(!chooseUnit&&totalUnreliable){cost.value=null;cost.reason='Gesamtkosten nicht zuverlässig auswertbar und weniger als zehn auswertbare Einzelkostenangaben.';}
    rows.push(cost);
    const distance=Number.isFinite(travel.distance)&&travel.distance>=0?travel.distance:null;
    const noTravel=independentAtHome||travel.noTravel===true;
    const band=distance===null?null:[20,50,100,300,800,Infinity].findIndex(n=>distance<=n);
    rows.push({key:'distance',label:'Persönliche Anreise',weight:15,total:null,value:noTravel?1:band===null?null:[.8,.6,.4,.2,.1,0][band],distance,noTravel,reason:noTravel?'Keine Anreise erforderlich: volle 15 Punkte.':distance===null?'Standort oder bestätigte Anbieterkoordinaten fehlen.':'Entfernung zum nächstgelegenen bestätigten Anbieter als Luftlinie: bis 20 / 50 / 100 / 300 / 800 / über 800 km ergeben 12 / 9 / 6 / 3 / 1,5 / 0 Punkte.'});
    const available=rows.filter(r=>r.value!=null).length,fieldCount=rows.length;
    const coverage=rows.reduce((n,r)=>n+(r.value==null?0:r.weight),0),earned=rows.reduce((n,r)=>n+(r.value??0)*r.weight,0);
    return {rows,costBasis:cost.key,costs:{unit,total},fieldCount,available,dataCoverage:100*available/fieldCount,coverage,earned,score:coverage?100*earned/coverage:null};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=calculate;else root.lcnTreatmentScore=calculate;
})(globalThis);
