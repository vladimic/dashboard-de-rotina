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

2. **Definir Variável** → nome **Segredo**, entrada *Texto* (ação 1).
   Use sempre **Segredo** nos cabeçalhos: o atalho tem outras ações
   "Texto", e escolher a errada manda o JSON inteiro no cabeçalho
   (erro `REQUEST_HEADER_TOO_LARGE`).

3. **Obter Conteúdo do URL**
   - URL: `https://dashboard-de-rotina.vercel.app/api/health-webhook?type=weight`
   - Método: **GET**
   - Cabeçalhos: `Authorization` = `Bearer ` + variável **Segredo**
     (com um espaço depois de "Bearer").

4. **Obter Valor do Dicionário** → chave `since` em *Conteúdo do URL*.

5. **Obter Datas de** *Valor do Dicionário* (saída: **Datas**).

6. **Encontrar Amostras de Saúde**
   - Filtro: **Tipo** é **Peso**
   - **Adicionar Filtro:** **Data de Início** **está entre** **Datas** e
     **Data Atual** (não existe "depois de")
   - Unidade: **kg**
   - Ordenar por: **Data de Início**, **Mais Antigos Primeiro**
   - Limite: **desligado**

7. **Repetir com Cada** item em *Amostras de Saúde*. Dentro do repetir:
   1. **Formatar Data** → *Item de Repetição* → propriedade
      **Data de Início**. Formato: **ISO 8601**, **Incluir Horário** ligado.
   2. **Texto** (aspas retas, digitadas; `[...]` = variáveis):
      ```
      {"date":"[Data Formatada]","value":"[Valor]","unit":"[Unidade]","source":"[Fonte]"}
      ```
      `Valor`, `Unidade` e `Fonte` são propriedades do *Item de
      Repetição*. Se a etiqueta do valor continuar mostrando "Item de
      Repetição", tudo bem: chega como "86,4 kg" e o servidor extrai o
      número.

8. (depois do Fim da Repetição) **Combinar Texto** → *Resultados da
   Repetição*, separador **Personalizado** = `,`

9. **Texto**:
   ```
   {"type":"weight","samples":[[Texto Combinado]]}
   ```

10. **Obter Conteúdo do URL**
    - URL: `https://dashboard-de-rotina.vercel.app/api/health-webhook`
    - Método: **POST**
    - Cabeçalhos: `Authorization` = `Bearer ` + **Segredo**;
      `Content-Type` = `application/json`
    - Corpo da Solicitação: **Arquivo** → variável *Texto* (da ação 9)

11. (opcional) **Mostrar Notificação** → *Conteúdo do URL* — mostra
    `{"ok":true,"saved":N,...}` para conferir.

Na 1ª execução o iOS pede permissão para o atalho ler o Peso no Saúde —
permita. Com muitos anos de pesagens, a 1ª execução pode levar alguns
minutos: mantenha a tela ligada até terminar.

## Rodando sozinho todo dia

Atalhos → **Automação** → **+** → **Hora do Dia** (ex.: 7h30, diariamente)
→ **Executar Imediatamente** → atalho **Sincronizar Saúde**.

O iOS só libera os dados do Saúde com o iPhone **desbloqueado**: se a
automação disparar com ele bloqueado, a pesagem entra na próxima execução.
