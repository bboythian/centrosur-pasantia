import requests

# Definir las credenciales y la URL de la API
api_url = "https://<XXXXXXXXX>/web_api"
username = "usermane"
password = "password"

# Autenticarse en la API
def login():
    payload = {
        "user": username,
        "password": password
    }
    response = requests.post(f"{api_url}/login", json=payload, verify=False)
    return response.json()["sid"]

# Renovar la VPN
def renovar_vpn(sid, vpn_id, nueva_fecha_expiracion):
    payload = {
        "uid": vpn_id,
        "expiration-date": nueva_fecha_expiracion
    }
    headers = {
        "X-chkp-sid": sid
    }
    response = requests.post(f"{api_url}/set-vpn", json=payload, headers=headers, verify=False)
    return response.json()

# Aplicar los cambios
def publish(sid):
    headers = {
        "X-chkp-sid": sid
    }
    response = requests.post(f"{api_url}/publish", headers=headers, verify=False)
    return response.json()

# Cerrar sesión en la API
def logout(sid):
    headers = {
        "X-chkp-sid": sid
    }
    requests.post(f"{api_url}/logout", headers=headers, verify=False)

# Ejecución del script
sid = login()
renovar_vpn(sid, "vpn-uid-ejemplo", "2024-12-31")
publish(sid)
logout(sid)
# Como puedo probar el sigueinte software, considerando que no se tiene la red de 