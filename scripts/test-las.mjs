// Verifiserer at låsing fungerer ved å manipulere klokken i nettleseren.
// Krever at dev-serveren kjører på http://localhost:3000

import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const UID = "test-las";

function logg(navn, ok) {
  const ikon = ok ? "✓" : "✗";
  console.log(`  ${ikon} ${navn}`);
  if (!ok) process.exitCode = 1;
}

async function nyttCtx(browser, simulertTid) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "nb-NO",
    timezoneId: "Europe/Oslo",
  });
  await ctx.addInitScript(
    ({ uid, tid }) => {
      // Mock Date.now() til en spesifikk tid
      const opprinneligDate = Date;
      const overstyrt = new opprinneligDate(tid).getTime();
      const diff = overstyrt - opprinneligDate.now();
      // eslint-disable-next-line no-global-assign
      Date = class extends opprinneligDate {
        constructor(...args) {
          if (args.length === 0) super(opprinneligDate.now() + diff);
          else super(...args);
        }
        static now() {
          return opprinneligDate.now() + diff;
        }
      };

      localStorage.setItem(
        "vmt.brukere",
        JSON.stringify({
          [uid]: {
            uid,
            epost: "x@y.no",
            navn: "Test",
            avdeling: "",
            rolle: "admin",
            poeng: 0,
            opprettet: 0,
          },
        }),
      );
      localStorage.setItem("vmt.current", JSON.stringify(uid));
      localStorage.setItem("vmt.tema", "mørk");
      localStorage.setItem("vmt.tips", "{}");
      localStorage.setItem("vmt.spesialtips", "{}");
    },
    { uid: UID, tid: simulertTid },
  );
  return ctx;
}

const browser = await chromium.launch();

// VM-tider:
// - Første kamp (Sør-Afrika vs Mexico): 2026-06-11T15:00:00-04:00 = 2026-06-11T21:00 norsk
// - Spesial lås: 1t før første kamp = 2026-06-11T20:00 norsk
// - Norge-Irak: 2026-06-16T18:00:00-04:00 = 2026-06-17T00:00 norsk
// - Norge-Irak lås (1t før): 2026-06-16T23:00 norsk

