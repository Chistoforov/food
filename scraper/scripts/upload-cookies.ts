/**
 * One-shot: залить cookies PD в pd_session после ручного логина.
 *
 * Использование:
 *   1) Убедиться, что CDP-сервер работает и в Chrome-профиле есть залогиненная
 *      сессия pingodoce.pt.
 *   2) Экспортировать cookies через CDP:
 *        curl -s localhost:2229/s/pd -d '{"method":"Network.getCookies","params":{"urls":["https://www.pingodoce.pt"]}}' \
 *          > /tmp/pd_cookies_raw.json
 *   3) Установить env:
 *        SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PD_COOKIE_ENCRYPTION_KEY, PD_FAMILY_ID
 *   4) Запустить:
 *        npm run scraper:upload-cookies -- /tmp/pd_cookies_raw.json
 */
import { readFileSync } from 'node:fs';
import { filterPdCookies, type PdCookie } from '../src/cookies.js';
import { saveCookies } from '../src/db.js';

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: tsx scraper/scripts/upload-cookies.ts <cdp-response.json>');
    process.exit(1);
  }
  const familyId = Number(process.env.PD_FAMILY_ID ?? '1');
  const raw = JSON.parse(readFileSync(path, 'utf8')) as { cookies?: PdCookie[] };
  const cookies = filterPdCookies(raw.cookies ?? []);
  if (cookies.length === 0) {
    console.error('No pingodoce.pt cookies found in input');
    process.exit(1);
  }
  await saveCookies(familyId, cookies, 'ok');
  console.log(`Saved ${cookies.length} cookies to pd_session (family_id=${familyId}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
