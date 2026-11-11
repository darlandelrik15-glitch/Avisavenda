# Avisa Venda

Manda no seu Telegram: **"🛒 Você vendeu! • Nome do produto (Loja)"**
para Mercado Livre, Shopee e Amazon.

## 1. Telegram (5 minutos)
1. No Telegram, fale com **@BotFather** → `/newbot` → guarde o **token**.
2. Mande qualquer mensagem para o seu bot novo.
3. Abra `https://api.telegram.org/bot<TOKEN>/getUpdates` e copie o número em `"chat":{"id":...}`.

## 2. Hospedar (precisa de endereço HTTPS público)
Suba esta pasta em Render, Railway ou Fly.io (planos baratos/gratuitos servem).
Comando de início: `npm start`. Anote a URL, ex.: `https://avisavenda.onrender.com`.
Coloque as variáveis abaixo no painel do serviço.

## 3. Variáveis

```
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Mercado Livre
ML_CLIENT_ID=
ML_CLIENT_SECRET=
ML_REFRESH_TOKEN=

# Shopee
SHOPEE_PARTNER_ID=
SHOPEE_PARTNER_KEY=
SHOPEE_SHOP_ID=
SHOPEE_REFRESH_TOKEN=

# Amazon
AMAZON_CLIENT_ID=
AMAZON_CLIENT_SECRET=
AMAZON_REFRESH_TOKEN=
```
Pode deixar vazio o que não usar.

## 4. Ligar cada loja
**Mercado Livre** — developers.mercadolivre.com.br → crie um app → em "Notificações" use
`https://SUA-URL/webhook/mercadolivre` e marque o tópico **orders_v2**. Autorize sua conta (OAuth) para obter o refresh token.

**Shopee** — open.shopee.com → crie app → em Push configure
`https://SUA-URL/webhook/shopee` (ative Order Push). Autorize sua loja para obter o refresh token.

**Amazon** — Seller Central → Developer Central → registre-se como desenvolvedor privado
e autorize o app na sua conta vendedora (Brasil). O app consulta pedidos novos a cada 2 minutos.

## Teste
Abra `https://SUA-URL/` — deve aparecer "Avisa Venda no ar ✅".
