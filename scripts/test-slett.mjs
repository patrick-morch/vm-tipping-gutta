import { chromium } from "playwright";

function logg(navn, ok) {
  console.log(`  ${ok ? "✓" : "✗"} ${navn}`);
  if (!ok) process.exitCode = 1;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  locale: "nb-NO",
});
await ctx.addInitScript(() => {
  localStorage.setItem(
    "vmt.brukere",
    JSON.stringify({
      admin: {
        uid: "admin",
        epost: "a@x.no",
        navn: "Admin Bruker",
        avdeling: "Senior",
        rolle: "admin",
        poeng: 0,
        opprettet: 0,
      },
      offer: {
        uid: "offer",
        epost: "o@x.no",
        navn: "Test Offer",
        avdeling: "U17",
        rolle: "medlem",
        poeng: 0,
        opprettet: 0,
      },
    }),
  );
  localStorage.setItem("vmt.current", JSON.stringify("admin"));
  localStorage.setItem(
    "vmt.tips",
    JSON.stringify({
      offer_I1: {
        matchId: "I1",
        uid: "offer",
        navn: "Test Offer",
        hjemme: 2,
        borte: 1,
        lagretTid: 0,
      },
    }),
  );
  localStorage.setItem(
    "vmt.spesialtips",
    JSON.stringify({
      offer: {
        uid: "offer",
        vmVinner: "Norge",
        vmFinalist: "",
        toppscorer: "Haaland",
        toppassist: "",
        mestRødeKort: "",
        lagretTid: 0,
      },
    }),
  );
});
const page = await ctx.newPage();
await page.goto("http://localhost:3000/admin/", { waitUntil: "networkidle" });
await page.waitForTimeout(500);

logg(
  "Medlemmer-seksjon vises",
  (await page.locator("h2", { hasText: "Medlemmer" }).count()) > 0,
);

// Admin-rad
const adminRad = page
  .locator(".bg-elevated")
  .filter({ hasText: "Admin Bruker" });
const adminSlettKnapp = adminRad.locator("button", { hasText: "Slett" });
logg(
  "Admin-bruker har disabled slett-knapp",
  await adminSlettKnapp.isDisabled(),
);

// Offer-rad
const offerRad = page
  .locator(".bg-elevated")
  .filter({ hasText: "Test Offer" });
await offerRad.locator("button", { hasText: "Slett" }).click();
await page.waitForTimeout(300);

logg(
  "Bekreftelses-modal vises",
  (await page.locator("text=Slett Test Offer?").count()) > 0,
);

const slettKnapp = page.locator("button", { hasText: "Slett permanent" });
logg("Slett-knapp er disabled før korrekt navn", await slettKnapp.isDisabled());

const input = page.locator('input[placeholder="Test Offer"]');
await input.fill("Feil navn");
await page.waitForTimeout(100);
logg("Disabled etter feil navn", await slettKnapp.isDisabled());

await input.fill("Test Offer");
await page.waitForTimeout(100);
logg("Enabled etter korrekt navn", !(await slettKnapp.isDisabled()));

await slettKnapp.click();
await page.waitForTimeout(800);

const data = await page.evaluate(() => ({
  brukere: Object.keys(JSON.parse(localStorage.getItem("vmt.brukere") || "{}")),
  tips: Object.keys(JSON.parse(localStorage.getItem("vmt.tips") || "{}")),
  spesialtips: Object.keys(
    JSON.parse(localStorage.getItem("vmt.spesialtips") || "{}"),
  ),
}));

logg(
  "Bare admin igjen i brukere",
  data.brukere.length === 1 && data.brukere[0] === "admin",
);
logg("Offer sine tipps slettet", data.tips.length === 0);
logg("Offer sitt spesialtip slettet", data.spesialtips.length === 0);

await browser.close();
console.log(process.exitCode ? "\n✗ NOEN TESTER FEILET" : "\n✓ Alle tester ok");
