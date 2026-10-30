# Datenbank auswählen

Alle APIs verwenden dieselbe zentrale Verbindung.

Zugangsdaten bleiben ausschließlich in der geschützten `private/lcn.env` außerhalb
des öffentlichen Website-Ordners (oder am über `LCN_ENV_FILE` konfigurierten Ort).
Diese Datei kann einmalig mehrere Profile enthalten. Sie wird nicht hochgeladen
oder in Git gespeichert. Profilnamen sind keine Zugangsdaten.

Der synchronisierte Schalter liegt in `api/_database_profile.php`. Für die
Online-Datenbank wird dort die letzte Zeile geändert:

```php
return 'ONLINE_HYBRID';
```

Das wählt folgende vorhandene Einstellungen aus der geschützten Datei:

```dotenv
LCN_DB_ONLINE_HYBRID_HOST=10.9.0.1
LCN_DB_ONLINE_HYBRID_DATABASE=d048c382
LCN_DB_ONLINE_HYBRID_USERNAME=d048c382
LCN_DB_ONLINE_HYBRID_PASSWORD="HIER_DAS_PASSWORT"
```

Host und Benutzer müssen den Angaben des Hosters entsprechen. Der gemeinsame
Port wird mit `LCN_DB_PORT` gesetzt (Standard: 3306).

Für die lokale Hybrid-Datenbank kann `return 'LOCAL_HYBRID';` gewählt werden,
wenn `LCN_DB_LOCAL_HYBRID_DATABASE=lcn_hybrid_database` und die zugehörigen
Zugangsdaten einmalig in der lokalen geschützten Datei hinterlegt wurden.

Der Code-Schalter hat Vorrang vor `LCN_DB_ACTIVE_PROFILE` in der geschützten Datei.
Mit `return null;` bleibt die bisherige Profilauswahl aus der geschützten Datei
aktiv. Dies ist der Ausgangszustand, um eine vorhandene Installation nicht
unbeabsichtigt auf eine andere Datenbank umzustellen.

Nach der einmaligen Einrichtung der Profile reicht zum Umschalten eine Änderung
an `api/_database_profile.php` und das Hochladen dieser Datei. Auf dem Zielserver
muss das ausgewählte Profil vorhanden und erreichbar sein. Ein unbekannter
Profilname wird abgelehnt; es gibt dann keinen stillen Wechsel auf eine andere
Datenbank. `LCN_DOCTORS_DB_*` wird nicht mehr benötigt.
