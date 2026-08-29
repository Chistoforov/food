// Общие хелперы для скраппера рецептов Pingo Doce.
// Не роутится Vercel'ом благодаря префиксу `_`.

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

export const SITEMAP_URLS = [
  'https://www.pingodoce.pt/recipe-sitemap.xml',
  'https://www.pingodoce.pt/recipe-sitemap2.xml',
  'https://www.pingodoce.pt/recipe-sitemap3.xml',
  'https://www.pingodoce.pt/recipe-sitemap4.xml',
  'https://www.pingodoce.pt/recipe-sitemap5.xml',
];

export const DETAIL_RATE_MS = 200;

export async function pdFetch(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
    },
  });
  return { status: res.status, body: await res.text() };
}

export function parseSitemap(xml) {
  const entries = [];
  const re = /<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g;
  let m;
  while ((m = re.exec(xml))) {
    const url = m[1].trim();
    const lastmod = m[2] ? m[2].trim() : null;
    const slugMatch = url.match(/\/receitas\/([^/?#]+)\/?$/);
    if (!slugMatch) continue;
    entries.push({ url, lastmod, external_id: slugMatch[1] });
  }
  return entries;
}

export async function ingestSitemaps(supabase) {
  const all = [];
  const shards = [];
  for (const smUrl of SITEMAP_URLS) {
    const { status, body } = await pdFetch(smUrl);
    if (status !== 200) throw new Error(`sitemap ${smUrl}: HTTP ${status}`);
    const entries = parseSitemap(body);
    shards.push({ url: smUrl, count: entries.length });
    all.push(...entries);
  }
  const seen = new Set();
  const uniq = [];
  for (const e of all) {
    if (seen.has(e.external_id)) continue;
    seen.add(e.external_id);
    uniq.push(e);
  }
  let upserted = 0;
  for (let i = 0; i < uniq.length; i += 500) {
    const chunk = uniq.slice(i, i + 500).map((e) => ({
      external_id: e.external_id,
      url: e.url,
      name_pt: e.external_id.replace(/-/g, ' '),
      sitemap_lastmod: e.lastmod,
    }));
    const { error } = await supabase.from('recipes').upsert(chunk, {
      onConflict: 'external_id',
      ignoreDuplicates: false,
    });
    if (error) throw error;
    upserted += chunk.length;
  }
  return { shards, total: uniq.length, upserted };
}

export function findRecipeJsonLd(html) {
  const re = /<script[^>]+type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    let obj;
    try { obj = JSON.parse(m[1]); } catch { continue; }
    const items = obj['@graph'] || [obj];
    for (const it of items) {
      if (!it || typeof it !== 'object') continue;
      const t = it['@type'];
      if (t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))) return it;
    }
  }
  return null;
}

const SIMPLE_UNITS = new Set([
  'g', 'kg', 'mg', 'ml', 'l', 'cl', 'dl',
  'unid.', 'unid', 'unids.', 'unids',
  'dente', 'dentes', 'emb.', 'emb', 'embs.', 'embs',
  'q.b.', 'q.b', 'qb',
  'copo', 'copos', 'ramo', 'ramos', 'folha', 'folhas',
  'lata', 'latas', 'pacote', 'pacotes', 'porção', 'porções',
  'chávena', 'chávenas', 'xícara', 'xícaras', 'pitada', 'pitadas',
  'fatia', 'fatias', 'pau', 'paus', 'saqueta', 'saquetas',
]);
const COMPOUND_UNITS = [
  'c. de sopa', 'c. de chá',
  'colher de sopa', 'colher de chá',
  'colheres de sopa', 'colheres de chá',
];
const FRACTION_CHARS = '½¼¾⅓⅔⅛⅜⅝⅞';

export function parseIngredient(raw) {
  const s = (raw || '').trim();
  if (!s) return { quantity_text: null, name_pt: s };
  const numRe = new RegExp(`^(\\d+(?:[.,]\\d+)?|[${FRACTION_CHARS}])\\s*`);
  const numMatch = s.match(numRe);
  if (!numMatch) return { quantity_text: null, name_pt: s };
  const numToken = numMatch[1];
  const rest = s.slice(numMatch[0].length);
  const restLc = rest.toLowerCase();
  for (const cu of COMPOUND_UNITS) {
    if (restLc.startsWith(cu + ' ') || restLc === cu) {
      const name = rest.slice(cu.length).trim();
      return {
        quantity_text: `${numToken} ${rest.slice(0, cu.length)}`.trim(),
        name_pt: name || rest,
      };
    }
  }
  const firstSpace = rest.indexOf(' ');
  if (firstSpace < 0) return { quantity_text: numToken, name_pt: rest };
  const unitTok = rest.slice(0, firstSpace);
  if (SIMPLE_UNITS.has(unitTok.toLowerCase())) {
    return {
      quantity_text: `${numToken} ${unitTok}`,
      name_pt: rest.slice(firstSpace + 1).trim(),
    };
  }
  return { quantity_text: numToken, name_pt: rest };
}

