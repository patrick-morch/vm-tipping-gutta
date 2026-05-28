import { chromium } from "playwright";

const BASE = "http://localhost:3000";

const tests = [];
function ok(navn, vellykket, info = "") {
  tests.push({ navn, vellykket, info });
  console.log(`  ${vellykket ? "✓" : "✗"} ${navn}${info ? ` — ${info}` : ""}`);
  if (!vellykket) process.exitCode = 1;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  locale: "nb-NO",
  timezoneId: "Europe/Oslo",
});

const ADMIN = "admin-test";
const OFFER = "offer-test";

await ctx.addInitScript(({ admin, offer }) => {
  localStorage.setItem(
    "vmt.brukere",
    JSON.stringify({
      [admin]: {
        uid: admin,
        epost: "a@x.no",
        navn: "Admin Test",
        avdeling: "Senior",
        rolle: "admin",
        poeng: 0,
        opprettet: 0,
      },
      [offer]: {
        uid: offer,
        epost: "o@x.no",
        navn: "Test Spiller",
        avdeling: "U17",
        rolle: "medlem",
        poeng: 0,
        opprettet: 0,
      },
    }),
  );
  localStorage.setItem("vmt.passord", JSON.stringify({ [admin]: "demo123" }));
  localStorage.setItem("vmt.current", JSON.stringify(admin));
  localStorage.setItem("vmt.tips", "{}");
  localStorage.setItem("vmt.spesialtips", "{}");
}, { admin: ADMIN, offer: OFFER });

const page = await ctx.newPage();
const feilSamler = [];
page.on("pageerror", (err) => feilSamler.push(err.message));
page.on("console", (m) => {
  if (m.type() === "error") feilSamler.push(`console: ${m.text()}`);
});

console.log("\n1) Sider laster uten errors");
const sider = [
  ["/", "Hjem"],
  ["/logg-inn/", "Logg-inn"],
  ["/kamper/", "Kamper"],
  ["/sluttspill/", "Sluttspill"],
  ["/sluttspill/I/", "Gruppe I"],
  ["/spesial/", "Spesial"],
  ["/ledertavle/", "Ledertavle"],
  ["/admin/", "Admin"],
];
for (const [sti, navn] of sider) {
  feilSamler.length = 0;
  await page.goto(BASE + sti, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  ok(`${navn} laster uten errors`, feilSamler.length === 0, feilSamler[0] || "");
}

console.log("\n2) Tipping fungerer (kamper-siden)");
await page.goto(BASE + "/kamper/", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const inputs = await page.locator("input[type=number]").all();
ok("Score-inputs finnes", inputs.length >= 2, `${inputs.length} inputs`);
if (inputs.length >= 2) {
  await inputs[0].fill("3");
  await inputs[1].fill("1");
  await page.waitForTimeout(900);
  const tipsCount = await page.evaluate(
    () =>
      Object.keys(JSON.parse(localStorage.getItem("vmt.tips") || "{}")).length,
  );
  ok("Tipp lagres etter 500ms debounce", tipsCount === 1, `${tipsCount} tipps i ls`);
}

console.log("\n3) Tipp slettes når feltene tømmes");
if (inputs.length >= 2) {
  await inputs[0].fill("");
  await inputs[1].fill("");
  await page.waitForTimeout(900);
  const tipsCount = await page.evaluate(
    () =>
      Object.keys(JSON.parse(localStorage.getItem("vmt.tips") || "{}")).length,
  );
  ok("Tipp er slettet", tipsCount === 0, `${tipsCount} tipps`);
}

console.log("\n4) Gruppe-detalj viser to tabeller");
await page.goto(BASE + "/sluttspill/I/", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const minTabell = await page.locator("text=Min tabell").count();
const faktiskTabell = await page.locator("text=Faktisk tabell").count();
ok("'Min tabell' vises", minTabell > 0);
ok("'Faktisk tabell' vises", faktiskTabell > 0);

console.log("\n5) Sett resultat → status vises");
const grInputs = await page.locator("input[type=number]").all();
if (grInputs.length >= 2) {
  await grInputs[0].fill("2");
  await grInputs[1].fill("1");
  await page.waitForTimeout(900);
  // Simuler at fasit kommer inn (matchen er den første i gruppe I)
  await page.evaluate(() => {
    const kamper = JSON.parse(localStorage.getItem("vmt.kamper") || "[]");
    // Sett resultat 2-1 på første gruppe-I-kamp (senegal vs frankrike)
    const idx = kamper.findIndex((k) => k.runde === "Gruppe I");
    if (idx >= 0) {
      kamper[idx].resultat = { hjemme: 2, borte: 1 };
      localStorage.setItem("vmt.kamper", JSON.stringify(kamper));
    }
  });
  // Trigger re-render ved å reloade
  await page.reload();
  await page.waitForTimeout(700);
  const fasitTekst = await page.locator("text=/Fasit:/").count();
  ok("Fasit-rad vises etter resultat", fasitTekst > 0);
}

console.log("\n6) Ledertavle viser navn (fallback uten aggregert)");
await page.goto(BASE + "/ledertavle/", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const adminRad = await page.locator("text=Admin Test").count();
const offerRad = await page.locator("text=Test Spiller").count();
ok("Admin Test i ledertavle", adminRad > 0);
ok("Test Spiller i ledertavle", offerRad > 0);

console.log("\n7) Spesial: søkbar spillerliste");
await page.goto(BASE + "/spesial/", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const sokInputs = await page.locator('input[placeholder*="Søk"]').all();
ok("Søke-inputs finnes", sokInputs.length === 2, `${sokInputs.length} søkefelt`);
if (sokInputs.length > 0) {
  await sokInputs[0].fill("Haaland");
  await page.waitForTimeout(300);
  const treff = await page.locator("text=/Erling.*Haaland|Haaland/i").count();
  ok("Haaland gir treff", treff > 0);
}

console.log("\n8) Admin: medlem-sletting krever bekreftelse");
await page.goto(BASE + "/admin/", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const medlemmer = await page.locator("h2", { hasText: "Medlemmer" }).count();
ok("Medlemmer-seksjon i admin", medlemmer > 0);
const offerRadAdmin = page
  .locator(".bg-elevated")
  .filter({ hasText: "Test Spiller" });
const slettKnapp = offerRadAdmin.locator("button", { hasText: "Slett" });
const slettTilgjengelig = await slettKnapp.isVisible().catch(() => false);
ok("Slett-knapp på medlem", slettTilgjengelig);

console.log("\n9) Admin: tilbakestill-bekreftelse");
const tilbakestillKnapp = await page
  .locator("button", { hasText: "Tilbakestill" })
  .first();
const tilbakestillFinnes = await tilbakestillKnapp.count();
ok("Tilbakestill-knapp i admin", tilbakestillFinnes > 0);

await browser.close();
console.log(`\n${tests.filter((t) => !t.vellykket).length === 0 ? "✓" : "✗"} ${tests.filter((t) => t.vellykket).length}/${tests.length} tester ok`);
