# Terminform: aktive und zurückgestellte Variante

Aktiv ist die frühere sichtbare Variante 2: Zahlen links/rechts vom Balken, direkte Abstimmung, zweite Auswahl nimmt die Stimme zurück. Im Code heißt sie appointmentVariant(3).

Die frühere sichtbare Variante 3 ist absichtlich nicht gerendert, aber vollständig erhalten: appointmentVariant(4) und mergedAppointmentCell in scripts/arzt_detail_konzept.js samt CSS in styles/arzt_detail_konzept.css. Anklicken ersetzt den Status durch zwei Optionen; Zustimmung führt zu einem gemeinsamen Feld mit passendem Farbrand, Abweichung zu Community/eigener Angabe. Zum späteren Vergleich appointmentVariant(4) wieder im Rückgabewert von appointment() hinzufügen. Es wird dieselbe gespeicherte Stimme verwendet.

Testansicht für leere Terminformen: arzt_detail.html?id=613&demo=termine-null#termin. Alle sechs Terminformen beginnen bei 0/0. Abstimmungen werden nur im Seitenspeicher simuliert, nicht an die API gesendet. Neuladen setzt den Test zurück. Andere Bewertungsfelder sind in diesem Testmodus deaktiviert. Die normale URL verwendet unverändert echte und konfigurierte Dummy-Daten.
