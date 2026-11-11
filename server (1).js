import express from "express";
import crypto from "crypto";
import fs from "fs";

const env = process.env;
const app = express();
app.use(express.json());

// ---------- armazenamento simples (tokens + vendas já avisadas) ----------
const STORE = "./store.json";
let db = {};
try { db = JSON.parse(fs.readFileSync(STORE)); } catch {}
db.seen ??= {};
db.ml ??= { refresh: env.ML_REFRESH_TOKEN };
db.shopee ??= { refresh: env.SHOPEE_REFRESH_TOKEN };
const save = () => fs.writeFileSync(STORE, JSON.stringify(db));
const isNew = (key) => (db.seen[key] ? false : ((db.seen[key] = 1), save(), true));

// ---------- notificação no Telegram ----------
async function notify(loja, produtos) {
  const text = `🛒 Você vendeu!\n${produtos.map((p) => `• ${p}`).join("\n")}\n(${loja})`;
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
  });
  console.log("Notificado:", loja, produtos);
}

// ---------- MERCADO LIVRE (webhook) ----------
async function mlToken() {
  const r = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: env.ML_CLIENT_ID,
      client_secret: env.ML_CLIENT_SECRET,
      refresh_token: db.ml.refresh,
    }),
  });
  const j = await r.json();
  db.ml.refresh = j.refresh_token; // o ML troca o refresh token a cada uso
  save();
  return j.access_token;
}

app.post("/webhook/mercadolivre", (req, res) => {
  res.sendStatus(200); // responder rápido é obrigatório
  handleML(req.body).catch(console.error);
});

async function handleML({ topic, resource }) {
  if (topic !== "orders_v2" || !isNew("ml" + resource)) return;
  const token = await mlToken();
  const r = await fetch("https://api.mercadolibre.com" + resource, {
    headers: { Authorization: "Bearer " + token },
  });
  const order = await r.json();
  await notify("Mercado Livre", order.order_items.map((i) => i.item.title));
}

// ---------- SHOPEE (webhook) ----------
const SP = "https://partner.shopeemobile.com";
const spSign = (path, ts, token = "", shop = "") =>
  crypto
    .createHmac("sha256", env.SHOPEE_PARTNER_KEY)
    .update(`${env.SHOPEE_PARTNER_ID}${path}${ts}${token}${shop}`)
    .digest("hex");

async function shopeeToken() {
  const path = "/api/v2/auth/access_token/get";
  const ts = Math.floor(Date.now() / 1000);
  const r = await fetch(
    `${SP}${path}?partner_id=${env.SHOPEE_PARTNER_ID}&timestamp=${ts}&sign=${spSign(path, ts)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        refresh_token: db.shopee.refresh,
        partner_id: Number(env.SHOPEE_PARTNER_ID),
        shop_id: Number(env.SHOPEE_SHOP_ID),
      }),
    }
  );
  const j = await r.json();
  db.shopee.refresh = j.refresh_token;
  save();
  return j.access_token;
}

app.post("/webhook/shopee", (req, res) => {
  res.sendStatus(200);
  handleShopee(req.body).catch(console.error);
});

async function handleShopee({ code, data }) {
  // code 3 = mudança de status do pedido; READY_TO_SHIP = pago, pronto para enviar
  if (code !== 3 || data?.status !== "READY_TO_SHIP" || !isNew("sp" + data.ordersn)) return;
  const token = await shopeeToken();
  const path = "/api/v2/order/get_order_detail";
  const ts = Math.floor(Date.now() / 1000);
  const shop = env.SHOPEE_SHOP_ID;
  const url =
    `${SP}${path}?partner_id=${env.SHOPEE_PARTNER_ID}&timestamp=${ts}&access_token=${token}` +
    `&shop_id=${shop}&sign=${spSign(path, ts, token, shop)}` +
    `&order_sn_list=${data.ordersn}&response_optional_fields=item_list`;
  const j = await (await fetch(url)).json();
  await notify("Shopee", j.response.order_list[0].item_list.map((i) => i.item_name));
}

// ---------- AMAZON (consulta a cada 2 minutos) ----------
async function amazonToken() {
  const r = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: env.AMAZON_REFRESH_TOKEN,
      client_id: env.AMAZON_CLIENT_ID,
      client_secret: env.AMAZON_CLIENT_SECRET,
    }),
  });
  return (await r.json()).access_token;
}

async function pollAmazon() {
  const headers = { "x-amz-access-token": await amazonToken() };
  const base = "https://sellingpartnerapi-na.amazon.com/orders/v0/orders";
  const since = db.amzSince ?? new Date().toISOString();
  const next = new Date(Date.now() - 60_000).toISOString();
  const list = await (
    await fetch(`${base}?MarketplaceIds=A2Q3Y263D00KWC&CreatedAfter=${since}`, { headers })
  ).json();
  for (const o of list.payload?.Orders ?? []) {
    if (!isNew("amz" + o.AmazonOrderId)) continue;
    const items = await (await fetch(`${base}/${o.AmazonOrderId}/orderItems`, { headers })).json();
    await notify("Amazon", items.payload.OrderItems.map((i) => i.Title));
  }
  db.amzSince = next;
  save();
}

if (env.AMAZON_REFRESH_TOKEN) {
  setInterval(() => pollAmazon().catch(console.error), 120_000);
}

app.get("/", (_, res) => res.send("Avisa Venda no ar ✅"));
app.listen(env.PORT || 3000, () => console.log("Rodando"));
