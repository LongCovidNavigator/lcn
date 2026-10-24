/* Relative overall score for provider profiles; same rank and display rules as therapies. */
(function(root){
  'use strict';
  function topPercentLabel(percent){
    if(percent==null||percent>50)return null;
    if(percent<1)return percent<=0?'unter 0,01':(Math.ceil(percent*100)/100).toLocaleString('de-DE',{maximumFractionDigits:2});
    return String([1,3,5,10,20,30,40,50].find(step=>percent<=step));
  }
  function relativeRank(own,values,lowerIsBetter=false){
    if(own==null||!values.length)return null;
    // Midranks keep equal scores together, including a completely tied group.
    const better=values.filter(value=>lowerIsBetter?value<own:value>own).length;
    const equal=values.filter(value=>value===own).length;
    return 100*(better+(equal+1)/2)/(values.length+1);
  }
  function relativeScoreLevel(rank){
    return rank<=20?4:rank<=40?3:rank<=60?2:rank<=80?1:0;
  }
  function comparisonRange(own,values){
    const sorted=[...values,own].filter(Number.isFinite).sort((a,b)=>a-b);
    if(!sorted.length)return null;
    const min=sorted[0],max=sorted[sorted.length-1];
    const quantile=fraction=>{const i=(sorted.length-1)*fraction,low=Math.floor(i);return sorted[low]+(sorted[Math.ceil(i)]-sorted[low])*(i-low);};
    return {min,max,cuts:[min,...[.2,.4,.6,.8].map(quantile),max],position:value=>max===min?50:100*(value-min)/(max-min)};
  }
  const wholePoints=value=>String(Math.round(value));
  function rankPreview(own,values){
    const rank=relativeRank(own,values);
    if(rank==null)return '';
    const range=comparisonRange(own,values),level=relativeScoreLevel(rank),top=topPercentLabel(rank);
    const labels=['Deutlich weniger passend','Weniger passend','Durchschnittlich passend','Passend','Sehr passend'];
    const widths=range.max===range.min?[20,20,20,20,20]:range.cuts.slice(1).map((cut,i)=>100*(cut-range.cuts[i])/(range.max-range.min));
    const position=range.position(own);
    // The full precision controls position and classification; only displayed points are rounded.
    const ticks=range.cuts.map((value,i)=>({value,position:range.position(value),i})).filter((tick,i,all)=>i===0||i===5||(tick.position-all[i-1].position>=8&&100-tick.position>=8));
    const legend=[4,3,2,1,0].map(i=>'<div class="therapy-precise-legend-row'+(i===level?' is-current':'')+'"><i class="score-level-'+i+'" aria-hidden="true"></i><span class="therapy-precise-name">'+labels[i]+'</span><span class="therapy-precise-tier"><span>Top</span> <span class="therapy-precise-tier-number">'+(100-i*20)+'</span> <span>%</span></span><span class="therapy-precise-range"><span>'+wholePoints(range.cuts[i])+'</span><span aria-hidden="true">–</span><span>'+wholePoints(range.cuts[i+1])+'</span></span><span class="therapy-precise-unit">Punkte</span></div>').join('');
    return '<figure class="therapy-precise-chart" aria-label="'+labels[level]+', '+wholePoints(own)+' Punkte im Behandlervergleich"><div class="therapy-precise-pin-row"><div class="therapy-precise-pin" style="--position:'+position+'%;--label-position:'+Math.max(16,Math.min(84,position))+'%"><small>Dieser Behandler</small>'+(top!=null?'<strong class="therapy-final-top score-percentile-level-'+level+'">Top '+top+' %</strong>':'<strong>'+labels[level]+'</strong>')+'</div><i class="therapy-precise-pointer" style="left:'+position+'%" aria-hidden="true"></i></div><div class="therapy-precise-band" aria-hidden="true">'+widths.map((width,i)=>'<span class="score-level-'+i+'" style="width:'+width+'%"></span>').join('')+'</div><div class="therapy-precise-axis">'+ticks.map(tick=>'<span class="'+(tick.i===0?'is-first':tick.i===5?'is-last':'is-inner')+'" style="left:'+tick.position+'%">'+wholePoints(tick.value)+'</span>').join('')+'</div><figcaption>Punktebereiche · je 20 % der Behandler</figcaption></figure><div class="therapy-precise-legend" aria-label="Passungsstufen von sehr passend bis deutlich weniger passend">'+legend+'</div>';
  }
  function scoreClassification(result,values,ready) {
    const valid=ready&&result.dataCoverage>=70&&result.score!=null&&values.length;
    const range=valid?comparisonRange(result.score,values):null;
    const average=valid?values.reduce((sum,value)=>sum+value,0)/values.length:null;
    return '<section class="therapy-final-comparison therapy-precise-comparison"><h3>'+(valid?'Vergleich mit anderen Behandlern':'Gesamtauswertung')+'</h3><div class="therapy-precise-summary"><div>'+(valid?'<span>Gesamtauswertung</span>':'')+'<strong class="score-number">'+(result.coverage?wholePoints(result.earned):'–')+'<small> / '+wholePoints(result.coverage)+' Punkte</small></strong></div>'+(valid?'<dl><div><dt>Minimum</dt><dd>'+wholePoints(range.min)+'</dd></div><div><dt>Durchschnitt</dt><dd>'+wholePoints(average)+'</dd></div><div><dt>Maximum</dt><dd>'+wholePoints(range.max)+'</dd></div></dl>':'')+'</div>'+(valid?rankPreview(result.score,values):'<div class="score-track" role="img" aria-label="'+(result.coverage?wholePoints(result.earned)+' von '+wholePoints(result.coverage)+' auswertbaren Punkten':'Noch keine auswertbaren Punkte')+'"><span style="width:'+(result.score||0)+'%"></span></div><p class="field-note">Für einen Behandlervergleich liegen noch nicht genügend Angaben vor.</p>')+'</section>';
  }

  function comparisonExplanation(result,values,ready){
    const valid=ready&&result.dataCoverage>=70&&result.score!=null&&values.length>0;
    return '<p class="field-note therapy-final-explanation">'+(valid?'Es geht darum, wie die Behandler im Vergleich abschneiden, nicht um die absolute Punktzahl. ':'')+'Wir vergleichen nur Behandler, zu denen genügend Erfahrungen vorliegen: '+values.length+' andere '+(values.length===1?'Behandler':'Behandler')+' mit ausreichend Community-Angaben.</p>';
  }


  function render(result,values,ready=true){
    // The underlying provider calculator rounds score; compare unrounded normalized values.
    const normalized={...result,score:result.coverage?100*result.earned/result.coverage:null};
    return '<div class="doctor-score-relative">'+scoreClassification(normalized,values,ready)+'<details class="therapy-more-info"><summary>Weitere Infos</summary>'+comparisonExplanation(normalized,values,ready)+'<p class="field-note therapy-orientation-note">Der Gesamtwert beschreibt praktische Passung und dokumentierte Angebote, keine medizinische Qualität.</p></details></div>';
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={render,relativeRank,relativeScoreLevel,topPercentLabel,comparisonRange};else root.lcnDoctorRelativeScore={render};
})(globalThis);
