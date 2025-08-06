
import json
import requests
import sys

# === KONFIGURATION ===================
BOOKSTACK_API_URL = "http://localhost:8080/api"
BOOKSTACK_API_TOKEN_ID = "sCNy32LeFf9e281hUs3uKyqc3KZ51UdV"
BOOKSTACK_API_TOKEN_SECRET = "9actS01XklxfTI312rUTSwjWS1Gw5xrM"

BOOK_ID = 1
CHAPTER_ID = 1  # ❗ Hier deine Kapitel-ID eintragen
JSON_FILE = "C:/xampp/htdocs/lcn/assets/data/long_covid_treatments_corrected.json"
DRY_RUN = "--dry-run" in sys.argv
# =====================================


def auth_headers():
    return {
        "Authorization": f"Token {BOOKSTACK_API_TOKEN_ID}:{BOOKSTACK_API_TOKEN_SECRET}",
        "Content-Type": "application/json"
    }


def lade_daten():
    with open(JSON_FILE, encoding="utf-8") as f:
        return json.load(f)


def generiere_markdown(e):
    titel = e.get("Behandlung", "Unbenannt")
    eskalation = e.get("Eskalationsstufe", "")
    geschwindigkeit = e.get("Wirkgeschwindigkeit", "")
    aufwand = str(e.get("Aufwand", ""))
    kosten_min = e.get("Kosten min")
    kosten_max = e.get("Kosten max")
    kosten = "–".join(filter(None, [str(kosten_min) + " €" if kosten_min is not None else None,
                                     str(kosten_max) + " €" if kosten_max is not None else None])) or "?"
    crashrisiko = e.get("Crashrisiko", "")

    markdown = f"""# 🧪 {titel}

> *Kurzbeschreibung (2–3 Sätze), worum es bei dieser Therapie geht.*

---

## ⚡ Schnellüberblick (strukturiert)

| **Feld**              | **Wert**                                                |
|-----------------------|---------------------------------------------------------|
| 🚦 **Eskalationsstufe**| {eskalation}                                            |
| ⏱ **Wirkgeschwindigkeit** | {geschwindigkeit}                                    |
| 🔄 **Aufwand**         | {aufwand}                                               |
| 💰 **Kosten**          | {kosten}                                                |
| ⚠️ **Crashrisiko**     | {crashrisiko}                                           |

> [Mehr zur Einordnung der Skalenwerte](http://localhost:8080/link/2#bkmrk-feldwerteskalationss)

---

## 🩺 Empfohlene Ärzt*innen / Anlaufstellen

| Name/Einrichtung        | Ort / Land         | Spezialisierung / Anmerkungen |
|-------------------------|--------------------|-------------------------------|
|                         |                    |                               |

---

## 🧾 Übersicht der Bewertung

| Kriterium              | Einschätzung        | Anmerkung                                 |
|------------------------|---------------------|--------------------------------------------|
| ⏱ Wirkungseintritt     | ❍ Schnell / Mittel / Langsam | z. B. erste Wirkung nach 2 Wochen      |
| 💸 Kosten              | ❍ Niedrig / Mittel / Hoch     | z. B. 120 € pro Sitzung, nicht erstattungsfähig |
| ⚠️ Crash-Risiko        | ❍ Hoch / Mittel / Gering      | z. B. nur bei Überlastung relevant     |
| 🧠 Symptome, die angesprochen werden | ❍ Fatigue / PEM / Brain Fog / ... | z. B. speziell wirksam bei Atemnot     |
| 📚 Studienlage         | ❍ Gut / Mittel / Schwach      | z. B. kleine Pilotstudie vorhanden     |

---

## 🧠 Zielgruppe & Anwendung

> Für wen ist diese Therapie gedacht?  
> Gibt es Voraussetzungen (z. B. Schweregrad, Ausschlusskriterien)?  
> Wie wird sie typischerweise durchgeführt (z. B. wöchentlich, ambulant)?

---

## ✅ Mögliche Vorteile

- [ ] z. B. sanftes Verfahren ohne Medikamente  
- [ ] individuell anpassbar  
- [ ] spürbare Verbesserung laut Erfahrungsberichten  

---

## ⚠️ Mögliche Risiken / Nachteile

- [ ] z. B. teuer, nicht erstattungsfähig  
- [ ] wenig evidenzbasiert  
- [ ] kann Crashes auslösen

---

## 📚 Studien, Quellen & Links

- [ ] [Titel der Studie (2023)](https://)
"""
    return markdown


def lade_existierende_seiten():
    existing_titles = set()
    page = 1

    while True:
        response = requests.get(
            f"{BOOKSTACK_API_URL}/pages",
            headers=auth_headers(),
            params={"count": 100, "page": page}
        )

        if response.status_code == 404:
            print(f"❌ Abbruch: Endpoint nicht gefunden (Seite {page})")
            sys.exit(1)

        if response.status_code != 200:
            print(f"⚠️ Fehler beim Laden existierender Seiten (Seite {page}) – Code: {response.status_code}")
            sys.exit(1)

        data = response.json().get("data", [])
        if not data:
            break

        for p in data:
            name = p.get("name", "").strip().lower()
            if name:
                existing_titles.add(name)

        page += 1

    return existing_titles


def erstelle_bookstack_seite(title, markdown):
    payload = {
        "book_id": BOOK_ID,
        "chapter_id": CHAPTER_ID,
        "name": title,
        "markdown": markdown
    }

    response = requests.post(
        f"{BOOKSTACK_API_URL}/pages",
        json=payload,
        headers=auth_headers()
    )
    return response.status_code, response.text


def main():
    daten = lade_daten()
    existierende = lade_existierende_seiten()

    neu = 0
    übersprungen = 0

    for eintrag in daten:
        title = eintrag.get("Behandlung", "Unbenannt").strip()
        title_key = title.lower()

        if title_key in existierende:
            print(f"⏭️  Seite existiert bereits: {title}")
            übersprungen += 1
            continue

        markdown = generiere_markdown(eintrag)

        if DRY_RUN:
            print(f"📝 (Dry Run) Würde erstellen: {title}")
        else:
            code, msg = erstelle_bookstack_seite(title, markdown)
            if code in (200, 201):
                print(f"✅ Erstellt: {title}")
                neu += 1
                existierende.add(title_key)
            else:
                print(f"❌ Fehler bei {title}: {code} – {msg}")

    print("\n🧾 Zusammenfassung:")
    print(f"Neu erstellt: {neu}")
    print(f"Übersprungen (existierte schon): {übersprungen}")


if __name__ == "__main__":
    main()
