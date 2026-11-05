"""Empacota o instalador ou invoca-o por HTTPS. Não grava chaves nem senhas no ZIP."""
import json
import os
from pathlib import Path
import sys
import time
import urllib.error
import urllib.request
import zipfile


def build():
    with zipfile.ZipFile('.deploy/functionapp.zip') as source, zipfile.ZipFile('.deploy/bootstrap.zip', 'w', zipfile.ZIP_DEFLATED) as dest:
        for item in source.infolist():
            if item.is_dir():
                continue
            data = source.read(item)
            if item.filename == 'package.json':
                package = json.loads(data)
                package['main'] = 'scripts/bootstrap-function.js'
                data = json.dumps(package).encode()
            dest.writestr(item, data)
        for name in ('scripts/bootstrap-function.js', 'scripts/init-db.js', 'sql/schema.sql'):
            dest.write(name, name)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


def initialize():
    host = os.environ['BOOTSTRAP_HOST']
    if not host.endswith('.azurewebsites.net') or '/' in host or '@' in host:
        raise ValueError('Host de implantação inválido')
    opener = urllib.request.build_opener(NoRedirect())
    body = json.dumps({'adminUser': os.environ['SQL_ADMIN'], 'adminPassword': os.environ['SQL_ADMIN_PASSWORD']}).encode()
    request = urllib.request.Request('https://' + host + '/api/instalar-tabela', data=body,
        headers={'Content-Type': 'application/json', 'x-functions-key': os.environ['BOOTSTRAP_KEY']}, method='POST')
    last = ''
    for attempt in range(12):
        try:
            with opener.open(request, timeout=40) as response:
                if response.status == 200 and json.load(response).get('initialized') is True:
                    print('Tabela e usuário SQL inicializados a partir da Azure.')
                    return
        except urllib.error.HTTPError as exc:
            last = 'HTTP ' + str(exc.code)
            try:
                detail = json.loads(exc.read(2000))
                last += ' (' + str(detail.get('code', ''))[:30] + ' ' + str(detail.get('number', ''))[:12] + ')'
            except (ValueError, AttributeError):
                pass
            if exc.code in (401, 403):
                raise RuntimeError('Permissão recusada no instalador: ' + last) from None
        except (OSError, ValueError) as exc:
            last = type(exc).__name__
        print(f'Inicialização pendente, tentativa {attempt + 1}/12: {last}', flush=True)
        if attempt < 11:
            time.sleep(8)
    raise RuntimeError('Inicialização SQL não confirmada: ' + last)


if __name__ == '__main__':
    {'build': build, 'init': initialize}[sys.argv[1]]()
