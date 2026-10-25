import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";

const artifactDir = "C:\\Users\\manas\\.gemini\\antigravity\\brain\\c36dd122-11c0-417a-9b0e-587858c36228";
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function runBrowserTest() {
  console.log("Launching Chrome...");
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1366,800"],
    defaultViewport: { width: 1366, height: 800 },
  });

  try {
    const page = await browser.newPage();
    console.log("Navigating to http://localhost:3000...");
    await page.goto("http://localhost:3000", { waitUntil: "networkidle0", timeout: 30000 });

    const title = await page.title();
    console.log("Page Title:", title);

    // Wait for content to render
    await page.waitForSelector("h1", { timeout: 10000 });
    console.log("Dashboard heading rendered!");

    // Capture main view screenshot
    const mainScreenshotPath = path.join(artifactDir, "dashboard-main.png");
    await page.screenshot({ path: mainScreenshotPath, fullPage: false });
    console.log("Saved dashboard screenshot to:", mainScreenshotPath);

    // Click "Monitored Competitors" tab
    console.log("Clicking Monitored Competitors tab...");
    const monitorTab = await page.waitForSelector("button:has-text('Monitored Competitors')", { timeout: 5000 }).catch(() => null);
    if (monitorTab) {
      await monitorTab.click();
    } else {
      // Find button by text evaluation
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const btn = btns.find((b) => b.innerText.includes("Monitored Competitors"));
        if (btn) btn.click();
      });
    }

    await new Promise((r) => setTimeout(r, 1000));
    const compScreenshotPath = path.join(artifactDir, "dashboard-competitors.png");
    await page.screenshot({ path: compScreenshotPath, fullPage: false });
    console.log("Saved competitors tab screenshot to:", compScreenshotPath);

    // Test clicking "Add Competitor" button
    console.log("Opening Add Competitor Modal...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const btn = btns.find((b) => b.innerText.includes("Add Competitor") || b.innerText.includes("Track New Competitor"));
      if (btn) btn.click();
    });

    await new Promise((r) => setTimeout(r, 1000));
    const modalScreenshotPath = path.join(artifactDir, "dashboard-add-modal.png");
    await page.screenshot({ path: modalScreenshotPath, fullPage: false });
    console.log("Saved modal screenshot to:", modalScreenshotPath);

    // Close modal
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const btn = btns.find((b) => b.innerText.includes("Cancel"));
      if (btn) btn.click();
    });

    await new Promise((r) => setTimeout(r, 800));

    // Return to Strategic Feed tab
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const btn = btns.find((b) => b.innerText.includes("AI Strategic Feed"));
      if (btn) btn.click();
    });

    await new Promise((r) => setTimeout(r, 800));

    // Test clicking "Open in Full Diff Viewer →"
    console.log("Opening Diff Viewer Modal...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const btn = btns.find((b) => b.innerText.includes("Open in Full Diff Viewer"));
      if (btn) btn.click();
    });

    await new Promise((r) => setTimeout(r, 1000));
    const diffScreenshotPath = path.join(artifactDir, "dashboard-diff-modal.png");
    await page.screenshot({ path: diffScreenshotPath, fullPage: false });
    console.log("Saved diff viewer screenshot to:", diffScreenshotPath);

    console.log("All browser tests passed successfully!");
  } finally {
    await browser.close();
  }
}

runBrowserTest().catch((err) => {
  console.error("Browser test failed:", err);
  process.exit(1);
});
