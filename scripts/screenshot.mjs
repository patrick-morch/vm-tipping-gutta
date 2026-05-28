import { chromium } from "playwright";
import { mkdir } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const BASE = "http://localhost:3000";
const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "screenshots");
await mkdir(outDir, { recursive: true });

const TEMA = process.env.TEMA || "mørk";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: "nb-NO",
  timezoneId: "Europe/Oslo",
});
const page = await ctx.newPage();

const uid = "demo-screenshot";
const bruker = {
  uid,
  epost: "demo@kub.no",
  navn: "Demo Bruker",
  avdeling: "Senior",
  rolle: "admin",
  poeng: 0,
  opprettet: Date.now(),
};

// Sett localStorage FØR siden laster, hver gang
await ctx.addInitScript(
  ({ uid, bruker, tema }) => {
    localStorage.setItem("vmt.brukere", JSON.stringify({ [uid]: bruker }));
    localStorage.setItem("vmt.passord", JSON.stringify({ [uid]: "demo" }));
    localStorage.setItem("vmt.tema", tema);
    if (!localStorage.getItem("vmt.tips")) {
      localStorage.setItem("vmt.tips", "{}");
    }
  },
  { uid, bruker, tema: TEMA },
);

const sider = [
  ["logg-inn", "/logg-inn", false], // logget ut
  ["kamper", "/kamper", true],
  ["sluttspill-grupper", "/sluttspill", true],
  ["sluttspill-knockout", "/sluttspill?fane=knockout", true],
  ["gruppe-I", "/sluttspill/I", true],
  ["spesial", "/spesial", true],
  ["mine-tips", "/mine-tips", true],
  ["ledertavle", "/ledertavle", true],
  ["admin", "/admin", true],
];

for (const [navn, sti, innlogget] of sider) {
  // Sett current bruker før hver navigering
  await ctx.addInitScript((u) => {
    localStorage.setItem("vmt.current", u ? JSON.stringify(u) : "null");
  }, innlogget ? uid : null);

  await page.goto(BASE + sti, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const fil = join(outDir, `${TEMA}-${navn}.png`);
  await page.screenshot({ path: fil, fullPage: true });
  console.log(`✓ ${TEMA}-${navn}.png`);
}

await browser.close();
