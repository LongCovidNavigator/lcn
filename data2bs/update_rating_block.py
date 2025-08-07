import requests
import json

# === KONFIGURATION ===================
from bs_credentials import (
    BOOKSTACK_API_URL,
    BOOKSTACK_API_TOKEN_ID,
    BOOKSTACK_API_TOKEN_SECRET
)

# BEWERTUNGSDATEI = "C:/xampp/htdocs/lcn/assets/data/bewertung_static.json"
BEWERTUNGSDATEI = "http://lcn.localhost.test:8080/scripts/export/bewertung_export.php"

ZIELE = ["Kortison", "HBO strong", "HELP Apherese"]
# =====================================

def auth_headers():
    return {
        "Authorization": f"Token {BOOKSTACK_API_TOKEN_ID}:{BOOKSTACK_API_TOKEN_SECRET}",
        "Content-Type": "application/json"
    }

def lade_bewertungen():
    if BEWERTUNGSDATEI.startswith("http"):
        response = requests.get(BEWERTUNGSDATEI)
        response.raise_for_status()
        return response.json()
    else:
        with open(BEWERTUNGSDATEI, encoding="utf-8") as f:
            return json.load(f)


def generiere_bewertungsblock(eintrag):
    return f"""<!-- LCN-BEWERTUNG-START -->
> 🗳 **Nutzer-Bewertung:**  
> 👍 {eintrag['pro']} Verbesserungen  
> 😐 {eintrag['neutral']} neutral  
> 👎 {eintrag['contra']} Verschlechterungen  

> [Zur Bewertung]({eintrag['bewertung_url']}) | [Im Protokoll anzeigen]({eintrag['protokoll_url']})
<!-- LCN-BEWERTUNG-END -->"""

def finde_page_id_by_title(title):
    res = requests.get(f"{BOOKSTACK_API_URL}/pages?count=1000", headers=auth_headers())
    if res.status_code != 200:
        print(f"❌ Fehler beim Abrufen der Seitenliste: {res.status_code}")
        return None
    for p in res.json().get("data", []):
        if p["name"].strip().lower() == title.strip().lower():
            return p["id"]
    print(f"⚠️ Keine Seite gefunden für Titel: {title}")
    return None

def lade_page_markdown(page_id):
    res = requests.get(f"{BOOKSTACK_API_URL}/pages/{page_id}", headers=auth_headers())
    if res.status_code != 200:
        print(f"❌ Fehler beim Laden von Seite {page_id}: {res.status_code}")
        return None
    return res.json().get("markdown", "")

def aktualisiere_page(page_id, title, neuer_inhalt):
    payload = {
        "name": title,
        "markdown": neuer_inhalt
    }
    res = requests.put(f"{BOOKSTACK_API_URL}/pages/{page_id}", headers=auth_headers(), json=payload)
    if res.status_code in (200, 201):
        print(f"✅ Bewertungsblock aktualisiert für: {title}")
    else:
        print(f"❌ Fehler beim Aktualisieren von {title}: {res.status_code} – {res.text}")

def ersetze_bewertungsblock(markdown, neuer_block):
    start_marker = "<!-- LCN-BEWERTUNG-START -->"
    end_marker = "<!-- LCN-BEWERTUNG-END -->"

    if start_marker in markdown and end_marker in markdown:
        start = markdown.index(start_marker)
        end = markdown.index(end_marker) + len(end_marker)
        return markdown[:start] + neuer_block + markdown[end:]
    else:
        print("⏭️  Kein Platzhalter vorhanden – Einfügen wird übersprungen.")
        return None  # Signalisiert, dass nichts geändert werden soll


def main():
    bewertungen = lade_bewertungen()
    for ziel in ZIELE:
        eintrag = next((b for b in bewertungen if b["Behandlung"].lower() == ziel.lower()), None)
        if not eintrag:
            print(f"⚠️ Kein Bewertungseintrag gefunden für: {ziel}")
            continue

        page_id = finde_page_id_by_title(ziel)
        if not page_id:
            continue

        alt_markdown = lade_page_markdown(page_id)
        if not alt_markdown:
            continue

        neuer_block = generiere_bewertungsblock(eintrag)

        neuer_markdown = ersetze_bewertungsblock(alt_markdown, neuer_block)
        if neuer_markdown is None:
            continue  # Seite wird übersprungen
        aktualisiere_page(page_id, ziel, neuer_markdown)

if __name__ == "__main__":
    main()
