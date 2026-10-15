# Offene Punkte vor der Beta

Festgehalten am 15.10.2026. Diese Punkte sind bewusst zurückgestellt.

- Dummy-Schalter und öffentlich erreichbaren Testmodus entfernen bzw. intern absichern; Dummy- und Freigaben-Einträge aus der öffentlichen Navigation entfernen. Testantworten vor dem Start prüfen und echte Daten sauber trennen.
- Standortsuche auf Österreich und die Schweiz erweitern. Der aktuelle Geocoding-Endpunkt beschränkt die Suche auf Deutschland.
- Behandler-Detailseite auf Handy, Tablet und Desktop sowie mit Tastatur prüfen; insbesondere Tabellen, Infofelder, Vergleichskästen und Navigation.
- Erledigt: Die Behandler-Therapietabelle liest echte Bewertungen aus `tbl_treatment_community_answers_nd` (über `api/treatment_answer.php` gespeichert), einschließlich Heilung. Nur aktive/freigegebene Antworten zählen; eingeschaltete Dummydaten werden separat addiert.

## Bewusste Entscheidungen

- Euro bleibt vorerst die Währung; die bestehenden Kostenstufen bleiben unverändert.
- Kein zusätzlicher permanenter Speicherungshinweis beschlossen. Die Erfolgsmeldung nach dem Anklicken bleibt bestehen.
- Therapieanzahl, Kategorienvielfalt und Top-Therapien zählen für die Datenabdeckung zusammen als ein Bereich. Ihre drei Punktanteile bleiben erhalten.
- Vorschlag für später: Erst- und Folgetermin-Wartezeit als einen Bereich zusammenfassen; ebenso die beiden Ferntermin-Bereiche. Noch nicht umgesetzt, da die gewünschte Einzelbewertung sonst weiter verändert würde.
