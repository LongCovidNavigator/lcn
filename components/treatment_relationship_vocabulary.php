<?php
/** Shared terminology for the relationship view. Examples explain terms, not treatment choices. */
function ndRelationshipVocabulary(): array {
    return [
        'substance_types' => ['Arzneimittel', 'Nahrungsergänzungsmittel', 'Infusionen'],
        'substance_title' => 'Substanz',
        'variants_title' => 'Varianten und Anwendungsformen',
        'section_title' => 'Einordnung, Varianten und Anwendungsformen',
        'help_title' => 'Was bedeuten Substanz, Anwendungsform und Stoffvariante?',
        'help' => [
            'Gruppe' => 'Fasst mehrere Einträge unter einem Oberbegriff zusammen, beispielsweise eine Wirkstoffgruppe.',
            'Substanz' => 'Bezeichnet hier den stofflichen Bezugspunkt, beispielsweise NAD⁺. Die Überschrift wird aus dem Katalogtyp und den hinterlegten Beziehungen abgeleitet. Die Verbindungsart zu einer Anwendungsform oder Stoffvariante ist gesondert an der jeweiligen Zuordnung gespeichert.',
            'Anwendungsform' => 'Beschreibt, wie eine Substanz angewendet wird. Beispiele: Vitamin C oral oder als Infusion; Vitamin B12 oral oder als Injektion. Bei NAD⁺ sind hier oral, Infusion und subkutan als zugehörige Einträge hinterlegt.',
            'Stoffvariante' => 'Beschreibt eine andere chemische Form oder Verbindung, nicht den Verabreichungsweg. Beispiele: Magnesiumcitrat und Magnesiumoxid als unterschiedliche Magnesiumverbindungen. Derselbe Verabreichungsweg kann bei mehreren Stoffvarianten vorkommen.',
        ],
        'example_note' => 'Anwendungsformen, Stoffvarianten und Handelsnamen beschreiben unterschiedliche Beziehungen und werden deshalb getrennt erfasst.',
    ];
}
