import requests
import sys
from collections import defaultdict

# === KONFIGURATION ===================
BOOKSTACK_API_URL = "http://localhost:8080/api"
BOOKSTACK_API_TOKEN_ID = "sCNy32LeFf9e281hUs3uKyqc3KZ51UdV"
BOOKSTACK_API_TOKEN_SECRET = "9actS01XklxfTI312rUTSwjWS1Gw5xrM"
DRY_RUN = "--dry-run" in sys.argv
# =====================================


def auth_headers():
    return {
        "Authorization": f"Token {BOOKSTACK_API_TOKEN_ID}:{BOOKSTACK_API_TOKEN_SECRET}",
        "Content-Type": "application/json"
    }


def finde_doppelte_seiten():
    seiten = defaultdict(list)

    response = requests.get(
        f"{BOOKSTACK_API_URL}/pages",
        headers=auth_headers(),
        params={"count": 1000}
    )

    if response.status_code != 200:
        print("❌ Fehler beim Laden der Seiten")
        sys.exit(1)

    for seite in response.json().get("data", []):
        name = seite.get("name", "").strip().lower()
        if name:
            seiten[name].append(seite["id"])

    doppelte = {name: ids for name, ids in seiten.items() if len(ids) > 1}
    return doppelte


def lösche_doppelte_seiten(doppelte, dry_run=True):
    for name, ids in doppelte.items():
        zu_löschen = ids[1:]  # Erste behalten, Rest löschen
        for page_id in zu_löschen:
            if dry_run:
                print(f"🗑️ (Dry Run) Würde Seite mit ID {page_id} löschen: {name}")
            else:
                r = requests.delete(f"{BOOKSTACK_API_URL}/pages/{page_id}", headers=auth_headers())
                if r.status_code == 204:
                    print(f"✅ Gelöscht: {name} (ID {page_id})")
                else:
                    print(f"❌ Fehler beim Löschen von {name} (ID {page_id}): {r.status_code} – {r.text}")


def main():
    doppelte = finde_doppelte_seiten()
    if not doppelte:
        print("🎉 Keine doppelten Seiten gefunden.")
        return

    print(f"🔍 {len(doppelte)} doppelte Seitennamen gefunden.")
    lösche_doppelte_seiten(doppelte, dry_run=DRY_RUN)


if __name__ == "__main__":
    main()
