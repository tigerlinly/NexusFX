const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Catch console logs
    page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
    page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
    page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));
    
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
    
    console.log('Page loaded. Checking for #root children...');
    const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML);
    if (!rootHtml) {
      console.log('ROOT IS EMPTY (Black screen)');
    } else {
      console.log('ROOT HAS CONTENT. length:', rootHtml.length);
    }
    
    await browser.close();
  } catch (err) {
    console.error('SCRIPT ERROR:', err);
  }
})();
