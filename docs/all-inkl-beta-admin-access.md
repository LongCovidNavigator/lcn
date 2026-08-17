# Beta- und Adminzugang über ALL-INKL

Die Anwendung verwendet kein eigenes Passwortsystem. ALL-INKL/Apache authentifiziert die Benutzer vor der Auslieferung der Beta-Website.

- `test`: normale Beta-Website.
- `admin`: normale Beta-Website plus `freigaben.php` und Freigabe-API.

Optionaler Benutzername außerhalb des Webroots:

```env
LCN_ADMIN_USERNAME=admin
```

Ohne Konfiguration gilt `admin`. Im bestehenden KAS-Verzeichnisschutz werden `test` und `admin` angelegt. Beide melden sich nur einmal an. Der Webserver muss den Namen als `REMOTE_USER` oder `PHP_AUTH_USER` an PHP weitergeben.

Nach der Bereitstellung testen:

1. Als `test`: normale Seiten erreichbar, kein Freigabe-Link, `freigaben.php` liefert 403.
2. Als `admin`: normale Seiten und Freigabeseite erreichbar, Freigabe-Link sichtbar.
