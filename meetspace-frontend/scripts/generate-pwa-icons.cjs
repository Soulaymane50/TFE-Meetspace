const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("@playwright/test");

async function main() {
  const publicDirectory = path.resolve(__dirname, "..", "public");
  const source = path.join(publicDirectory, "meetspace.svg");
  const browser = await chromium.launch({ headless: true });

  try {
    for (const size of [192, 512]) {
      const page = await browser.newPage({ viewport: { width: size, height: size } });
      await page.goto(pathToFileURL(source).href);
      await page.evaluate(() => {
        const svg = document.documentElement;
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        svg.style.display = "block";
        svg.style.width = "100vw";
        svg.style.height = "100vh";
      });
      await page.screenshot({
        path: path.join(publicDirectory, "meetspace-" + size + ".png"),
        omitBackground: true
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
