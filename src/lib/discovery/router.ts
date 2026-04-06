import axios from 'axios';
import { parse } from 'node-html-parser';

export async function scrapeJioRouterClients(adminPass: string, routerIp = '192.168.29.1') {
  try {
    const baseUrl = `http://${routerIp}`;
    const loginUrl = `${baseUrl}/platform.cgi`;

    // 1. Initial hit to get session cookies
    const sess = await axios.get(baseUrl);
    const cookies = sess.headers['set-cookie']?.map(c => c.split(';')[0]).join('; ');

    // 2. Login (Post credentials)
    const payload = new URLSearchParams({
      'button.login.index': 'Login',
      'thispage': 'index.html',
      'login.username': 'admin',
      'login.password': adminPass,
    });

    const loginRes = await axios.post(loginUrl, payload, {
      headers: {
        'Cookie': cookies || '',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': baseUrl,
      }
    });

    // 3. Fetch LAN Clients page
    const clientRes = await axios.get(`${loginUrl}?page=lanDhcpLeasedClients.html`, {
      headers: { 'Cookie': cookies || '', 'Referer': loginUrl }
    });

    // 4. Parse the table
    const root = parse(clientRes.data);
    const rows = root.querySelectorAll('tr'); // This varies based on router firmware
    const clients: { ip: string; mac: string; name: string }[] = [];

    // Common TeamF1 table format
    rows.forEach(row => {
      const cols = row.querySelectorAll('td');
      if (cols.length >= 3) {
        const ip = cols[1].text.trim();
        const mac = cols[2].text.trim().toUpperCase();
        const name = cols[0].text.trim();
        if (ip.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
          clients.push({ ip, mac, name });
        }
      }
    });

    return clients;
  } catch (err) {
    console.error("Router scraping error:", err);
    throw new Error("Could not log in to router. Check administration password.");
  }
}
