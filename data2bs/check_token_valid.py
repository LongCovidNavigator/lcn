import requests

from bs_credentials import (
    BOOKSTACK_API_URL,
    BOOKSTACK_API_TOKEN_ID,
    BOOKSTACK_API_TOKEN_SECRET
)

headers = {
    "Authorization": f"Token {token_id}:{token_secret}",
    "Content-Type": "application/json"
}

r = requests.get("http://localhost:8080/api/books", headers=headers)
print(r.status_code)
print(r.text)

print("🔎 TOKEN:", repr(token_id))
