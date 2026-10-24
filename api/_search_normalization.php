<?php

function lcnNormalizeSearchTerm(string $value): string
{
    return str_replace(
        ['ä', 'ö', 'ü', 'ß'],
        ['ae', 'oe', 'ue', 'ss'],
        mb_strtolower(trim($value), 'UTF-8')
    );
}

function lcnNormalizedSearchSql(string $expression): string
{
    return "LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE({$expression},'Ä','Ae'),'Ö','Oe'),'Ü','Ue'),'ẞ','SS'),'ä','ae'),'ö','oe'),'ü','ue'),'ß','ss'))";
}

function lcnFuzzySearchTerms(string $query, array $values): array {
    $query = lcnNormalizeSearchTerm($query);
    $length = mb_strlen($query, 'UTF-8');
    if ($length < 4 || $length > 100) return [];
    $max = $length >= 8 ? 2 : 1;
    $best = $max + 1; $matches = [];
    foreach ($values as $value) {
        $normalized = lcnNormalizeSearchTerm((string)$value);
        $parts = preg_split('/[^\p{L}\p{N}]+/u', $normalized, -1, PREG_SPLIT_NO_EMPTY);
        $parts[] = $normalized;
        foreach ($parts as $part) {
            if (abs(mb_strlen($part, 'UTF-8') - $length) > $max) continue;
            $distance = levenshtein($query, $part);
            if ($distance === 2 && strlen($query) === strlen($part)) {
                for ($i=0; $i<strlen($query)-1; $i++) {
                    $swapped=$query; $swapped[$i]=$query[$i+1]; $swapped[$i+1]=$query[$i];
                    if ($swapped === $part) { $distance=1; break; }
                }
            }
            if ($distance > $max || $distance > $best) continue;
            if ($distance < $best) { $matches=[]; $best=$distance; }
            $matches[$normalized]=(string)$value;
        }
    }
    return array_slice(array_values($matches),0,20);
}
