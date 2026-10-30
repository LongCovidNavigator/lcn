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
  function calculate(counts,context='GKV',unusedProviderCount=null,independentAtHome=false,travel={},gamechangerPeers=[]){
    const rows=definitions.map(([key,label,weight,scale])=>field(counts,key,label,weight,scale,context));
    const gamechanger=rows.find(row=>row.key==='gamechanger');
    gamechanger.rawValue=gamechanger.value;
    const peers=gamechangerPeers.filter(value=>Number.isFinite(value)&&value>=0&&value<=1);
    gamechanger.reason='Für diesen Teilwert vergleichen wir, wie häufig die einzelnen Therapien als Gamechanger bewertet werden. Entscheidend ist der prozentuale Anteil der Ja-Antworten. Die 10 % der Therapien mit den höchsten Ja-Anteilen erhalten 10 Punkte, die 10 % mit den niedrigsten Ja-Anteilen erhalten 0 Punkte. Dazwischen steigt die Punktzahl gleichmäßig mit der Platzierung im Vergleich. Therapien mit demselben Ja-Anteil erhalten gleich viele Punkte. In den Vergleich gehen nur Therapien ein, zu denen mindestens zehn auswertbare Antworten vorliegen.';
    if(gamechanger.rawValue!=null&&peers.length){
      const less=peers.filter(value=>value<gamechanger.rawValue).length;
      const equal=peers.filter(value=>value===gamechanger.rawValue).length;
      gamechanger.percentile=(less+equal/2)/peers.length;
      gamechanger.value=Math.max(0,Math.min(1,(gamechanger.percentile-.1)/.8));
    }else{
      gamechanger.value=null;
      if(gamechanger.rawValue!=null)gamechanger.reason='Für relative Gamechanger-Punkte fehlt noch mindestens eine weitere Therapie mit zehn auswertbaren Gamechanger-Antworten.';
    }
    const unit=field(counts,'unit_cost','Kosten pro Einheit',20,costScale,context),total=field(counts,'total_cost','Gesamtkosten',20,costScale,context);
    const totalUnreliable=total.total<10||total.notApplicable>total.total;
    const chooseUnit=unit.total>=10&&(totalUnreliable||unit.total>=total.total+20);
    const cost=chooseUnit?unit:total;
    cost.reason=chooseUnit?(totalUnreliable?'Die Gesamtkosten sind nicht ausreichend auswertbar. Stattdessen verwenden wir die Kosten pro Therapieeinheit.':'Für die Kosten pro Therapieeinheit liegen mindestens 20 auswertbare Angaben mehr vor als für die Gesamtkosten. Deshalb verwenden wir diese fundiertere Datengrundlage.'):'Wir verwenden die Gesamtkosten. Die Datengrundlage für die Kosten pro Therapieeinheit ist nicht ausreichend besser, um stattdessen diese zu verwenden.';
    if(!chooseUnit&&totalUnreliable){cost.value=null;cost.reason='Die Gesamtkosten sind nicht zuverlässig auswertbar. Für die Kosten pro Therapieeinheit liegen weniger als zehn auswertbare Angaben vor. Deshalb ist noch keine Kostenauswertung möglich.';}
    rows.push(cost);
    const distance=Number.isFinite(travel.distance)&&travel.distance>=0?travel.distance:null;
    // Home use does not remove a separate journey needed for a prescription.
    const prescriptionRequired=travel.prescriptionRequired===true;
    const noTravel=travel.noTravel===true||(travel.noTravel!==false&&independentAtHome&&!prescriptionRequired);
    const oneOffPrescription=prescriptionRequired&&travel.oneOffPrescription===true&&!noTravel;
    const band=distance===null?null:[20,50,100,300,800,Infinity].findIndex(n=>distance<=n);
    const regularValue=band===null?null:[14/15,.6,.4,.2,.1,0][band];
    const value=noTravel?1:regularValue===null?null:oneOffPrescription?1-(1-regularValue)/2:regularValue;
    const reason=noTravel?'Keine Anreise erforderlich: volle 15 Punkte.':distance===null?'Standort oder bestätigte Anbieterkoordinaten fehlen.':oneOffPrescription?'Einmaliger Vor-Ort-Termin für die Verordnung: Der entfernungsabhängige Abzug von 15 Punkten wird halbiert. Bis 20 / 50 / 100 / 300 / 800 / über 800 km ergeben 14,5 / 12 / 10,5 / 9 / 8,25 / 7,5 Punkte.':'Entfernung zum nächstgelegenen bestätigten Anbieter als Luftlinie: bis 20 / 50 / 100 / 300 / 800 / über 800 km ergeben 14 / 9 / 6 / 3 / 1,5 / 0 Punkte.';
    rows.push({key:'distance',label:'Persönliche Anreise',weight:15,total:null,value,distance,noTravel,oneOffPrescription,prescriptionRequired,reason});
    const available=rows.filter(r=>r.value!=null).length,fieldCount=rows.length;
    const coverage=rows.reduce((n,r)=>n+(r.value==null?0:r.weight),0),earned=rows.reduce((n,r)=>n+(r.value??0)*r.weight,0);
    return {rows,costBasis:cost.key,costs:{unit,total},fieldCount,available,dataCoverage:100*available/fieldCount,coverage,earned,score:coverage?100*earned/coverage:null};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=calculate;else root.lcnTreatmentScore=calculate;
})(globalThis);
