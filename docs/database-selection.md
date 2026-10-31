# Datenbank je Umgebung auswählen

`api/_database_profile.php` enthält vier unabhängige Schalter im Abschnitt
`profiles`: `local`, `dev`, `beta` und `production`. Die Datei wird mit dem Code
synchronisiert. Zugangsdaten gehören ausschließlich in die geschützte `lcn.env`.

Der Abschnitt `hosts` ordnet localhost/127.0.0.1/::1 der lokalen Umgebung,
 dev.lcnavi.de der Dev-Umgebung, beta.lcnavi.de der Beta-Umgebung und
lcnavi.de/www.lcnavi.de der Hauptseite zu. Unbekannte Hosts werden abgelehnt.
Zusätzliche lokale Hostnamen müssen explizit eingetragen werden.
CLI-Skripte wählen standardmäßig die lokale Umgebung.

Aktuelle Zuordnung:

| Umgebung | Profil |
| --- | --- |
| lokal | LOCAL_HYBRID |
| Dev | ONLINE_HYBRID |
| Beta | ONLINE_HYBRID |
| Hauptseite | ONLINE_HYBRID |

Die drei Online-Zuordnungen übernehmen zunächst das bisher gewählte Profil.
Sie sind unabhängig einstellbar: Eine Änderung an `dev` verändert weder `beta`
noch `production`. Gleiche Profile bedeuten dieselbe Datenbank einschließlich
aller Schreibzugriffe; sie erzeugen keine getrennten Datenbestände.

Erlaubte Profile: LOCAL_MAIN, LOCAL_TEST, LOCAL_DUMMY, LOCAL_HYBRID,
ONLINE_TEST, ONLINE_DUMMY, ONLINE_HYBRID. Online sind nur ONLINE-Profile erlaubt.
Lokal können auch Online-Profile gewählt werden, sofern die Verbindung besteht
(zum Beispiel über VPN).

Für ONLINE_HYBRID werden LCN_DB_ONLINE_HYBRID_HOST, DATABASE, USERNAME und
PASSWORD aus lcn.env gelesen (jeweils mit dem vollständigen Präfix
LCN_DB_ONLINE_HYBRID_). Für LOCAL_HYBRID gilt entsprechend
LCN_DB_LOCAL_HYBRID_. Der Port wird gemeinsam über LCN_DB_PORT gesetzt.
Die jeweilige geschützte Datei auf dem Zielserver muss die ausgewählten Profile
enthalten. Der Code enthält keine Passwörter und kopiert keine Zugangsdaten.

Alle APIs teilen dieselbe zentrale PDO-Verbindung. LCN_DOCTORS_DB_* ist obsolet.
LCN_DB_ACTIVE_PROFILE wird bei dieser Vier-Umgebungs-Konfiguration nicht mehr
zur Auswahl verwendet. Bestehende skalare Konfigurationen bleiben kompatibel.
