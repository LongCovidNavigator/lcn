/* Local matching only: no symptom text is sent to a search service. */
(function(root){
 const normalize=value=>String(value).toLocaleLowerCase('de').replace(/ß/g,'ss').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ae/g,'a').replace(/oe/g,'o').replace(/ue/g,'u').trim();
 function distance(a,b){
  const d=Array.from({length:a.length+1},(_,i)=>Array.from({length:b.length+1},(_,j)=>i===0?j:j===0?i:0));
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){
   d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
   if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1);
  }return d[a.length][b.length];
 }
 function search(catalog,query){
  const q=normalize(query);
  return catalog.map(item=>{const name=normalize(item.name);let rank=!q?0:name===q?0:name.startsWith(q)?1:name.includes(q)?2:Infinity;
   if(rank===Infinity&&q.length>=4){const error=Math.min(...name.split(/[\s()/,-]+/).filter(Boolean).map(word=>distance(q,word)));if(error<=(q.length>=7?2:1))rank=3+error;}
   return {item,rank};}).filter(r=>Number.isFinite(r.rank)).sort((a,b)=>a.rank-b.rank||a.item.name.localeCompare(b.item.name,'de')).map(r=>r.item);
 }
 const api={normalize,search};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LCNSymptomSearch=api;
})(globalThis);
