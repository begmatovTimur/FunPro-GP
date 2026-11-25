const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1123, height: 794 }, deviceScaleFactor: 3 });
  await p.goto('file://' + require('path').resolve(__dirname, 'certificates.html')); await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: 'FunPro-GP-certificates.pdf', width: '297mm', height: '210mm', printBackground: true, preferCSSPageSize: true });
  const pages = await p.$$('.page');
  for (let i = 0; i < pages.length; i++) await pages[i].screenshot({ path: `P${i + 1}.png`, scale: 'device' });
  await b.close();
})();
