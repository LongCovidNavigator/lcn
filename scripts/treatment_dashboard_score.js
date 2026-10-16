/* Shared by the overview, dashboard and catalog comparison. */
(function(root){
  const definitions = [
    ['effect','Berichtete Zustandsveränderung',25,[0,1/3,2/3,1]],
    ['pem','Crash-/PEM-Risiko',20,[1,2/3,1/3,0]],
    ['gamechanger','Gamechanger',10,[1,0]],
    ['unit_cost','Kosten pro Einheit',10,[1,6/7,5/7,4/7,3/7,2/7,1/7,0,null,1]],
    ['total_cost','Gesamtkosten',10,[1,6/7,5/7,4/7,3/7,2/7,1/7,0,null,1]],
    ['setting','Durchführungssetting',10,[1,2/3,1/3,0]],
    ['access','Zugang',10,[2/3,1/3,0,1]]
  ];
  function calculate(counts,context='GKV',providerCount=null,independentAtHome=false) {
    const rows=definitions.map(([key,label,weight,scale])=>{
      const values=counts[key+(key.includes('cost')?':'+context:'')]||[];
      const total=values.reduce((n,v,i)=>n+(scale[i]==null?0:Number(v)),0);
      const value=total>=10?values.reduce((n,v,i)=>n+Number(v)*(scale[i]??0),0)/total:null;
      return {key,label,weight,total,value,scale};
    });
    const available=rows.filter(r=>r.value!=null).length;
    const dataCoverage=100*available/rows.length;
    const known=typeof providerCount==='number'&&Number.isFinite(providerCount)&&providerCount>=0;
    rows.push({key:'providers',label:'Erfasste Anbieter',weight:5,total:null,value:independentAtHome?null:known?Math.min(providerCount/10,1):null,providerCount:known?providerCount:null,reason:independentAtHome?'Bei Selbstmanagement ohne Anbieterbedarf nicht gewertet.':'0,5 Punkte pro eindeutig zugeordnetem Anbieter; maximal 5 Punkte ab zehn Anbietern. Ungeprüfte Kandidaten zählen nicht.'});
    const coverage=rows.reduce((n,r)=>n+(r.value==null?0:r.weight),0);
    const earned=rows.reduce((n,r)=>n+(r.value??0)*r.weight,0);
    return {rows,coverage,earned,score:coverage?100*earned/coverage:null,dataCoverage,available};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=calculate;
  else root.lcnTreatmentScore=calculate;
})(globalThis);
