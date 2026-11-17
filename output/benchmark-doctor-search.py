import urllib.request,json,time
queries=['radiusKm=all','radiusKm=100','radiusKm=all&search=Berlin','radiusKm=all&minTreatmentCount=2&minCategoryCount=1','radiusKm=all&dr_id=627','radiusKm=all&include_dummy=1']
out=[]
for q in queries:
 u='http://localhost/lcn/api/doctors_search.php?lat=51.1657&lng=10.4515&'+q
 t=time.perf_counter();data=json.load(urllib.request.urlopen(u));out.append(dict(query=q,data=data,ms=round((time.perf_counter()-t)*1000)))
print([(x['query'],x['ms'],len(x['data'].get('items',[]))) for x in out])
json.dump(out,open('output/doctor-search-baseline.json','w',encoding='utf-8'),ensure_ascii=False)

