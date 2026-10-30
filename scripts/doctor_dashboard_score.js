/* LCN dashboard orientation score, version 1. Pure calculation; no database writes. */
(function(root){
  function calculate(data){
    const rows=[];
    const add=(label,weight,value,reason)=>rows.push({label,weight,value:value==null?null:Math.max(0,Math.min(1,value)),reason});
    const q=key=>data.questions?.[key];
    const answerCount=key=>(q(key)?.options||[]).reduce((n,o)=>n+Number(o.count||0),0);
    const average=(key,values)=>{const options=q(key)?.options||[],total=answerCount(key);return total>=10?options.reduce((n,o,i)=>n+Number(o.count||0)*(values[i]||0),0)/total:null;};
    const addScale=(label,weight,key,values,reason)=>{add(label,weight,average(key,values),reason);Object.assign(rows[rows.length-1],{key,answerCount:answerCount(key),scalePoints:values.map(value=>value*weight)});};
    addScale('Termin-Anpassung',6,'adaptation',[0,.25,.5,.75,1],'Stufen 1–5 entsprechen 0–100 %. Gewichtet nach allen Angaben.');
    const remoteTerms=[];
    for(let r=0;r<2;r++){
      const phone=average('appointment-'+r+'-1',[1,0]),video=average('appointment-'+r+'-2',[1,0]);
      const researched=(r?data.researchedRemoteFollow:data.researchedRemoteFirst)===true||data.researchedOnlineComplete===true;
      const communityValue=phone==null&&video==null?null:Math.max(phone??0,video??0);
      const useResearch=communityValue==null&&researched;
      const value=communityValue??(useResearch?1:null);
      remoteTerms.push({confirmed:communityValue!=null?communityValue>.5:researched||data.onlineFirst===true,useResearch});
      add(r?'Folgetermin aus der Ferne':'Ersttermin aus der Ferne',3,value,'Besserer Ja-Anteil der erfassten Fernoptionen: Telefon oder Video, gleich gewichtet (jeweils maximal 3 Punkte). Nicht erfasste Optionen werden ausgelassen; Vor-Ort-Termine geben keinen Abzug.');
      rows[rows.length-1].answerCount=Math.max(answerCount('appointment-'+r+'-1'),answerCount('appointment-'+r+'-2'));
      if(useResearch){rows[rows.length-1].researchConfirmed=true;rows[rows.length-1].reason='Redaktion / Recherche: Ferntermin bestätigt, 3 Punkte. Community-Angaben bleiben getrennt.';}
    }
    addScale('Eigene Behandlungskosten',20,data.costKey,(data.questions?.[data.costKey]?.options?.length===8?[1,.9,.75,.6,.45,.3,.15,0]:[1,.8,.6,.4,.2,0]),'Acht Kostenstufen: komplett übernommen, bis 100 / 500 / 1.000 / 5.000 / 10.000 / 25.000 und über 25.000.');
    addScale('Wartezeit auf Ersttermin',5,'wait',[1,.75,.5,.25,0],'Fünf Wartezeitstufen von 100 bis 0 %.');
    addScale('Wartezeit auf Folgetermine',5,'wait-followup',[1,.75,.5,.25,0],'Dieselbe Skala wie beim Ersttermin: fünf Wartezeitstufen von 100 bis 0 %.');
    addScale('Berichtete Zustandsveränderung',30,'effect',[0,1/3,2/3,1],'Dieselbe gleichmäßige Skala wie im Community-Durchschnitt: Verschlechterung 0, keine Veränderung 10, Verbesserung 20, Heilung 30 Punkte.');
    const offerPeers=(data.comparisonProfiles||[]).filter(profile=>profile.treatmentCount>0&&(data.id==null||Number(profile.id)!==Number(data.id)));
    const addOfferRank=(label,weight,key)=>{
      const rawValue=data.treatmentCount>0&&Number.isFinite(data[key])?data[key]:null;
      const values=offerPeers.map(profile=>profile[key]).filter(value=>Number.isFinite(value)&&value>=0);
      let percentile=null,value=null;
      if(rawValue!=null&&values.length){
        values.push(rawValue);
        percentile=(values.filter(v=>v<rawValue).length+values.filter(v=>v===rawValue).length/2)/values.length;
        value=Math.max(0,Math.min(1,(percentile-.1)/.8));
      }
      add(label,weight,value,'Vergleich mit anderen Behandlern mit eingetragenen Therapien: obere 10 % volle Punkte, untere 10 % keine Punkte; dazwischen linear nach Platzierung. Gleiche Anzahlen erhalten gleich viele Punkte.');
      Object.assign(rows[rows.length-1],{rawValue,percentile,comparisonCount:values.length,relativeOffer:true});
    };
    addOfferRank('Anzahl Therapien',7,'treatmentCount');
    addOfferRank('Vielfalt der Kategorien',3,'categoryCount');
    const band=data.distance==null?null:[20,50,100,300,800,Infinity].findIndex(limit=>data.distance<=limit);
    const remoteComplete=remoteTerms.every(term=>term.confirmed);
    const oneOffTravel=!remoteTerms[0].confirmed&&remoteTerms[1].confirmed;
    const distanceValue=band==null?null:[17/18,.6,.4,.2,.1,0][band];
    add('Persönliche Anreise',18,distanceValue==null?null:oneOffTravel?(1+distanceValue)/2:distanceValue,'Luftlinie bis 20 / 50 / 100 / 300 / 800 / über 800 km: 17 / 10,8 / 7,2 / 3,6 / 1,8 / 0 Punkte. Ohne Standort keine Entfernungseinordnung.');
    Object.assign(rows[rows.length-1],{oneOffTravel});
    if(oneOffTravel)rows[rows.length-1].reason='Nur der Ersttermin wird vor Ort angenommen, Folgetermine sind aus der Ferne möglich. Der Entfernungsabzug wird halbiert: bis 20 / 50 / 100 / 300 / 800 / über 800 km ergeben 17,5 / 14,4 / 12,6 / 10,8 / 9,9 / 9 Punkte. Ohne Standort keine Entfernungseinordnung.';
    if(remoteComplete)for(const row of rows.filter(r=>['Termin-Anpassung','Ersttermin aus der Ferne','Folgetermin aus der Ferne','Persönliche Anreise'].includes(r.label))){row.value=1;row.remoteOverride=true;if(!['Ersttermin aus der Ferne','Folgetermin aus der Ferne'].includes(row.label))row.researchConfirmed=remoteTerms.every(term=>term.useResearch);row.reason=(row.researchConfirmed?'Redaktion / Recherche: Erst- und Folgetermin aus der Ferne möglich. ':'')+'Erst- und Folgetermin aus der Ferne bestätigt: volle 30 Punkte für körperliche Wahrnehmbarkeit. Wartezimmer und Entfernung verursachen keinen Abzug.';}
    const coverage=rows.reduce((n,r)=>n+(r.value==null?0:r.weight),0),earned=rows.reduce((n,r)=>n+(r.value||0)*r.weight,0);
    // The two researched therapy metrics form one field for data completeness.
    const therapyLabels=['Anzahl Therapien','Vielfalt der Kategorien'];
    const therapyRows=rows.filter(row=>therapyLabels.includes(row.label));
    const otherRows=rows.filter(row=>!therapyLabels.includes(row.label));
    const fieldCount=otherRows.length+1;
    const availableFieldCount=otherRows.filter(row=>row.value!=null).length+(therapyRows.every(row=>row.value!=null)?1:0);
    const dataCoverage=100*availableFieldCount/fieldCount;
    return {rows,coverage,earned,remoteComplete,dataCoverage,fieldCount,availableFieldCount,score:coverage?Math.round(100*earned/coverage):null};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=calculate;else root.lcnDashboardScore=calculate;
})(globalThis);
