# AV-ICL-02 — Análise de sentimentos na Azure

Aplicação serverless que coleta comentários, analisa o sentimento com Azure AI Language, grava cada resultado no Azure SQL Database por meio de uma fila e fornece os totais em JSON.

Os 22 testes passaram. A Azure criou a infraestrutura em Canada Central. A publicação das funções e a confirmação dos totais pela rota HTTP continuam pendentes. Consulte os [links de entrega](docs/ENTREGA.md) e o [registro dos comandos executados](docs/COMANDOS_EXECUTADOS.md).

## Atendimento ao enunciado

| Requisito | Implementação |
| --- | --- |
| Consultar o endpoint a cada 10 segundos | `coletarComentario`: Timer Trigger, cron `*/10 * * * * *` |
| Usar Cognitive Service | `TextAnalyticsClient.analyzeSentiment`, do Azure AI Language, idioma `pt` |
| Encaminhar o resultado à fila | Output binding do Azure Queue Storage, fila `sentimentos` |
| Uma Queue Function gravar em SQL Server na Azure | `salvarSentimento`: Queue Trigger e `INSERT` parametrizado no Azure SQL Database |
| HTTP Function listar os totais | `GET /api/sentimentos/totais`, consulta SQL agregada |
| Repositório Git | Todo o código, esquema SQL, scripts e testes neste projeto |
| Lista dos comandos de criação dos recursos | [Comandos executados](docs/COMANDOS_EXECUTADOS.md) e [roteiro da implantação](docs/COMANDOS_AZURE.md) |
| Link público para avaliação | Gerado a partir do hostname real da Function App em `docs/ENTREGA.md` |

Azure SQL Database é o serviço relacional gerenciado da família SQL Server na Azure. A aplicação utiliza T-SQL e o protocolo de conexão do SQL Server.

## Fluxo

1. O timer consulta `https://backend-n75y.onrender.com/comentarios`.
2. A API retorna um objeto com `id` e `comentario`.
3. O comentário é enviado ao Azure AI Language, que calcula sentimento e scores.
4. O resultado recebe um UUID da coleta e é enviado à fila `sentimentos`.
5. A Queue Function consome a mensagem e insere o registro em `dbo.Sentimentos`.
6. A HTTP Function consulta os registros persistidos e retorna **somente** as três contagens.

Resposta de exemplo (ilustrativa; os valores reais vêm do banco):

```json
{ "positive": 0, "neutral": 0, "negative": 1 }
```

A fila é o recurso do Azure Storage; a Queue Function é sua consumidora. A chamada HTTP não aciona uma nova análise e não consulta o endpoint de comentários.

## Organização

| Caminho | Finalidade |
| --- | --- |
| `src/functions/coletarComentario.js` | Registro do timer e saída para a fila |
| `src/functions/salvarSentimento.js` | Registro do Queue Trigger |
| `src/functions/totaisSentimentos.js` | Registro da rota HTTP |
| `src/lib/handlers.js` | Fluxo de cada função |
| `src/lib/services.js` | Acesso ao endpoint e ao Cognitive Service |
| `src/lib/domain.js` | Validação e regra para `mixed` |
| `src/lib/database.js` | Conexão SQL, INSERT e agregação |
| `sql/schema.sql` | Tabela, chave primária, índice e restrições |
| `scripts/provision.sh` | Criação/configuração dos recursos, banco e publicação |
| `scripts/init-db.js` | Execução do esquema SQL e configuração do usuário restrito |
| `scripts/publicar.sh` | Inicialização da tabela a partir da Azure e publicação das três funções |
| `scripts/package.sh` | Pacote de publicação com dependências |
| `scripts/smoke.js` | Verificação do endpoint e crescimento dos totais |
| `scripts/timer.sh` | Pausa/retomada do timer |
| `tests/` | Testes automatizados de comportamento |

## Decisões de implementação

