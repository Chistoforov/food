import { loadCookies, saveCookies, logProbe, updateSessionStatus } from './db.js';
import { PdClient, parseOrderNumbersFromListing } from './pd-client.js';

export async function runProbe(familyId: number): Promise<void> {
  const started = Date.now();
  const cookies = await loadCookies(familyId);
  if (!cookies || cookies.length === 0) {
    await logProbe({
      family_id: familyId,
      http_status: null,
      is_logged_in: false,
      orders_count: null,
      response_time_ms: null,
      error: 'No cookies in pd_session',
    });
    return;
  }

  const client = new PdClient(cookies);

  try {
    const res = await client.getOrders();
    const elapsed = Date.now() - started;
    const loggedIn = !client.isSessionExpired(res);
    const orders = loggedIn ? parseOrderNumbersFromListing(res.html) : [];

    await logProbe({
      family_id: familyId,
      http_status: res.status,
      is_logged_in: loggedIn,
      orders_count: loggedIn ? orders.length : null,
      response_time_ms: elapsed,
      error: null,
    });

    if (loggedIn) {
      // Cookies могли обновиться (AWSALB/RT ротируются) — сохраняем.
      await saveCookies(familyId, client.getCookies(), 'ok');
    } else {
      await updateSessionStatus(familyId, 'expired');
    }
  } catch (err) {
    const elapsed = Date.now() - started;
    await logProbe({
      family_id: familyId,
      http_status: null,
      is_logged_in: null,
      orders_count: null,
      response_time_ms: elapsed,
      error: err instanceof Error ? err.message : String(err),
    });
    await updateSessionStatus(familyId, 'error');
  }
}
