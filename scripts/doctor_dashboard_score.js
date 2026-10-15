/* LCN dashboard orientation score, version 1. Pure calculation; no database writes. */
(function(root){
  function calculate(data){
    const rows=[];
    const add=(label,weight,value,reason)=>rows.push({label,weight,value:value==null?null:Math.max(0,Math.min(1,value)),reason});
    const q=key=>data.questions?.[key];
    const answerCount=key=>(q(key)?.options||[]).reduce((n,o)=>n+Number(o.count||0),0);
    const average=(key,values)=>{const options=q(key)?.options||[],total=answerCount(key);return total>=11?options.reduce((n,o,i)=>n+Number(o.count||0)*(values[i]||0),0)/total:null;};
    const addScale=(label,weight,key,values,reason)=>{add(label,weight,average(key,values),reason);Object.assign(rows[rows.length-1],{key,answerCount:answerCount(key),scalePoints:values.map(value=>value*weight)});};
    addScale('Termin-Anpassung',20,'adaptation',[0,.25,.5,.75,1],'Stufen 1–5 entsprechen 0–100 %. Gewichtet nach allen Angaben.');
    for(let r=0;r<2;r++){
      const phone=average('appointment-'+r+'-1',[1,0]),video=average('appointment-'+r+'-2',[1,0]);
      const value=phone==null&&video==null?null:Math.max(phone==null?0:phone,video??0);
      add(r?'Folgetermin aus der Ferne':'Ersttermin aus der Ferne',10,value,'Besserer Ja-Anteil der erfassten Fernoptionen: Telefon oder Video, gleich gewichtet (jeweils maximal 10 Punkte). Nicht erfasste Optionen werden ausgelassen; Vor-Ort-Termine geben keinen Abzug.');
      rows[rows.length-1].answerCount=Math.max(answerCount('appointment-'+r+'-1'),answerCount('appointment-'+r+'-2'));
    }
    addScale('Eigene Therapiekosten',15,data.costKey,[1,.8,.6,.4,.2,0],'Gewählter Versicherungskontext; sechs Kostenstufen von 100 bis 0 %. Alle Beträge in Euro.');
    addScale('Wartezeit auf Ersttermin',5,'wait',[1,.75,.5,.25,0],'Fünf Wartezeitstufen von 100 bis 0 %.');
    addScale('Wartezeit auf Folgetermine',5,'wait-followup',[1,.75,.5,.25,0],'Dieselbe Skala wie beim Ersttermin: fünf Wartezeitstufen von 100 bis 0 %.');
    addScale('Berichtete Zustandsveränderung',15,'effect',[0,1/3,2/3,1],'Dieselbe gleichmäßige Skala wie im Community-Durchschnitt: Verschlechterung 0, keine Veränderung 5, Verbesserung 10, Heilung 15 Punkte.');
    add('Anzahl Therapien',10,data.treatmentCount>0?data.treatmentCount/60:null,'Bis 60 dokumentierte Therapien linear; ab 60 volle 10 Punkte. Keine Einträge werden als fehlende Recherche behandelt.');
    add('Vielfalt der Kategorien',2,data.treatmentCount>0?data.categoryCount/8:null,'Bis acht bekannte Kategorien linear; Ohne Kategorie zählt nicht.');
    add('Redaktionelle Auswahl',1,data.treatmentCount>0&&data.editorialTotal>0?(data.editorialCount>3?1:0):null,'Ab vier zugeordneten Top-Therapien gibt es 1 Zusatzpunkt; bei null bis drei gibt es 0 Punkte.');
    const band=data.distance==null?null:[20,50,100,300,800,Infinity].findIndex(limit=>data.distance<=limit);
    add('Persönliche Anreise',7,band==null?null:[1,.8,.6,.4,.2,0][band],'Luftlinie: bis 20 / 50 / 100 / 300 / 800 / über 800 km = 100 / 80 / 60 / 40 / 20 / 0 %. Ohne Standort keine Bewertung.');
    const coverage=rows.reduce((n,r)=>n+(r.value==null?0:r.weight),0),earned=rows.reduce((n,r)=>n+(r.value||0)*r.weight,0);
    // The three researched therapy metrics form one field for data completeness.
    const therapyLabels=['Anzahl Therapien','Vielfalt der Kategorien','Redaktionelle Auswahl'];
    const therapyRows=rows.filter(row=>therapyLabels.includes(row.label));
    const otherRows=rows.filter(row=>!therapyLabels.includes(row.label));
    const fieldCount=otherRows.length+1;
    const availableFieldCount=otherRows.filter(row=>row.value!=null).length+(therapyRows.every(row=>row.value!=null)?1:0);
    const dataCoverage=100*availableFieldCount/fieldCount;
    return {rows,coverage,earned,dataCoverage,fieldCount,availableFieldCount,score:coverage?Math.round(100*earned/coverage):null};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=calculate;else root.lcnDashboardScore=calculate;
})(globalThis);
