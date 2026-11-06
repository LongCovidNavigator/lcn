# Symptomübersicht

Die Seite verwendet das gemeinsame öffentliche LCN-Design mit neutralem Suchseitenhintergrund sowie eingerahmten Navigations- und Ergebnisbereichen.

`symptome.php` zeigt den Symptomkatalog mit Namenssuche, Kategorie- und Ohne-Kategorie-Filter, Sortierung, Pagination sowie einem im Browser gespeicherten Kachel-/Tabellenschalter. Suchvorschläge suchen unabhängig von den aktiven Listenfiltern im gesamten Katalog. Ab zwei Zeichen können fehlende Symptome vorgeschlagen werden.

Bestätigen und Widersprechen beziehen sich ausschließlich auf die gespeicherte Kategorie. Pro Browseridentität und Symptom existiert eine Stimme; eine neue Auswahl ersetzt die alte. Die kompakten ✓-/×-Schaltflächen entsprechen den Detailseiten und zeigen die Anzahl der Stimmen zur aktuellen Kategorie. Widersprechen speichert die Stimme und öffnet direkt den Dialog für eine passendere Kategorie. Ein separater Button „Kategorie anpassen“ entfällt; bei Einträgen ohne Kategorie bleibt „Kategorie vorschlagen“ verfügbar. Stimmen enthalten einen Snapshot der Kategorie und werden nach deren Änderung nicht mehr als aktuelle eigene Stimme angezeigt.

Neue Symptome und Kategorieänderungen landen in einer eigenen Prüfwarteschlange. Administratoren können diese direkt unten auf der Symptomseite öffnen und freigeben oder ablehnen. Kategorieänderungen werden nur übernommen, wenn die ursprüngliche Kategorie noch unverändert ist. Freitext erlaubt auch neue Kategorien (maximal 100 Zeichen entsprechend `tbl_symptoms.sym_category`). Neue Symptome können zunächst ohne Kategorie eingereicht werden. Pro Browser sind zehn Vorschläge pro Stunde möglich. Die Identität verwendet dieselbe pseudonyme Cookie-/HMAC-Lösung wie die vorhandenen Abstimmungen; sie ist keine Personenverifikation.

## Einrichtung

Vor der Freischaltung `migrations/20261106_symptom_catalog.sql` auf der jeweiligen Datenbank ausführen. Die Migration legt ausschließlich zwei neue Tabellen an; vorhandene Katalogdaten werden nicht verändert. Lokal kann `C:\xampp\php\php.exe scripts/prepare_symptom_catalog.php` verwendet werden. Dieser Helfer ist auf LOCAL_HYBRID und die lokale Datenbank lcn_hybrid_database begrenzt und ausschließlich per CLI verfügbar. Online muss die SQL-Migration über den üblichen Datenbank-Deploymentweg erfolgen. Ohne Migration bleibt der Katalog lesbar und die Mitwirkung deaktiviert.

Die API verlangt Beta-Zugang. Schreibzugriffe erfordern POST mit JSON und passender Origin/Referer; die Freigabe erfordert die bestehende Administratorrolle. `LCN_VOTER_SECRET` muss wie für die übrigen Abstimmungen eingerichtet sein.

## Prüfungen

- `C:\xampp\php\php.exe tests/symptom_catalog.php`: Datenbanktests für neue Symptome, Kategorieänderungen, veraltete Vorschläge und wiederholte Freigaben; alle Fixtures werden zurückgerollt.
- `node tests/symptom_catalog_ui.cjs`: lokaler Edge/Playwright-Test für Suche, Tastatur, Filter, gespeicherte Ansicht/Stimmen, Vorschläge, Herkunftsschutz und mobile Überbreite. Der Test nutzt eine frische Browseridentität und entfernt anschließend seine Beiträge/Stimmen mit dem CLI-Helfer `tests/symptom_catalog_cleanup.php`.
