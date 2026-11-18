<?php
/** Shared terminology for the relationship view. Examples explain terms, not treatment choices. */
function ndRelationshipVocabulary(): array {
    return [
        'substance_types' => ['Arzneimittel', 'Nahrungsergänzungsmittel', 'Infusionen'],
        'substance_title' => 'Substanz',
        'variants_title' => 'Anwendungsformen',
        'variant_title' => 'Stoffvarianten',
        'application_title' => 'Applikation',
        'section_title' => 'Therapieansatz und Umsetzung',
        'help_title' => 'Was bedeuten Substanz, Anwendungsform und Stoffvariante?',
        'help' => [
            'Gruppe' => 'Fasst mehrere Einträge unter einem Oberbegriff zusammen, beispielsweise eine Wirkstoffgruppe.',
            'Substanz' => 'Bezeichnet hier einen Stoff als therapeutischen Bezugspunkt, beispielsweise NAD⁺ oder Magnesium. Eine Gruppe bündelt dagegen mehrere eigenständige Einträge. Eine Kombination mehrerer therapeutischer Bestandteile wird nicht automatisch als einzelne Substanz eingeordnet.',
            'Anwendungsform' => 'Beschreibt, wie eine Substanz angewendet wird. Beispiele: Vitamin C oral oder als Infusion; Vitamin B12 oral oder als Injektion. Bei NAD⁺ sind hier oral, Infusion und subkutan als zugehörige Einträge hinterlegt.',
            'Stoffvarianten' => 'Dazu zählen andere chemische Formen sowie Extrakte oder Präparate, die einen Stoff enthalten, etwa Grüntee-Extrakt als Quelle für EGCG. Gehalt und Zusammensetzung können je nach Präparat variieren.',
        ],
        'example_note' => 'Links stehen die Wirkstoffgruppen, in der Mitte der Wirkstoff oder die Substanz. Rechts findest du die Felder „Handelsnamen“, „Applikation“ und „Stoffvarianten“. „Du bist hier“ markiert den geöffneten Eintrag. Unter „Applikation“ stehen zum Beispiel NAD⁺-Infusion, NAD⁺ oral und NAD⁺ subkutan. Der Bereich für Kombinationstherapien zeigt, welche Bestandteile zu einer Kombination gehören.',
    ];
}
