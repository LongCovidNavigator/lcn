
import urllib.request,json,time
baseline=json.load(open('output/doctor-search-baseline.json',encoding='utf-8'))
for row in baseline:
 t=time.perf_counter()
 data=json.load(urllib.request.urlopen('http://localhost/lcn/api/doctors_search.php?lat=51.1657&lng=10.4515&'+row['query']))
 ms=round((time.perf_counter()-t)*1000)
 assert data==row['data'], 'Response changed: '+row['query']
 print(row['query'],row['ms'],'->',ms,'ms; identical response')
