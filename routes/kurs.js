// routes/kurs.js — Dollar kursi (Kapitalbank + Markaziy bank zaxirasi)
//
// Ulash (server.js / app.js ichida):
//   app.use('/api/kurs', require('./routes/kurs'));
//
// GET /api/kurs        -> keshdan (10 daqiqa) yoki yangidan
// GET /api/kurs?yangi=1 -> keshni chetlab, qaytadan olish
//
// Javob namunasi:
// {
//   ok: true,
//   kapitalbank: { buy: 12010, sell: 12100 } | null,
//   cb: 12050.37 | null,          // O'zbekiston Markaziy banki kursi
//   cbSana: "30.10.2026" | null,
//   manba: "Kapitalbank" | "Markaziy bank",
//   olingan: "2026-10-30T06:20:00.000Z",
//   eskirgan: false               // true = manbalar ochilmadi, oxirgi saqlangan kurs qaytarildi
// }
//
// Node 18+ kerak (global fetch). Railway'da odatda shunday.

const express = require('express');
const router = express.Router();

// Kapitalbank'ning ochiq kurs API'si yo'q, shuning uchun ularning rasmiy
// "Valyutalar kursi" sahifasidan o'qiladi. Agar bank sizga Kapital API
// (korporativ) orqali boshqa manzil bersa, uni Railway'da shu o'zgaruvchiga yozing.
const KAPITAL_URL =
  process.env.KAPITALBANK_KURS_URL || 'https://kapitalbank.uz/uz/services/exchange-rates/';
const CBU_URL = 'https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/';
const CACHE_MS = 10 * 60 * 1000;

let cache = null; // { data, vaqt }

async function fetchText(url, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) RisolaKvitansiya/1.0',
        Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
        'Accept-Language': 'uz,ru;q=0.8,en;q=0.6',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

const toNum = s => parseFloat(String(s).replace(/[\s ]/g, '').replace(',', '.'));
const isPlausible = n => Number.isFinite(n) && n > 5000 && n < 50000;

// "12 010", "12010", "12 010.00", "12010,50" kabi sonlarni topadi
const NUM_RE = /(?:\d{1,3}(?:[  ]\d{3})+|\d{4,6})(?:[.,]\d{1,2})?/g;

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/\s+/g, ' ');
}

// Kapitalbank sahifasidan USD sotib olish / sotish kursini ajratib oladi.
// Ehtiyot choralari: ikkala son ham 5 000–50 000 oralig'ida bo'lishi,
// sotib olish <= sotish va farq 5% dan oshmasligi shart. Aks holda null
// qaytariladi va Markaziy bank kursi ishlatiladi (noto'g'ri son chiqmaydi).
function parseKapitalbank(body) {
  // 1) Agar manzil JSON qaytarsa (masalan, Kapital API)
  try {
    const j = JSON.parse(body);
    const list = Array.isArray(j) ? j : j.data || j.rates || j.items || [];
    const usd = list.find(r => /USD|840/i.test(String(r.code || r.ccy || r.currency || r.Ccy || '')));
    if (usd) {
      const buy = toNum(usd.buy ?? usd.purchase ?? usd.buyRate ?? usd.sotib_olish);
      const sell = toNum(usd.sell ?? usd.sale ?? usd.sellRate ?? usd.sotish);
      if (isPlausible(buy) && isPlausible(sell) && buy <= sell) return { buy, sell };
    }
  } catch (_) { /* HTML — davom etamiz */ }

  // 2) HTML sahifa: "USD" yozuvidan keyingi birinchi ikki mos son
  const text = htmlToText(body);
  const re = /\bUSD\b|AQSH dollari|АҚШ доллари|Доллар США|US Dollar/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const chunk = text.slice(m.index, m.index + 260);
    const nums = (chunk.match(NUM_RE) || []).map(toNum).filter(isPlausible);
    // Yonma-yon turgan birinchi mos juftlik (oldida MB kursi bo'lsa ham topadi)
    for (let i = 0; i + 1 < nums.length; i++) {
      const buy = nums[i], sell = nums[i + 1];
      if (buy <= sell && (sell - buy) / sell <= 0.05) return { buy, sell };
    }
  }
  return null;
}

function parseCbu(body) {
  const arr = JSON.parse(body);
  const usd = Array.isArray(arr) ? arr.find(r => r.Ccy === 'USD') : null;
  if (!usd) return null;
  const rate = toNum(usd.Rate);
  return isPlausible(rate) ? { rate, sana: usd.Date || null } : null;
}

async function olish() {
  const [kb, cbu] = await Promise.allSettled([
    fetchText(KAPITAL_URL).then(parseKapitalbank),
    fetchText(CBU_URL).then(parseCbu),
  ]);

  const kapitalbank = kb.status === 'fulfilled' ? kb.value : null;
  const cb = cbu.status === 'fulfilled' ? cbu.value : null;

  if (!kapitalbank && !cb) {
    const sabab = [kb, cbu].map(r => (r.status === 'rejected' ? r.reason?.message : 'topilmadi')).join(' / ');
    throw new Error(`Kurs olinmadi: ${sabab}`);
  }

  return {
    ok: true,
    kapitalbank,
    cb: cb ? cb.rate : null,
    cbSana: cb ? cb.sana : null,
    manba: kapitalbank ? 'Kapitalbank' : 'Markaziy bank',
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
