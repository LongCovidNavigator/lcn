<?php
/** Shared terminology for the relationship view. Examples explain terms, not treatment choices. */
function ndRelationshipVocabulary(): array {
    return [
        'substance_types' => ['Arzneimittel', 'Nahrungsergänzungsmittel', 'Infusionen'],
        'substance_title' => 'Substanz',
        'variants_title' => 'Stoffvarianten und Darreichung',
        'section_title' => 'Therapieansatz und Umsetzung',
        'help_title' => 'Was bedeuten Substanz, Anwendungsform sowie Stoffvarianten und Darreichung?',
        'help' => [
            'Gruppe' => 'Fasst mehrere Einträge unter einem Oberbegriff zusammen, beispielsweise eine Wirkstoffgruppe.',
            'Substanz' => 'Bezeichnet hier einen Stoff als therapeutischen Bezugspunkt, beispielsweise NAD⁺ oder Magnesium. Eine Gruppe bündelt dagegen mehrere eigenständige Einträge. Eine Kombination mehrerer therapeutischer Bestandteile wird nicht automatisch als einzelne Substanz eingeordnet.',
            'Anwendungsform' => 'Beschreibt, wie eine Substanz angewendet wird. Beispiele: Vitamin C oral oder als Infusion; Vitamin B12 oral oder als Injektion. Bei NAD⁺ sind hier oral, Infusion und subkutan als zugehörige Einträge hinterlegt.',
            'Stoffvarianten und Darreichung' => 'Umfasst andere chemische Formen sowie Extrakte oder Präparate als Quelle eines Stoffes, zum Beispiel Grüntee-Extrakt für EGCG. Das bedeutet keine identische Zusammensetzung. Der Anwendungsweg wird getrennt unter Anwendungsformen erfasst.',
        ],
        'example_note' => 'Die Spalten zeigen die Einordnung: links die zugeordneten Gruppen, in der Mitte die Substanz, rechts unter „Stoffvarianten und Darreichung“ die zugehörigen Handelsnamen, Anwendungsformen und Stoffvarianten. Auch wenn du eine Variante oder Anwendungsform öffnest, bleibt sie rechts mit „Du bist hier“ markiert. Anwendungsformen derselben Substanz stehen auf derselben Ebene: NAD⁺-Infusion, NAD⁺ oral und NAD⁺ subkutan sind jeweils mit NAD⁺ verbunden, nicht untereinander. Stoffvarianten und Darreichung, Anwendungsformen und Handelsnamen werden getrennt erfasst. Kombinationstherapien stehen im eigenen Bereich darunter; ihre Verbindungen zeigen Bestandteile einer Kombination.',
    ];
}
