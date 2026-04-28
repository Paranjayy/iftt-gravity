import puppeteer from 'puppeteer';

async function test() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  console.log('Navigating to Instagram...');
  await page.goto('https://www.instagram.com/instagram/', { waitUntil: 'networkidle2' });
  
  const content = await page.content();
  const appId = content.match(/\"app_id\":\"(\d+)\"/)?.[1];
  console.log('Found App ID:', appId);
  
  // Try to fetch profile info via the API
  if (appId) {
    const username = 'instagram';
    const apiUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
    const result = await page.evaluate(async (url, id) => {
      try {
        const resp = await fetch(url, {
          headers: {
            'x-ig-app-id': id
          }
        });
        return await resp.json();
      } catch (e) {
        return { error: e.message };
      }
    }, apiUrl, appId);
    
    console.log('API Result:', JSON.stringify(result, null, 2).slice(0, 500));
  }
  
  await browser.close();
}

test();
