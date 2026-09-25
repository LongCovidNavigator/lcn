<?php
declare(strict_types=1);
require __DIR__.'/../components/treatments_nd_view.php';
require __DIR__.'/../components/treatments_nd_reduced.php';
$item=['community'=>[
 ['question_key'=>'gesamtbewertung','answer_value'=>'Verbesserung','review_status'=>'approved','n'=>3],
 ['question_key'=>'gesamtbewertung','answer_value'=>'positiv','review_status'=>'approved','n'=>20],
 ['question_key'=>'gesamtbewertung','answer_value'=>'Heilung','review_status'=>'suspicious','n'=>8],
]];
$html=ndReducedChart($item,'effect','Gesamtbewertung','effect');
if (!str_contains($html,'data-counts="[0,0,3,0]"')) throw new RuntimeException('Only exact approved categories may count');
if(count(ND_REDUCED_SCALES['unit_cost'])!==9 || count(ND_REDUCED_SCALES['total_cost'])!==9) throw new RuntimeException('Cost scales incomplete');
echo "PASS: approved exact categories; legacy/suspicious excluded; complete independent cost scales\n";
