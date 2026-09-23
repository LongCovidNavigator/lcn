// Keep previously shared proposal links working on the standard detail page.
const params=new URLSearchParams(location.search);
const target=new URL('arzt_detail.html',location.href);
target.searchParams.set('submission_id',params.get('id')||'');
target.hash=location.hash;
location.replace(target.href);
