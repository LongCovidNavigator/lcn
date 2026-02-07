import os
import json
from pathlib import Path
import mysql.connector
from dotenv import load_dotenv


# =========================
# HARD-CODE SETTINGS
# =========================
# Wichtig: Wir lesen die BookStack .env nur, um an LCN_DB_* zu kommen.
# Es wird NICHT in die BookStack DB geschrieben, sondern in LCN_DB_DATABASE.
BOOKSTACK_ENV_PATH = r"C:\xampp\htdocs\bookstack\.env"

# Quelle der Behandlungen:
# Option A (empfohlen): aus deiner Treatments-DB-Tabelle (die du schon nutzt)
TREATMENTS_SOURCE_TABLE = "lcn_raw_wiki"  # <- die Tabelle, aus der dein treatments_from_db.php aktuell liest

# Option B: alternativ direkt aus dem JSON file (falls du lieber willst)
# JSON_PATH = r"C:\xampp\htdocs\lcn\assets\data\long_covid_treatments_corrected.json"

# Ziel: neue Live-Tabelle für Votes
VOTES_TABLE = "lcn_votes"


# =========================
# LOAD ENV
# =========================
if not os.path.exists(BOOKSTACK_ENV_PATH):
    raise FileNotFoundError(f".env not found at: {BOOKSTACK_ENV_PATH}")

load_dotenv(BOOKSTACK_ENV_PATH)

db = os.getenv("LCN_DB_DATABASE")
if not db:
    raise RuntimeError("LCN_DB_DATABASE fehlt in .env. Bitte setzen (niemals BookStack DB).")

# Safety: niemals BookStack DB
if db.strip().lower() in {"bookstack_db", "bookstack", "bookstackdb"}:
    raise RuntimeError(f"Refusing to write into BookStack DB ({db}). Check LCN_DB_DATABASE!")

host = os.getenv("LCN_DB_HOST") or os.getenv("DB_HOST") or "localhost"
port = int(os.getenv("LCN_DB_PORT") or os.getenv("DB_PORT") or "3306")
user = os.getenv("LCN_DB_USERNAME") or os.getenv("DB_USERNAME") or "root"
pw   = os.getenv("LCN_DB_PASSWORD") or os.getenv("DB_PASSWORD") or ""


def connect():
    print("Connecting to:", {"host": host, "port": port, "user": user, "database": db})
    return mysql.connector.connect(
        host=host, port=port, user=user, password=pw, database=db, autocommit=False
    )


def ensure_votes_table(cur):
    cur.execute(f"""
        CREATE TABLE IF NOT EXISTS `{VOTES_TABLE}` (
          `Behandlung` VARCHAR(255) NOT NULL,
          `pro` INT NOT NULL DEFAULT 0,
          `neutral` INT NOT NULL DEFAULT 0,
          `contra` INT NOT NULL DEFAULT 0,
          `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (`Behandlung`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """)


def load_treatments_from_db(cur):
    # Holt alle Behandlungen aus der bestehenden Treatments-Quelle.
    # Achtung: in der Source-Tabelle kann es Zusatzzeilen geben.
    # Wir nehmen DISTINCT Behandlung und filtern NULL/leer.
    cur.execute(f"""
        SELECT DISTINCT `Behandlung`
        FROM `{TREATMENTS_SOURCE_TABLE}`
        WHERE `Behandlung` IS NOT NULL AND TRIM(`Behandlung`) <> ''
        ORDER BY `Behandlung` ASC
    """)
    return [r[0] for r in cur.fetchall()]


def seed_votes(cur, behandlungen):
    # Legt pro Behandlung eine Zeile an (0/0/0), falls nicht vorhanden.
    # ON DUPLICATE KEY: nichts überschreiben (wichtig, damit bestehende Votes bleiben)
    sql = f"""
        INSERT INTO `{VOTES_TABLE}` (`Behandlung`, `pro`, `neutral`, `contra`)
        VALUES (%s, 0, 0, 0)
        ON DUPLICATE KEY UPDATE `Behandlung` = `Behandlung`;
    """
    data = [(b,) for b in behandlungen]
    # batch insert
    cur.executemany(sql, data)


def main():
    conn = connect()
    try:
        cur = conn.cursor()
        ensure_votes_table(cur)

        behandlungen = load_treatments_from_db(cur)
        if not behandlungen:
            raise RuntimeError("Keine Behandlungen gefunden. Prüfe TREATMENTS_SOURCE_TABLE und Spalte `Behandlung`.")

        seed_votes(cur, behandlungen)
        conn.commit()

        print(f"✅ Done. Seeded {len(behandlungen)} rows into `{VOTES_TABLE}` (0/0/0), without overwriting existing votes.")
    except Exception as e:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
