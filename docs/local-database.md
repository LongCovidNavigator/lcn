# Lokale Datenbank unter Windows

Stand: 17. November 2026. MariaDB 11.4.14 läuft als Windows-Dienst `mysql`
mit automatischem Start. Die lokalen LCN-Profile verbinden sich mit `127.0.0.1:3306`.
MariaDB lauscht auf IPv4. Die direkte Adresse vermeidet die Wartezeit,
die unter Windows beim Verbindungsaufbau über `localhost` auftritt.
Apache wird weiterhin über XAMPP betrieben.

## Betrieb

- Installation: `C:\xampp\mysql`
- Konfiguration: `C:\xampp\mysql\bin\my.ini`
- Daten: `C:\xampp\mysql\data`
- Fehlerprotokoll: `C:\xampp\mysql\data\mariadb-error.log`
- Start/Stopp des Dienstes: Windows-Diensteverwaltung als Administrator.
- Sauberer Stopp ist auch über `C:\xampp\mysql_stop.bat` möglich.
- Kein `taskkill /F` für den Datenbankprozess; keine Recovery-Dateien im laufenden Betrieb löschen.

Der Dienst wird nach einem Absturz mit 10, 30 und anschließend 60 Sekunden
Verzögerung neu gestartet. Bei Windows-Neustarts übernimmt die
Dienstverwaltung das Herunterfahren. Stromausfälle oder erzwungene
Systemabschaltungen können weiterhin Schäden verursachen.

## Sicherungen

Die Windows-Aufgabe `LCN-MariaDB-DailyBackup` läuft täglich um 18:00 Uhr
als SYSTEM. Verpasste Ausführungen werden nachgeholt. Sie verwendet:

`C:\xampp\db-maintenance\backup-database.ps1`

Die vollständigen SQL-Exporte einschließlich Routinen, Events und Triggern
werden komprimiert unter `C:\python\lcn_data\backups\mariadb-daily`
abgelegt, mit SHA-256-Prüfsumme und 60 Tagen Aufbewahrung. Unvollständige
Exporte werden nicht als fertige Sicherung veröffentlicht. Der Ordner ist
im Datenprojekt von Git ausgeschlossen und liegt außerhalb des Webroots.
Die Sicherungen enthalten auch Benutzerinformationen und sind vertraulich.

Diese Sicherung liegt auf demselben Laufwerk. Für Schutz bei Laufwerksausfall
wird zusätzlich eine externe Kopie benötigt.

## Neuaufbau am 17. November 2026

Die alte MariaDB 10.4.32 hatte einen defekten Aria-Recovery-Zustand.
Zusätzlich führte die beschädigte InnoDB-Tabelle
`bookstack_db.webhook_tracked_events` beim Lesen zum Serverabsturz.
BookStack wurde auf ausdrücklichen Wunsch nicht in die neue Installation
übernommen; sein Benutzer wurde entfernt.

Übernommen wurden `lcn_database`, `lcn_dummy_db`, `lcn_hybrid_database`,
`lcn_test_db`, `phpmyadmin` und `test` sowie die übrigen Benutzer.
Alle 210 Basistabellen wurden vor und nach dem Import anhand ihrer
Zeilenzahlen und logischen SHA-256-Inhaltsprüfsummen verglichen.
Die Tabellenprüfung und ein kontrollierter Dienstneustart waren erfolgreich.
Die geplante Sicherung wurde unter SYSTEM erfolgreich ausgeführt.

Die vollständige ursprüngliche Dateisicherung einschließlich BookStack und
die Prüfprotokolle liegen unter:

`C:\python\lcn_data\backups\20261117-aria-recovery`

Die alte Installation liegt unter
`C:\xampp\mysql-10.4.32-retired-20261117`. Sie darf nicht parallel gestartet
werden; ihre alte Konfiguration verweist auf den ursprünglichen Datenpfad.
Für Wiederherstellungen zuerst eine getrennte Instanz und ein eigenes
Datenverzeichnis verwenden. Alte InnoDB- oder Aria-Dateien niemals in die
aktive neue Installation kopieren.
