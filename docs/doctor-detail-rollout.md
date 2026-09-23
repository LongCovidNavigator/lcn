# Umstellung der Arzt-Detailseite, 22.09.2026

`arzt_detail.html?id=…` zeigt jetzt das neue Vier-Ansichten-Konzept. Die bestehenden Links aus Suche, Startseite und Behandlungsseiten bleiben gültig. Profil, Spezialisierungen, Zusatzqualifikationen, weitere Standorte und Treatments stammen aus der bestehenden Hybrid-Datenbank. Die Community-API liest die neuen getrennten Antworttabellen und berücksichtigt den bestehenden Dummy-Schalter. Keine vorhandenen Forschungsdaten oder Altbewertungen wurden geändert.

## Behobene Integrationsfehler

- Treatmentlinks verwenden jetzt den tatsächlich erwarteten Parameter `treat_id` und weiterhin `source=priority`.
- Fehlende, ungültige und unbekannte Arzt-IDs führen zu einem verständlichen Fehler statt stillschweigend zum Profil von Dr. Stingl.
- Die normale Seitennavigation, Footer, Rücklink zur Suche und Ergänzungslink sind integriert.
- Die Seitennavigation bricht bei Tablet-Breiten um und erzeugt keinen horizontalen Überlauf.
- Weitere Standorte (IDs 673 und 1156) werden im Steckbrief dargestellt.

## Noch offene Punkte

1. **Eigene Community-Antworten werden gespeichert.** Die vorhandene anonyme Browserkennung ordnet Antworten zu. Auswahlwechsel ersetzt die Antwort; Neuladen stellt sie wieder her. Die Auswertung wird nach dem Speichern aktualisiert. Details und Grenzen: `doctor-community-concept.md`.
2. **Dummy-Angaben sind aktuell zugeschaltet.** Sie beschreiben keine tatsächlichen Patientenerfahrungen. `LCN_DOCTOR_COMMUNITY_INCLUDE_DUMMY=0` in der geschützten Konfiguration entfernt sie beim nächsten Abruf. Echte Antworten werden separat gespeichert.
3. **Suchlisten verwenden weiterhin die alten Gesamtbewertungen.** Diese werden nicht in die neue vierstufige Wirkungsskala umgedeutet; Liste und neue Community-Detailansicht haben deshalb noch unterschiedliche Bewertungsgrundlagen.
4. **Fehlende Geodaten:** IDs 609 und 1148 haben keine Koordinaten; dort bleiben Karte und Entfernung entsprechend nicht verfügbar.
5. **Fehlende Treatment-Zuordnungen:** IDs 676, 1057 und 1151. Weitere Lücken im Fachprofil stehen im [Abdeckungsbericht](doctor-profile-coverage.md).
6. **Standortsuche ist Deutschland-beschränkt**, wie der vorhandene Geocoding-Endpunkt. Ausländische Praxisstandorte werden korrekt aus ihren gespeicherten Koordinaten angezeigt.

## Validierung

Alle 39 regulären Profilseiten wurden im Browser mit den gelieferten Fachrichtungen, Spezialisierungen und Zusatzqualifikationen abgeglichen. Geprüft wurden außerdem Treatment-Verlinkung, Ergänzungslink, ungültige IDs, alle vier Ansichten auf Mobil-/Tabletbreiten sowie die vorhandenen Backend-Prüfungen `tests/hybrid_doctors_smoke.php` und `tests/doctor_community_smoke.php`. Letztere prüft auch Dummy-Schalter, getrennte Quellen, Eindeutigkeit und zulässige Optionen; temporäre Testantworten werden zurückgerollt.
