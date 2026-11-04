"""Obtém o IPv4 público usado para inicializar o SQL; não envia credenciais."""
import ipaddress
import urllib.request

with urllib.request.urlopen("https://api.ipify.org", timeout=20) as response:
    address = response.read().decode().strip()
print(ipaddress.IPv4Address(address))
