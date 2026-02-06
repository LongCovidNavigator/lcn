import requests
from bs4 import BeautifulSoup
from bs_token import (
    BOOKSTACK_API_URL,
    BOOKSTACK_API_TOKEN_ID,
    BOOKSTACK_API_TOKEN_SECRET
)

def auth_headers():
    return {
        "Authorization": f"Token {BOOKSTACK_API_TOKEN_ID}:{BOOKSTACK_API_TOKEN_SECRET}",
        "Content-Type": "application/json"
    }

def lade_alle_seiten():
    res = requests.get(f"{BOOKSTACK_API_URL}/pages?count=1000", headers=auth_headers())
    if res.status_code != 200:
        print("❌ Fehler beim Abrufen der Seitenliste")
        return []
    return res.json().get("data", [])

def lade_html_von_seite(page_id):
    res = requests.get(f"{BOOKSTACK_API_URL}/pages/{page_id}", headers=auth_headers())
    if res.status_code != 200:
        return None
    return res.json()

def update_seite(seite, html_neu):
    payload = {
        "html": html_neu,
        "name": seite["name"],
        "book_id": seite["book_id"],
        "chapter_id": seite.get("chapter_id"),
    }
    res = requests.put(f"{BOOKSTACK_API_URL}/pages/{seite['id']}", headers=auth_headers(), json=payload)
    return res.status_code in (200, 204)

def widget_einfügen(html, name):
    soup = BeautifulSoup(html, "html.parser")
    if soup.find("div", {"class": "lcn-rating-widget"}):
        return None  # Bereits vorhanden
    neues_div = soup.new_tag("div", attrs={"class": "lcn-rating-widget", "data-name": name})
    soup.append(neues_div)
    return str(soup)

def main():
    seiten = lade_alle_seiten()
    hinzugefügt = 0
    übersprungen = 0

    for seite in seiten:
        name = seite.get("name", "").strip()
        inhalt = lade_html_von_seite(seite["id"])
        if not inhalt:
            continue

        html_alt = inhalt["html"]
        html_neu = widget_einfügen(html_alt, name)

        if html_neu is None:
            übersprungen += 1
            continue

        if update_seite(seite, html_neu):
            print(f"✅ Widget hinzugefügt: {name}")
            hinzugefügt += 1
        else:
            print(f"❌ Fehler beim Aktualisieren: {name}")

    print("\n📊 Zusammenfassung:")
    print(f"➕ Eingefügt: {hinzugefügt}")
    print(f"⏭️ Bereits vorhanden: {übersprungen}")

if __name__ == "__main__":
    main()
