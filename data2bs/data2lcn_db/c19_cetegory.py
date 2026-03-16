from pathlib import Path
import re
from bs4 import BeautifulSoup

HTML_PATH = Path(__file__).with_name("treatments_debug.html")

def norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())

html = HTML_PATH.read_text(encoding="utf-8", errors="replace")
soup = BeautifulSoup(html, "html.parser")

selects = soup.find_all("select")
print("select count:", len(selects))

# Show optgroups + first few options
optgroups = soup.find_all("optgroup")
print("optgroup count:", len(optgroups))

if optgroups:
    for og in optgroups[:10]:
        label = norm(og.get("label", ""))
        opts = og.find_all("option")
        print(f"\nOPTGROUP: {label}  (options: {len(opts)})")
        for o in opts[:5]:
            print("  -", norm(o.get_text()), "=>", (o.get("value") or "").strip())

# Fallback: disabled options as category headers
if not optgroups and selects:
    s = selects[0]
    opts = s.find_all("option")
    print("\nfirst 40 <option> entries:")
    for o in opts[:40]:
        txt = norm(o.get_text())
        val = (o.get("value") or "").strip()
        dis = "disabled" if o.has_attr("disabled") else ""
        print(f"  {dis:8} {txt} => {val}")