- **Intervalo:** expressão NCRONTAB de seis campos; o primeiro representa segundos. `runOnStartup: false` evita uma coleta extra a cada reinicialização. `useMonitor: false` acompanha o padrão indicado para intervalos menores que um minuto. O agendamento é a cada 10 s, mas lentidão da origem, cold starts e falhas externas podem atrasar execuções; não é um sistema de tempo real.
- **Sentimento `mixed`:** a Azure pode devolver esse quarto rótulo. Para cumprir as três categorias solicitadas, o projeto usa o maior entre os scores `positive`, `neutral` e `negative`. Empate no maior score resulta em `neutral`. Essa é uma regra da aplicação; o rótulo original também fica salvo para auditoria.
- **Duplicidade:** o ID do endpoint pode se repetir porque os comentários são aleatórios. Cada coleta válida conta como um novo evento. A mesma mensagem reenviada pela fila mantém o UUID e a chave primária impede contar duas vezes. Não há deduplicação pelo texto nem pelo ID de origem.
- **Falhas:** se a origem ou a IA falhar, o timer registra a falha no runtime e a próxima ocorrência tenta outra coleta. Não são criados sentimentos fictícios. Se o SQL falhar, a Queue Function propaga o erro para permitir reentrega. Após cinco tentativas, mensagens problemáticas vão para `sentimentos-poison`.
- **HTTP:** banco vazio produz três zeros. Banco indisponível produz HTTP 503; não mascara erro como banco vazio. A rota pública é somente leitura e retorna contagens, sem comentários nem credenciais.
- **SQL:** comandos parametrizados, conexão TLS com validação do certificado e usuário da aplicação com apenas `SELECT` e `INSERT` na tabela. O administrador é usado somente na preparação.
- **Configuração:** credenciais ficam em Application Settings e em arquivos locais ignorados pelo Git. O pacote de deploy não inclui esses arquivos. Não usar `set -x` nos scripts, pois isso poderia imprimir segredos.
- **Dependências:** o lockfile fixa as versões. Há overrides temporários de `@azure/identity` para 4.13.0 e de `uuid` para 11.1.1, corrigindo a árvore transitiva apontada por `npm audit` ([MSAL](https://github.com/advisories/GHSA-xcx6-jx8p-x3h5), [uuid](https://github.com/advisories/GHSA-w5hq-g745-h8pq)). Este projeto usa autenticação SQL; não usa os fluxos Entra ID dessa dependência. Revisar os overrides antes de adotar autenticação Entra ID.
- **Rede:** para simplificar a avaliação, o SQL aceita conexões originadas na Azure com a regra `AllowAzureServices`, ainda exigindo autenticação. Essa regra abrange serviços Azure de outras assinaturas também. Um ambiente de produção deveria restringir a rede com VNet/private endpoints. A tabela e o usuário da aplicação são inicializados na própria Function App. O pacote temporário aceita somente POST autenticado com a chave mestra. A senha do administrador é enviada por HTTPS à própria aplicação. O pacote definitivo substitui o instalador e contém apenas as três funções da atividade.

## Concluir a implantação existente

1. Extraia o ZIP. No GitHub, envie o conteúdo para a raiz de [hqlcc/av-icl-02-azure](https://github.com/hqlcc/av-icl-02-azure), com `README.md`, `package.json` e `host.json` no mesmo nível.
2. Abra o [Azure Cloud Shell em Bash](https://shell.azure.com/bash) na assinatura Azure for Students usada na atividade. No menu de arquivos do Cloud Shell, envie o ZIP original para a sua pasta pessoal.
3. Execute os comandos abaixo. A retomada usa o grupo existente `rg-avicl02-02a82191`. O script pede a senha do administrador SQL. Se você não a tiver, pressione Enter e digite `REDEFINIR` para autorizar a troca dessa senha no servidor dedicado da atividade.

```bash
mkdir -p ~/av-icl-02-entrega
unzip -o ~/av-icl-02-azure.zip -d ~/av-icl-02-entrega
cd ~/av-icl-02-entrega
bash scripts/retomar.sh
```

4. Aguarde a mensagem `PASS: endpoint válido e novos registros no banco.`. Baixe os arquivos atualizados da pasta `docs` do Cloud Shell e inclua `COMANDOS_EXECUTADOS.md`, `ENTREGA.md` e `evidencia-fluxo.json` na pasta `docs` do GitHub. Abra o link em `ENTREGA.md` antes de enviá-lo ao professor.

## Implantar em uma nova assinatura

Usar **Bash** no Azure Cloud Shell, Linux ou WSL. No Windows, não colar o script Bash diretamente no PowerShell. Pré-requisitos: assinatura Azure ativa com permissões para os recursos, Azure CLI atual, Node.js 22, npm, Python 3 e zip. O Cloud Shell já possui Azure CLI e uma sessão autenticada; verifique as demais ferramentas com `command -v az node npm python3 zip`.

Primeiro obtenha este projeto, por clone do repositório publicado ou extraindo o ZIP recebido. Na raiz:

```bash
# No terminal local; no Cloud Shell a sessão já está autenticada:
az login

# Consulte suas assinaturas e copie o ID correto:
az account list --query "[].{nome:name,id:id,padrao:isDefault}" -o table
export AZURE_SUBSCRIPTION_ID="ID-DA-SUA-ASSINATURA"

# Opcional: defina uma região autorizada pela assinatura antes da 1ª execução.
export LOCATION="canadacentral"
export LANGUAGE_LOCATION="canadacentral"

# Repositório da atividade
export REPOSITORY_URL="https://github.com/hqlcc/av-icl-02-azure"

bash scripts/provision.sh
```

O script gera nomes exclusivos e os guarda em `.deploy/resources.env`; para uma retomada, preserva esses nomes. Não edite esse arquivo para apontar a recursos de outros projetos. As senhas geradas ficam em `.deploy/secrets.env`, com acesso restrito ao proprietário e fora do Git. Uma falha interrompe a execução e fica registrada; recursos já criados podem continuar existindo e gerando custo.

O script cria: Resource Group, Storage Account, fila, Cognitive Service `TextAnalytics` F0, servidor lógico SQL, banco Basic, regras de firewall, Function App Flex Consumption e monitoramento associado. Configura a aplicação, prepara a tabela e publica o pacote. O timer fica desabilitado durante a preparação e é habilitado ao final.

O histórico sanitizado de cada comando executado e seu exit code fica em `docs/COMANDOS_EXECUTADOS.md`. Credenciais são representadas por variáveis. Os comandos digitados manualmente antes do script, como `az login`, também devem ser acrescentados a esse arquivo, sem tokens ou senhas.

### Validar e registrar evidência

Depois que o host iniciar:

```bash
source .deploy/resources.env
npm run smoke -- "$TOTALS_URL"
```

O teste exige HTTP 200, JSON com exatamente as três chaves e valores inteiros não negativos. Lê os totais novamente a cada 10 s, por até dois minutos, e exige aumento em pelo menos uma contagem. Ao passar, grava a URL, horário e os valores antes/depois em `docs/evidencia-fluxo.json`. Essa evidência só é criada após uma execução real bem-sucedida.

Abra a mesma URL em uma janela anônima e confirme os dados. No portal, a Function App deve listar `coletarComentario`, `salvarSentimento` e `totaisSentimentos`.

### Custos e cota

O script usa Language **F0**, sem promover automaticamente para uma camada paga. A oferta gratuita documentada tem limite mensal de 5.000 registros de texto, compartilhado por certas funcionalidades; cada 1.000 caracteres conta como um registro. Com um comentário curto a cada 10 s, são até **360 chamadas/hora** e **8.640/dia**. Cinco mil análises seriam consumidas em aproximadamente **13 h 53 min** de execução contínua, se a cota estiver intacta e cada comentário consumir um registro.

SQL Basic, Storage, Functions e logs podem gerar cobrança ou consumir créditos. O custo efetivo depende da assinatura, região e uso. Verificar no portal antes da criação. Se F0 ou a região não estiverem disponíveis, o script para; ajustar a configuração conscientemente, sem aceitar mudança de plano paga como fallback automático.

Para economizar cota fora da avaliação:

```bash
bash scripts/timer.sh pause
bash scripts/timer.sh resume
```

Pausar mantém os registros e a rota HTTP, mas **interrompe novas coletas**: deixe o timer ativo durante a avaliação. Pausar o timer não elimina o custo do banco. Após a correção, se o grupo só contiver recursos desta atividade, pode removê-lo:

```bash
source .deploy/resources.env
az group delete --name "$RESOURCE_GROUP"
```

A exclusão remove também os dados e o endpoint. Não execute antes da avaliação.

## Rodar testes e desenvolver localmente

```bash
npm ci --ignore-scripts
npm test
```

Os testes locais usam respostas controladas nas integrações; não substituem a validação real com Azure Language, Storage e SQL. Para executar o host local, instalar Azure Functions Core Tools v4 e Azurite, copiar `local.settings.example.json` para `local.settings.json` e preencher as configurações. Iniciar Azurite, liberar o IP local no SQL e então executar `npm start`. A tabela deve ter sido criada pelo script. Para impedir coletas locais enquanto testa apenas HTTP, use `AzureWebJobs.coletarComentario.Disabled=true` no arquivo local.

## Entrega ao professor

1. Publicar os arquivos no repositório Git e confirmar que o professor pode acessá-lo.
2. Executar a implantação na assinatura escolhida.
3. Executar o teste real e incluir `docs/COMANDOS_EXECUTADOS.md`, `docs/evidencia-fluxo.json` e `docs/ENTREGA.md` no commit final.
4. Atualizar o estado no início deste README somente depois de confirmar o deploy.
5. Enviar a URL do repositório e a URL HTTP gerada. Manter o endpoint e o timer ativos no período combinado para correção.

Consultar também [roteiro de demonstração](docs/DEMONSTRACAO.md) e [problemas comuns](docs/PROBLEMAS_COMUNS.md).

## Referências

- [Azure Functions — Node.js](https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node)
- [Timer Trigger](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-timer)
- [Queue output binding](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-storage-queue-output)
- [Queue Trigger e reentregas](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-storage-queue-trigger)
- [Flex Consumption: criação e implantação](https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-how-to)
- [Sentiment Analysis e rótulo mixed](https://learn.microsoft.com/en-us/azure/ai-services/language-service/sentiment-opinion-mining/how-to/call-api)
- [Preços e franquia do Azure Language](https://azure.microsoft.com/en-us/pricing/details/language/)
