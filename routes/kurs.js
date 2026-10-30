// routes/kurs.js — Dollar kursi
//
// index.js da ulangan:  app.use("/api/kurs", require("./routes/kurs"));
//
// GET /api/kurs          -> keshdan (10 daqiqa) yoki yangidan
// GET /api/kurs?yangi=1  -> keshni chetlab, qaytadan olish
//
// Manbalar (bir vaqtda so'raladi, qaysi biri javob bersa — o'sha ishlatiladi):
//   1. Kapitalbank sayti  — sotib olish / sotish kursi.
//      Eslatma: bank sayti chet eldagi serverlardan (Railway) kelgan so'rovlarni
//      403 bilan bloklashi mumkin. Bank Kapital API (korporativ) manzilini bersa,
//      Railway Variables'ga KAPITALBANK_KURS_URL qilib yozing.
//   2. O'zbekiston Markaziy banki (cbu.uz) — rasmiy kurs.
//   3. ExchangeRate-API (open.er-api.com) — kunlik xalqaro kurs, zaxira uchun.
//
// Javob namunasi:
// {
//   ok: true,
//   kapitalbank: { buy: 12010, sell: 12100 } | null,
//   cb: 12050.37 | null,        cbSana: "30.10.2026" | null,
//   xalqaro: 11983.75 | null,   xalqaroSana: "29.10.2026" | null,
//   manba: "Kapitalbank" | "Markaziy bank" | "Xalqaro kurs",
//   xatolar: { kapitalbank: "HTTP 403", ... },   // diagnostika uchun
//   olingan: "2026-10-30T08:50:00.000Z",
//   eskirgan: false
// }

const express = require('express');
const router = express.Router();

const KAPITAL_URL =
  process.env.KAPITALBANK_KURS_URL || 'https://kapitalbank.uz/uz/services/exchange-rates/';
const CBU_URLS = [
  'https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/',
  'https://cbu.uz/ru/arkhiv-kursov-valyut/json/USD/',
];
const XALQARO_URL = 'https://open.er-api.com/v6/latest/USD';
const CACHE_MS = 10 * 60 * 1000;

let cache = null; // { data, vaqt }

async function fetchText(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'RisolaKvitansiya/1.0 (+https://risolafrontend-production.up.railway.app)',
        Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
        'Accept-Language': 'uz,ru;q=0.8,en;q=0.6',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`${ms / 1000} soniyada javob bermadi`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const toNum = s => parseFloat(String(s).replace(/[\s ]/g, '').replace(',', '.'));
const isPlausible = n => Number.isFinite(n) && n > 5000 && n < 50000;
const NUM_RE = /(?:\d{1,3}(?:[  ]\d{3})+|\d{4,6})(?:[.,]\d{1,2})?/g;
const pad = n => String(n).padStart(2, '0');
const ddmmyyyy = d => `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/\s+/g, ' ');
}

// Kapitalbank: USD sotib olish / sotish. Shubhali bo'lsa null (noto'g'ri son chiqmaydi).
function parseKapitalbank(body) {
  try {
    const j = JSON.parse(body);
    const list = Array.isArray(j) ? j : j.data || j.rates || j.items || [];
    const usd = list.find(r => /USD|840/i.test(String(r.code || r.ccy || r.currency || r.Ccy || '')));
    if (usd) {
      const buy = toNum(usd.buy ?? usd.purchase ?? usd.buyRate ?? usd.sotib_olish);
      const sell = toNum(usd.sell ?? usd.sale ?? usd.sellRate ?? usd.sotish);
      if (isPlausible(buy) && isPlausible(sell) && buy <= sell) return { buy, sell };
    }
  } catch (_) { /* HTML */ }

  const text = htmlToText(body);
  const re = /\bUSD\b|AQSH dollari|АҚШ доллари|Доллар США|US Dollar/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const nums = (text.slice(m.index, m.index + 260).match(NUM_RE) || []).map(toNum).filter(isPlausible);
    for (let i = 0; i + 1 < nums.length; i++) {
      const buy = nums[i], sell = nums[i + 1];
      if (buy <= sell && (sell - buy) / sell <= 0.05) return { buy, sell };
    }
  }
  throw new Error('sahifada USD kursi topilmadi');
}

function parseCbu(body) {
  const arr = JSON.parse(body);
  const usd = Array.isArray(arr) ? arr.find(r => r.Ccy === 'USD') : null;
  const rate = usd ? toNum(usd.Rate) : NaN;
  if (!isPlausible(rate)) throw new Error('USD topilmadi');
  return { rate, sana: usd.Date || null };
}

function parseXalqaro(body) {
  const j = JSON.parse(body);
  const rate = j && j.result === 'success' && j.rates ? Number(j.rates.UZS) : NaN;
  if (!isPlausible(rate)) throw new Error('UZS topilmadi');
  const sana = j.time_last_update_unix ? ddmmyyyy(new Date(j.time_last_update_unix * 1000)) : null;
  return { rate: Math.round(rate * 100) / 100, sana };
}

async function olish() {
  const [kb, cbu, xq] = await Promise.allSettled([
    fetchText(KAPITAL_URL, 8000).then(parseKapitalbank),
    // ikki manzildan qaysi biri birinchi javob bersa
    Promise.any(CBU_URLS.map(u => fetchText(u, 12000).then(parseCbu)))
      .catch(e => { throw (e.errors && e.errors[0]) || e; }),
    fetchText(XALQARO_URL, 10000).then(parseXalqaro),
  ]);

  const val = r => (r.status === 'fulfilled' ? r.value : null);
  const err = r => (r.status === 'rejected' ? (r.reason && r.reason.message) || 'xato' : undefined);

  const kapitalbank = val(kb);
  const cb = val(cbu);
  const xalqaro = val(xq);

  if (!kapitalbank && !cb && !xalqaro) {
    throw new Error(`Kurs olinmadi: Kapitalbank — ${err(kb)}; Markaziy bank — ${err(cbu)}; Xalqaro — ${err(xq)}`);
  }

  return {
    ok: true,
    kapitalbank,
    cb: cb ? cb.rate : null,
    cbSana: cb ? cb.sana : null,
    xalqaro: xalqaro ? xalqaro.rate : null,
    xalqaroSana: xalqaro ? xalqaro.sana : null,
    manba: kapitalbank ? 'Kapitalbank' : cb ? 'Markaziy bank' : 'Xalqaro kurs',
    xatolar: { kapitalbank: err(kb), cb: err(cbu), xalqaro: err(xq) },
    olingan: new Date().toISOString(),
    eskirgan: false,
  };
}

router.get('/', async (req, res) => {
  const majburiy = req.query.yangi === '1';
  if (!majburiy && cache && Date.now() - cache.vaqt < CACHE_MS) {
    return res.json(cache.data);
  }
  try {
    const data = await olish();
    cache = { data, vaqt: Date.now() };
    res.json(data);
  } catch (err) {
    if (cache) return res.json({ ...cache.data, eskirgan: true });
    res.status(503).json({ ok: false, message: err.message });
  }
});

module.exports = router;
module.exports.parseKapitalbank = parseKapitalbank; // test uchun
module.exports.parseCbu = parseCbu;
module.exports.parseXalqaro = parseXalqaro;
