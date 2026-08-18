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
