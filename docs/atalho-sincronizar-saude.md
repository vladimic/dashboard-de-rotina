# Atalho "Sincronizar Saúde" (iPhone)

O app Saúde não tem API na web — os dados só saem do iPhone. Este atalho lê
as pesagens do Saúde e envia para `/api/health-webhook`, que grava na tabela
`health_samples` do Supabase. A aba **Saúde** do dashboard lê de lá.

- **1ª execução:** o servidor responde "desde 2000-01-01", então o atalho
  manda **todo o histórico**.
- **Depois:** o servidor responde a data da última pesagem já gravada, e o
  atalho só manda **o que é novo**. Repetir uma pesagem não duplica nada.

## Configuração (uma vez)

1. **Supabase → SQL Editor:** rode `supabase/health_samples.sql`.
2. **Seu ID de usuário:** no SQL Editor, `select id, email from auth.users;`
   e copie o `id` do seu e-mail.
3. **Vercel → Settings → Environment Variables** (Production), depois faça
   um redeploy:
   - `HEALTH_WEBHOOK_SECRET` — uma senha longa aleatória
     (ex.: `openssl rand -hex 24` no Terminal).
   - `HEALTH_USER_ID` — o `id` do passo 2.
   - (`SUPABASE_SERVICE_ROLE_KEY` já existe, é o mesmo dos Lembretes.)

## Montando o atalho

No app **Atalhos** → **+** → nome **Sincronizar Saúde**. Ações, em ordem:

1. **Texto** → cole o valor de `HEALTH_WEBHOOK_SECRET`.
   Renomeie a variável para **Segredo** (toque no ícone da ação → Renomear).

2. **Obter Conteúdo do URL**
   - URL: `https://dashboard-de-rotina.vercel.app/api/health-webhook?type=weight`
   - Método: **GET**
   - Cabeçalhos: `Authorization` = `Bearer ` + variável **Segredo**
     (com um espaço depois de "Bearer").

3. **Obter Valor do Dicionário** → chave `since` em *Conteúdo do URL*.

4. **Obter Datas de** *Valor do Dicionário*. Renomeie para **Desde**.

5. **Encontrar Amostras de Saúde**
   - Filtro: **Tipo** é **Peso**
   - **Adicionar Filtro:** **Data de Início** é **posterior a** variável **Desde**
   - Ordenar por: **Data de Início**, **Mais Antigo Primeiro**
   - Limite: **desligado**

6. **Repetir com Cada** item em *Amostras de Saúde*. Dentro do repetir:
   1. **Formatar Data** → *Item de Repetição*, toque nele e escolha
      **Data de Início**. Formato: **ISO 8601**, **Incluir Hora** ligado.
   2. **Dicionário** com 4 chaves (todas tipo Texto):
      - `date` → *Data Formatada*
      - `value` → *Item de Repetição* → **Valor**
      - `unit` → *Item de Repetição* → **Unidade**
      - `source` → *Item de Repetição* → **Nome da Fonte**

7. (depois do Fim da Repetição) **Combinar Texto** → *Resultados da
   Repetição*, separador **Personalizado** = `,`

8. **Texto**:
   ```
   {"type":"weight","samples":[Texto Combinado]}
   ```
   (onde `Texto Combinado` é a variável da ação 7, inserida no meio)

9. **Obter Conteúdo do URL**
   - URL: `https://dashboard-de-rotina.vercel.app/api/health-webhook`
   - Método: **POST**
   - Cabeçalhos: `Authorization` = `Bearer ` + **Segredo**;
     `Content-Type` = `application/json`
   - Corpo da Solicitação: **Arquivo** → variável *Texto* (da ação 8)

10. (opcional) **Mostrar Notificação** → *Conteúdo do URL* — mostra
    `{"ok":true,"saved":N,...}` para conferir.

Na 1ª execução o iOS pede permissão para o atalho ler o Peso no Saúde —
permita. Com muitos anos de pesagens, a 1ª execução pode levar alguns
minutos: mantenha a tela ligada até terminar.

## Rodando sozinho todo dia

Atalhos → **Automação** → **+** → **Hora do Dia** (ex.: 7h30, diariamente)
→ **Executar Imediatamente** → atalho **Sincronizar Saúde**.

O iOS só libera os dados do Saúde com o iPhone **desbloqueado**: se a
automação disparar com ele bloqueado, a pesagem entra na próxima execução.
