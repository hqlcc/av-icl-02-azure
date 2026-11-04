# Estado da validação

Preparação em 28/10/2026. Este documento separa o que foi conferido do que depende da assinatura Azure.

## Executado localmente

- O endpoint real do professor respondeu HTTP 200 com `{ "id": 21, "comentario": "A compra foi simples e não tive nenhum problema." }` em uma consulta. Uma chamada posterior usando o próprio cliente da aplicação também leu um comentário válido.
- 22 testes automatizados em Node.js 22: aprovados. Saída integral em `TESTES_LOCAIS.txt`.
- Auditoria de dependências de produção: `npm audit --omit=dev` sem vulnerabilidades reportadas após os ajustes no lockfile.
- Sintaxe dos três scripts Bash: validada com `bash -n`.
- Módulos JavaScript: importação sem erros. Importar fora do host não registra triggers e não substitui um teste Azure.
- Parâmetros principais de criação/publicação conferidos com a ajuda da Azure CLI 2.91.0 instalada.
- Pacote de publicação gerado com `host.json` na raiz, fontes e dependências de produção, sem configurações locais ou segredos.

## Limite encontrado no ambiente de preparação

Foi instalado Azure Functions Core Tools 4.16.0 e tentada a inicialização local. O host não conseguiu baixar o extension bundle da Microsoft por indisponibilidade de conexão nesse ambiente. Assim, **não foi confirmada a execução dos triggers no host local**. Os testes automatizados verificam a lógica com dependências controladas.

## Ainda pendente

- Autenticação e escolha da assinatura Azure.
- Criação dos recursos e execução do esquema no Azure SQL real.
- Chamada autenticada ao Azure AI Language.
- Disparo real do timer, publicação/consumo da fila e persistência SQL.
- Endpoint HTTPS público, com HTTP 200 e totais crescentes.
- Inclusão do link público do endpoint após a validação na Azure.

Após implantar, executar `npm run smoke -- "$TOTALS_URL"` e revisar os logs das três funções. O teste gera `evidencia-fluxo.json` somente ao observar os dados reais aumentando. Não há evidência fabricada de deploy ou integração neste projeto.
