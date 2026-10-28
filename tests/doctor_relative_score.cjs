const assert = require('node:assert/strict');
const view = require('../scripts/doctor_relative_score_view');
const result = {earned:52.02, coverage:100, score:52, dataCoverage:100};
const values = [27.4,41,46.7,51.2,57,76.3];
const html = view.render(result, values);
assert(html.includes('Vergleich mit anderen Behandlern'));
assert(html.includes('Dieser Behandler'));
assert(!html.includes('Therapien'));
assert(html.includes('6 andere Behandler'));
assert(html.includes('Weitere Infos'));
assert(!html.includes('class="score-track"'));
assert.equal((html.match(/class="therapy-precise-tier"/g)||[]).length, 5);
const legend=html.slice(html.indexOf('class="therapy-precise-legend"'));
let previous=-1;
for(const label of ['Sehr passend','Passend','Durchschnittlich passend','Weniger passend','Deutlich weniger passend']) {
  const position=legend.indexOf('>'+label+'</span>');
  assert(position>previous);previous=position;
}
for(const rank of [1,20,20.01,40,40.01,60,60.01,80,80.01,100]) {
  const expected=rank<=20?4:rank<=40?3:rank<=60?2:rank<=80?1:0;
  assert.equal(view.relativeScoreLevel(rank),expected);
}
assert.equal(view.relativeRank(50,[50,50]),50);
for(const [percent,label] of [[.12,'0,12'],[1,'1'],[2,'3'],[4,'5'],[37,'40'],[50,'50'],[51,'60'],[80,'80'],[100,'100']]) {
  assert.equal(view.topPercentLabel(percent),label);
}
for(const [own,others] of [[{...result,dataCoverage:50},values],[result,[]],[{earned:0,coverage:0,score:null,dataCoverage:0},[]]]) {
  const fallback=view.render(own,others);
  assert(fallback.includes('class="score-track"'));
  assert(!fallback.includes('therapy-precise-band'));
  assert(!fallback.includes('absolute Punktzahl'));
}
// A normalized score of 52.02 must place the marker using its unrounded value.
const partial=view.render({...result,earned:26.01,coverage:50},values);
assert.equal(partial.match(/--position:([^;]+)/)[1],html.match(/--position:([^;]+)/)[1]);
assert(!view.render({...result,earned:50},[50,50]).includes('NaN'));
const lowerTier=view.render({...result,earned:39,score:39},[23,35,41,46,52,72]);
assert(lowerTier.includes('<strong class="therapy-final-top score-percentile-level-1">Top 80 %</strong>'));
assert(!lowerTier.includes('<strong>Weniger passend</strong>'));
console.log('PASS: provider quintiles, descending aligned legend, unrounded comparison, ties, Top steps and score-only fallback.');

assert(view.render({...result,earned:0,score:0},[50,60]).includes('therapy-final-top score-percentile-level-0'));