// SCENARIO 1: Lenge før VM (1. juni)
console.log("\n1) Lenge før VM (1. juni 2026 12:00):");
{
  const ctx = await nyttCtx(browser, "2026-06-01T12:00:00+02:00");
  const page = await ctx.newPage();

  await page.goto(`${BASE}/sluttspill/I`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const inputsAaben = await page.locator("input[type=number]").all();
  const forste = inputsAaben[2]; // Norge-Irak hjem
  logg(
    "Norge-Irak input er IKKE disabled",
    !(await forste.isDisabled()),
  );

  await page.goto(`${BASE}/spesial`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const select1 = await page.locator("fieldset select").first();
  logg(
    "Spesial-input er IKKE disabled",
    !(await select1.isDisabled()),
  );
  const harBanner = await page.locator("text=Tipsene dine er låst").count();
  logg("Ingen 'låst'-banner vist", harBanner === 0);

  await page.goto(`${BASE}/kamper`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const synligeKamper = await page.locator(".bg-surface.border").count();
  logg(`Kamper-feed viser kamper (fant ${synligeKamper})`, synligeKamper >= 5);

  await ctx.close();
}

// SCENARIO 2: Mellom spesial-lås og første kamp (11. juni 20:30 norsk = 30min etter spesial-lås, 30min før første kamp)
console.log(
  "\n2) Spesial er låst, kamper er åpne (11. juni 20:30 norsk):",
);
{
  const ctx = await nyttCtx(browser, "2026-06-11T20:30:00+02:00");
  const page = await ctx.newPage();

  await page.goto(`${BASE}/spesial`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const select1 = await page.locator("fieldset select").first();
  logg("Spesial-input ER disabled", await select1.isDisabled());
  const banner = await page.locator("text=Tipsene dine er låst").count();
  logg("Låst-banner er vist", banner > 0);

  // Forsøk å skrive nytt valg — skal ikke lagres
  const førSkriv = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("vmt.spesialtips") || "{}"),
  );
  await select1
    .selectOption("Norge")
    .catch(() => {}); // skal feile fordi select er disabled
  await page.waitForTimeout(900);
  const etterSkriv = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("vmt.spesialtips") || "{}"),
  );
  logg(
    "Spesialtips ble IKKE lagret etter lås",
    JSON.stringify(førSkriv) === JSON.stringify(etterSkriv),
  );

  // Norge-Irak (17. juni) skal fortsatt være åpen
  await page.goto(`${BASE}/sluttspill/I`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const inputs = await page.locator("input[type=number]").all();
  logg(
    "Norge-Irak fortsatt åpen 5 dager før",
    !(await inputs[2].isDisabled()),
  );

  await ctx.close();
}

// SCENARIO 3: 30min før Norge-Irak (16. juni 23:30 norsk)
// Lås for kampen er 16. juni 23:00. Så 23:30 er ETTER lås.
console.log(
  "\n3) Norge-Irak låst, Norge-Senegal fortsatt åpen (16. juni 23:30 norsk):",
);
{
  const ctx = await nyttCtx(browser, "2026-06-16T23:30:00+02:00");
  const page = await ctx.newPage();

  await page.goto(`${BASE}/sluttspill/I`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const inputs = await page.locator("input[type=number]").all();
  // Norge-Irak er kamp nr 2 i gruppen (id I2). Sortert etter tid.
  // Hjem = index 2, bort = index 3 (annen kamp som har 4 inputs ovenfor)
  // Faktisk vi har 6 kamper × 2 inputs = 12 inputs.
  // Senegal-Frankrike (16.06 21:00 norsk) er først, Norge-Irak (17.06 00:00) er andre
  // Begge er innenfor 1t? Senegal-Frankrike er 21:00. Klokka er 23:30. Den er ALLEREDE i gang.
  // Norge-Irak er 00:00. 30 min frem. Skal være låst.
  // Inputs[0,1] = Senegal-Frankrike (i gang/låst)
  // Inputs[2,3] = Norge-Irak (låst, 30 min frem)
  // Inputs[4,5] = Irak-Frankrike (22. juni, åpen)
  // etc
  const norgeIrakHjem = inputs[2];
  logg(
    "Norge-Irak er låst (input disabled)",
    await norgeIrakHjem.isDisabled(),
  );
  const irakFrankrikeHjem = inputs[4];
  logg(
    "Irak-Frankrike (22. juni) er ÅPEN",
    !(await irakFrankrikeHjem.isDisabled()),
  );

  // Kamper-side skal ikke vise Norge-Irak
  await page.goto(`${BASE}/kamper`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const harNorgeIrak = await page
    .locator("text=Norge")
    .filter({ hasText: "Irak" })
    .count();
  logg(
    "Kamper-feed viser IKKE Norge-Irak (er låst)",
    harNorgeIrak === 0,
  );

  await ctx.close();
}

// SCENARIO 4: Auto-save respekterer lås (gruppe-detalj med låst kamp)
console.log("\n4) Auto-save hopper over låste kamper:");
{
  const ctx = await nyttCtx(browser, "2026-06-16T23:30:00+02:00");
  const page = await ctx.newPage();
  await page.goto(`${BASE}/sluttspill/I`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  const inputs = await page.locator("input[type=number]").all();
  // Disabled input skal ikke ta imot fill. Prøv likevel via JS dispatch:
  const før = await page.evaluate(() =>
    Object.keys(JSON.parse(localStorage.getItem("vmt.tips") || "{}")).length,
  );
  // Sjekk at disabled-attributtet hindrer typing
  const disabledFungerer = await inputs[2].isDisabled();
  logg("Input er disabled (hindrer typing)", disabledFungerer);

  // Tip på Irak-Frankrike (åpen kamp, index 4-5)
  await inputs[4].fill("2");
  await inputs[5].fill("1");
  await page.waitForTimeout(900);
  const etter = await page.evaluate(() =>
    Object.keys(JSON.parse(localStorage.getItem("vmt.tips") || "{}")),
  );
  logg(
    "Åpen kamp ble lagret (I3)",
    etter.length === 1 && etter[0].endsWith("_I3"),
  );

  await ctx.close();
}

await browser.close();
console.log(
  process.exitCode ? "\n✗ NOEN TESTER FEILET" : "\n✓ Alle tester ok",
);
