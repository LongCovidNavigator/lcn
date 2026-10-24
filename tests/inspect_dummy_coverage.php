<?php
require __DIR__.'/../api/_doctor_hybrid.php';
$p=lcnDoctorDatabase();
$missing=$p->query("SELECT t.treat_nd_id FROM tbl_treatments_nd t LEFT JOIN tbl_treatment_dummy_counts_nd d ON d.treat_nd_id=t.treat_nd_id AND d.question_key='effect' GROUP BY t.treat_nd_id HAVING COUNT(d.option_index)<>4 OR SUM(d.answer_count)=0")->fetchAll(PDO::FETCH_COLUMN);
if($missing)throw new RuntimeException('Incomplete dummy effects: '.implode(',',$missing));
echo "PASS: all therapies have four nonempty dummy effect categories.\n";
