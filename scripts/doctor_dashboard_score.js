/* LCN dashboard orientation score, version 1. Pure calculation; no database writes. */
(function(root){
  function calculate(data){
    const rows=[];
    const add=(label,weight,value,reason)=>rows.push({label,weight,value:value==null?null:Math.max(0,Math.min(1,value)),reason});
    const q=key=>data.questions?.[key];
    const average=(key,values)=>{const options=q(key)?.options||[],total=options.reduce((n,o)=>n+Number(o.count||0),0);return total?options.reduce((n,o,i)=>n+Number(o.count||0)*(values[i]||0),0)/total:null;};
    add('Termin-Anpassung',20,average('adaptation',[0,.25,.5,.75,1]),'Stufen 1–5 entsprechen 0–100 %. Gewichtet nach allen Angaben.');
    for(let r=0;r<2;r++){
      const phone=average('appointment-'+r+'-1',[1,0]),video=average('appointment-'+r+'-2',[1,0]);
      const value=video===1?1:phone==null||video==null?null:Math.max(phone*.95,video);
      add(r?'Folgetermin aus der Ferne':'Ersttermin aus der Ferne',10,value,'Besserer Ja-Anteil von Video (100 %) oder Telefon (95 %). Keine Addition und kein Abzug für fehlende Vor-Ort-Termine. Fehlt eine Fernoption, bleibt der Teil offen, außer Video erreicht schon das Maximum.');
    }
    add('Eigene Behandlungskosten',15,average(data.costKey,[1,.8,.6,.4,.2,0]),'Gewählter Versicherungskontext; sechs Kostenstufen von 100 bis 0 %. Alle Beträge in Euro.');
    add('Wartezeit auf Ersttermin',10,average('wait',[1,.75,.5,.25,0]),'Fünf Wartezeitstufen von 100 bis 0 %.');
    add('Berichtete Zustandsveränderung',15,average('effect',[0,.25,.75,1]),'Verschlechterung 0 %, unverändert 25 %, Verbesserung 75 %, Heilung 100 %. Subjektive Berichte, kein Wirksamkeitsnachweis.');
    add('Anzahl Behandlungen',10,data.treatmentCount>0?data.treatmentCount/60:null,'Bis 60 dokumentierte Behandlungen linear; ab 60 volle 10 Punkte. Keine Einträge werden als fehlende Recherche behandelt.');
    add('Vielfalt der Kategorien',2,data.treatmentCount>0?data.categoryCount/8:null,'Bis acht bekannte Kategorien linear; Ohne Kategorie zählt nicht.');
    add('Redaktionelle Auswahl',1,data.treatmentCount>0&&data.editorialTotal>0?data.editorialCount/data.editorialTotal:null,'Anteil der zugeordneten redaktionellen Themen, maximal 1 Punkt.');
    const band=data.distance==null?null:[20,50,100,300,800,Infinity].findIndex(limit=>data.distance<=limit);
    add('Persönliche Anreise',7,band==null?null:[1,.8,.6,.4,.2,0][band],'Luftlinie: bis 20 / 50 / 100 / 300 / 800 / über 800 km = 100 / 80 / 60 / 40 / 20 / 0 %. Ohne Standort keine Bewertung.');
    const coverage=rows.reduce((n,r)=>n+(r.value==null?0:r.weight),0),earned=rows.reduce((n,r)=>n+(r.value||0)*r.weight,0);
    return {rows,coverage,score:coverage?Math.round(100*earned/coverage):null};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=calculate;else root.lcnDashboardScore=calculate;
})(globalThis);
