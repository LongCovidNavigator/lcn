const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const crypto=require('node:crypto');
(async()=>{
const prefix='__LCN_FEEDBACK_TEST_'+crypto.randomBytes(8).toString('hex')+'__';
const browser=await chromium.launch({channel:'msedge',headless:true});let context;
try{
 context=await browser.newContext({viewport:{width:1440,height:1100}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1/lcn/mitgestalten.html');await page.locator('.fb-card').first().waitFor();
 const api=async(data,write=false,extra={})=>{const r=write?await context.request.post('http://127.0.0.1/lcn/api/feedback.php',{data,headers:{Origin:'http://127.0.0.1',...extra}}):await context.request.get('http://127.0.0.1/lcn/api/feedback.php',{params:data,headers:extra});return {status:r.status(),...await r.json()};};
 assert.equal((await api({action:'config'})).ok,true);
 const bad=await api({action:'create',title:'x',description:'short',category:'general'},true);assert.equal(bad.status,400);
 const forbidden=await context.request.post('http://127.0.0.1/lcn/api/feedback.php',{data:{action:'report',body:'must reject cross origin',category:'error'},headers:{Origin:'https://example.invalid'}});assert.equal(forbidden.status(),403);
 const writeIdea=title=>api({action:'create',title:prefix+' '+title,description:'An automated isolated feedback test description.',page_path:'index.html',reference_mode:'confirm',page_section:'',page_element:''},true);
 const a=await writeIdea('Source'),b=await writeIdea('Target');assert.equal(a.status,201);assert.equal(b.status,201);
 assert.equal((await api({action:'detail',id:a.id})).status,404);
 const list=await api({action:'list',q:prefix});assert.equal(list.total,0);
 const queue=await api({action:'admin_queue',kind:'ideas'});const source=queue.items.find(i=>i.id==a.id),target=queue.items.find(i=>i.id==b.id);assert.ok(source&&target);assert.equal(source.page_reference.page_path,'index.html');
 const approve=async(r,status='open')=>api({...r,action:'admin_idea',id:Number(r.id),moderation:'approved',status,reason:'Public status explanation',team_reply:'Official team reply'},true);
 assert.equal((await approve(source)).ok,true);assert.equal((await api({action:'detail',id:a.id})).idea.page_reference.page_path,'index.html');assert.equal((await approve(target)).ok,true);
 const voted=await Promise.all(Array.from({length:8},()=>api({action:'vote',id:a.id,supported:true},true)));assert.ok(voted.every(r=>r.ok));let detail=await api({action:'detail',id:a.id});assert.equal(detail.idea.votes,1);
 await api({action:'vote',id:a.id,supported:false},true);assert.equal((await api({action:'detail',id:a.id})).idea.votes,0);
 await api({action:'vote',id:a.id,supported:true},true);await api({action:'vote',id:b.id,supported:true},true);
 assert.equal((await api({action:'comment',id:a.id,body:'<script>window.feedbackXSS=1</script> Test comment',display_name:'Test'},true)).ok,true);
 assert.equal((await api({action:'detail',id:a.id})).comments.length,0);
 const comments=await api({action:'admin_queue',kind:'comments'});const comment=comments.items.find(c=>c.idea_id==a.id);assert.ok(comment);await api({action:'admin_comment',id:Number(comment.id),moderation:'approved'},true);
 assert.equal((await approve(target,'progress')).ok,true);
 assert.equal((await api({action:'admin_merge',id:a.id,target_id:b.id},true)).ok,true);
 detail=await api({action:'detail',id:a.id});assert.equal(detail.idea.id,b.id);assert.equal(detail.idea.votes,1);assert.equal(detail.comments.length,1);assert.equal(detail.history[0].new_value,'progress');
 const search=await api({action:'list',q:prefix,category:'general',status:'progress',sort:'new'});assert.equal(search.total,1);
 assert.equal((await api({action:'report',category:'technical',body:prefix+' Private test report'},true)).ok,true);
 assert.equal((await api({action:'reports'})).status,400);
 const reports=await api({action:'admin_queue',kind:'reports'});assert.ok(reports.items.some(r=>r.body.startsWith(prefix)));
 const untrusted=await context.request.get('http://127.0.0.1/lcn/api/feedback.php?action=admin_queue',{headers:{Host:'untrusted.invalid'}});assert.equal(untrusted.status(),403);
 const doctor=await api({action:'report',category:'missing',body:prefix+' Doctor context',entity_type:'doctor',entity_id:542},true);assert.equal(doctor.ok,true);
 assert.equal((await api({action:'report',category:'missing',body:'Invalid relation test',entity_type:'doctor',entity_id:2147483647},true)).status,400);
 await page.goto('http://127.0.0.1/lcn/mitgestalten.html?id='+a.id);await page.locator('#fb-comment-form').waitFor();await page.locator('#fb-detail a[href="index.html"]').waitFor();assert.equal(await page.evaluate(()=>window.feedbackXSS),undefined);assert.equal(await page.locator('#fb-detail script').count(),0);
 for(const width of [1440,768,390]){await page.setViewportSize({width,height:1100});await page.goto('http://127.0.0.1/lcn/mitgestalten.html');await page.locator('.fb-card').first().waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal overflow '+width);await page.screenshot({path:'output/feedback-'+width+'.png',fullPage:true});}
 await page.goto('http://127.0.0.1/lcn/feedback_admin.php');await page.locator('#fb-admin-state option').first().waitFor({state:'attached'});await page.locator('#fb-admin-state').selectOption('');await page.locator('#fb-admin-filters button').click();await page.locator('[data-edit]').first().waitFor({state:'attached'});await page.locator('.fb-admin-card summary').first().click();await page.screenshot({path:'output/feedback-admin-390.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,JSON.stringify(await page.locator('*').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().right>innerWidth+1).map(n=>[n.tagName,n.className,n.getBoundingClientRect().width]).slice(0,12))));
 await page.goto('http://127.0.0.1/lcn/arzt_detail.html?id=542');await page.locator('.lcn-feedback-float').waitFor();await page.goto('http://127.0.0.1/lcn/therapie_detail.php?treatment_id=1');await page.locator('.lcn-feedback-float').waitFor();
 await page.goto('http://127.0.0.1/lcn/symptome.php');await page.locator('main').waitFor();assert.equal(await page.locator('main h1').count()>0,true);
 assert.deepEqual(errors,[]);console.log('PASS: HTTP lifecycle, validation, CSRF, moderation, concurrent votes, withdrawal, comments, XSS, search/filter, merge, status history, private reports, admin authorization, contexts, symptoms and 3 responsive widths.');
}finally{await browser.close();process.stdout.write(execFileSync('C:/xampp/php/php.exe',['tests/feedback_cleanup.php',prefix],{encoding:'utf8'}));}
})().catch(e=>{console.error(e);process.exitCode=1;});