// JSON-LD recipeInstructions бывает трёх форматов:
//   1) string (единый блок текста)
//   2) [HowToStep{ text }, ...]
//   3) [HowToSection{ itemListElement: [HowToStep, ...] }, ...]
export function parseInstructions(raw) {
  if (!raw) return [];
  if (typeof raw === 'string') {
    return raw
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (!item) continue;
    if (typeof item === 'string') {
      const s = item.trim();
      if (s) out.push(s);
      continue;
    }
    if (typeof item !== 'object') continue;
    const type = item['@type'];
    const isSection =
      type === 'HowToSection' || (Array.isArray(type) && type.includes('HowToSection'));
    if (isSection && Array.isArray(item.itemListElement)) {
      for (const step of item.itemListElement) {
        const text = step && typeof step === 'object' ? step.text : step;
        if (typeof text === 'string' && text.trim()) out.push(text.trim());
      }
      continue;
    }
    const text = item.text;
    if (typeof text === 'string' && text.trim()) out.push(text.trim());
  }
  return out;
}

// Скрапит одну детальную страницу, обновляет recipes + переписывает recipe_ingredients.
export async function scrapeOne(supabase, row) {
  const { id, url } = row;
  const { status, body } = await pdFetch(url);
  if (status !== 200) throw new Error(`HTTP ${status}`);
  const recipe = findRecipeJsonLd(body);
  if (!recipe) throw new Error('no JSON-LD Recipe');
  const name = String(recipe.name || '').trim();
  const category = recipe.recipeCategory ? String(recipe.recipeCategory).trim() : null;
  let imageUrl = null;
  const img = recipe.image;
  if (Array.isArray(img) && img.length) imageUrl = String(img[0]);
  else if (typeof img === 'string') imageUrl = img;
  else if (img && typeof img === 'object' && img.url) imageUrl = String(img.url);
  const rawIngredients = Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : [];
  const instructions = parseInstructions(recipe.recipeInstructions).map((s) => s.slice(0, 2000));
  if (!name || rawIngredients.length === 0) {
    throw new Error(`empty payload name=${!!name} ingredients=${rawIngredients.length}`);
  }
  const ingredientRows = rawIngredients
    .map((raw, i) => {
      const p = parseIngredient(String(raw));
      if (!p.name_pt) return null;
      return {
        recipe_id: id,
        position: i,
        raw_text: String(raw).trim().slice(0, 500),
        name_pt: p.name_pt.slice(0, 300),
        quantity_text: p.quantity_text ? p.quantity_text.slice(0, 100) : null,
      };
    })
    .filter(Boolean);
  const { error: delErr } = await supabase.from('recipe_ingredients').delete().eq('recipe_id', id);
  if (delErr) throw delErr;
  if (ingredientRows.length > 0) {
    const { error: insErr } = await supabase.from('recipe_ingredients').insert(ingredientRows);
    if (insErr) throw insErr;
  }
  const { error: updErr } = await supabase
    .from('recipes')
    .update({
      name_pt: name.slice(0, 500),
      image_url: imageUrl,
      category: category ? category.slice(0, 200) : null,
      instructions_pt: instructions.length > 0 ? instructions : null,
      scraped_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (updErr) throw updErr;
  return { ingredients: ingredientRows.length, instructions: instructions.length };
}

// Проходит массив recipes воркер-пулом; уважает soft deadline и глобальный limit.
export async function scrapeMany(supabase, work, { limit, concurrency, deadline }) {
  const stats = { scraped: 0, failed: 0, first_failures: [] };
  let idx = 0;
  async function worker() {
    while (idx < work.length && Date.now() < deadline && stats.scraped < limit) {
      const row = work[idx++];
      try {
        await scrapeOne(supabase, row);
        stats.scraped++;
      } catch (err) {
        stats.failed++;
        if (stats.first_failures.length < 10) {
          stats.first_failures.push({ url: row.url, error: (err.message || String(err)).slice(0, 200) });
        }
      }
      await new Promise((r) => setTimeout(r, DETAIL_RATE_MS));
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return stats;
}
