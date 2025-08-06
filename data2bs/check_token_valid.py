import requests

token_id = "sCNy32LeFf9e281hUs3uKyqc3KZ51UdV"
token_secret = "9actS01XklxfTI312rUTSwjWS1Gw5xrM"

headers = {
    "Authorization": f"Token {token_id}:{token_secret}",
    "Content-Type": "application/json"
}

r = requests.get("http://localhost:8080/api/books", headers=headers)
print(r.status_code)
print(r.text)

print("🔎 TOKEN:", repr(token_id))
