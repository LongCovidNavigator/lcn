<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=3600');
$cache = sys_get_temp_dir() . '/lcn_ecb_reference_rates_v1.json';
$saved = is_file($cache) ? json_decode((string)file_get_contents($cache), true) : null;
if (!is_array($saved)) $saved = json_decode((string)file_get_contents(__DIR__.'/../data/exchange_rates_reference.json'), true);
if (is_array($saved) && is_file($cache) && filemtime($cache) > time()-3600) {
    echo json_encode($saved); exit;
}
try {
    $curl = curl_init('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml');
    curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_CONNECTTIMEOUT=>3, CURLOPT_TIMEOUT=>8, CURLOPT_USERAGENT=>'LongCovidNavigator/1.0', CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS]);
    $xml = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    if (!is_string($xml) || $status !== 200) throw new RuntimeException('Reference rates unavailable');
    $previousErrors=libxml_use_internal_errors(true);
    $document = simplexml_load_string($xml, SimpleXMLElement::class, LIBXML_NONET);
    libxml_clear_errors();libxml_use_internal_errors($previousErrors);
    if (!$document) throw new RuntimeException('Invalid reference rates');
    $days = $document->xpath('//*[local-name()="Cube"][@time]');
    $date = (string)($days[0]['time'] ?? '');
    $rates = ['EUR'=>1.0];
    foreach ($document->xpath('//*[local-name()="Cube"][@currency]') as $row) {
        $currency = (string)$row['currency'];
        if (in_array($currency, ['CHF','USD','GBP'], true) && (float)$row['rate'] > 0) $rates[$currency]=(float)$row['rate'];
    }
    if (count($rates)!==4 || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) throw new RuntimeException('Incomplete reference rates');
    $result=['ok'=>true,'date'=>$date,'rates'=>$rates,'source'=>'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html'];
    file_put_contents($cache,json_encode($result),LOCK_EX);
    echo json_encode($result);
} catch (Throwable $error) {
    if (is_array($saved)) { $saved['cached']=true; echo json_encode($saved); }
    else { http_response_code(503); echo json_encode(['ok'=>false,'error'=>'Wechselkurs derzeit nicht verfügbar.']); }
}
