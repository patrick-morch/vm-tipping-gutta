// Lager et delbart ledertavle-bilde i nettleseren (canvas) og deler det via
// systemets delingsark (mobil) eller laster det ned. Ingen avhengigheter,
// ingen server, og INGEN emoji — alt tegnes som vektor så det ser likt ut på
// alle enheter (emoji rendres ulikt og ujevnt når bildet deles videre).

export type DelRad = {
  plass: number;
  navn: string;
  poeng: number;
  egen: boolean;
};

export type DelData = {
  rader: DelRad[]; // ferdig kuttet topp-N (f.eks. 8)
  undertittel: string; // f.eks. "34 av 104 kamper spilt"
  minPlass?: number;
  minNavn?: string;
  minPoeng?: number;
  total: number;
};

const GULL = "#f6cd5b";
const SØLV = "#d4dbe2";
const BRONSE = "#dd9d6e";
const TEKST = "#f1f4f8";
const DEMP = "#8a96a3";
const SVAK = "#5c6772";
const BLÅ = "#a6c0ff";

const MEDALJE: Record<number, [string, string, string, string]> = {
  1: ["#fdeeb0", "#f6cd5b", "#c79a30", "#3a2c08"],
  2: ["#f3f6f9", "#cfd6dd", "#9aa3ad", "#2b3138"],
  3: ["#f1c8a3", "#dd9d6e", "#ad6c40", "#3a2113"],
};

function rund(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function kutt(ctx: CanvasRenderingContext2D, tekst: string, maks: number) {
  if (ctx.measureText(tekst).width <= maks) return tekst;
  let t = tekst;
  while (t.length > 1 && ctx.measureText(t + "…").width > maks) {
    t = t.slice(0, -1);
  }
  return t + "…";
}

function poengFarge(plass: number) {
  return plass === 1 ? GULL : plass === 2 ? SØLV : plass === 3 ? BRONSE : TEKST;
}

// Tegnet medalje-skive (#1–3) eller nøytralt rangtall (resten).
function rang(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  plass: number,
) {
  const f = MEDALJE[plass];
  if (f) {
    const r = 30;
    const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    g.addColorStop(0, f[0]);
    g.addColorStop(0.5, f[1]);
    g.addColorStop(1, f[2]);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, r - 3.5, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.stroke();
    ctx.fillStyle = f[3];
    ctx.font = "800 30px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(plass), cx, cy + 1);
    ctx.textBaseline = "alphabetic";
  } else {
    ctx.fillStyle = SVAK;
    ctx.font = "700 33px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(plass), cx, cy + 1);
    ctx.textBaseline = "alphabetic";
  }
}

async function lagBilde(data: DelData): Promise<Blob> {
  // Sørg for at Inter er lastet før vi tegner, ellers faller vi til system-font.
  try {
    await (document as unknown as { fonts?: { ready: Promise<unknown> } })
      .fonts?.ready;
  } catch {
    /* ignorer */
  }

  const W = 1080;
  const M = 36; // ytre marg rundt panelet
  const PAD = 92; // indre venstre/høyre-marg for innhold
  const topp = 288;
  const radH = 100;
  const iTopp = data.rader.some((r) => r.egen);
  const visMin = data.minPlass != null && !iTopp;
  const bunn = 132 + (visMin ? 170 : 0);
  const H = topp + data.rader.length * radH + bunn;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Dyp bakgrunn
  ctx.fillStyle = "#05080c";
  ctx.fillRect(0, 0, W, H);

  // Innrammet panel (gir et premium «kort»-uttrykk)
  const px = M;
  const py = M;
  const pw = W - M * 2;
  const ph = H - M * 2;
  const panel = ctx.createLinearGradient(0, py, 0, py + ph);
  panel.addColorStop(0, "#101924");
  panel.addColorStop(1, "#0a0f16");
  rund(ctx, px, py, pw, ph, 40);
  ctx.fillStyle = panel;
  ctx.fill();
  // Gull-glød i toppen av panelet
  ctx.save();
  rund(ctx, px, py, pw, ph, 40);
  ctx.clip();
  const glød = ctx.createRadialGradient(
    W - 170,
    py + 40,
    0,
    W - 170,
    py + 40,
    540,
  );
  glød.addColorStop(0, "rgba(246,205,91,0.13)");
  glød.addColorStop(1, "rgba(246,205,91,0)");
  ctx.fillStyle = glød;
  ctx.fillRect(0, 0, W, 560);
  ctx.fillStyle = GULL;
  ctx.fillRect(px, py, pw, 8);
  ctx.restore();
  // Panel-kant
  rund(ctx, px + 0.75, py + 0.75, pw - 1.5, ph - 1.5, 40);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Header
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = TEKST;
  ctx.font = "800 74px Inter, system-ui, sans-serif";
  ctx.fillText("VM-tipping", PAD, 152);
  ctx.fillStyle = GULL;
  ctx.font = "800 25px Inter, system-ui, sans-serif";
  ctx.fillText("GUTTA · LEDERTAVLE", PAD + 2, 198);
  ctx.fillStyle = DEMP;
  ctx.font = "500 29px Inter, system-ui, sans-serif";
  ctx.fillText(data.undertittel, PAD + 2, 240);

  const x1 = PAD;
  const x2 = W - PAD;
  const hairline = (yy: number) => {
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, yy);
    ctx.lineTo(x2, yy);
    ctx.stroke();
  };
  hairline(topp - 22);

  const cx = PAD + 28; // sentrum for rang-skive
  const navnX = PAD + 80;

  let y = topp;
  data.rader.forEach((r, idx) => {
    const midt = y + radH / 2;

    if (r.plass === 1) {
      ctx.fillStyle = "rgba(246,205,91,0.07)";
      rund(ctx, x1 - 26, y + 8, x2 - x1 + 52, radH - 16, 20);
      ctx.fill();
    }
    if (r.egen) {
      ctx.fillStyle = "rgba(120,160,255,0.13)";
      rund(ctx, x1 - 26, y + 8, x2 - x1 + 52, radH - 16, 20);
      ctx.fill();
    }

    rang(ctx, cx, midt, r.plass);

    // Navn (vertikalt sentrert)
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = r.egen ? BLÅ : TEKST;
    ctx.font = `${r.plass === 1 ? 700 : 600} 44px Inter, system-ui, sans-serif`;
    const navn = kutt(ctx, r.navn, x2 - navnX - 190);
    ctx.fillText(navn, navnX, midt + 1);
    if (r.egen) {
      const b = ctx.measureText(navn).width;
      ctx.fillStyle = "rgba(120,160,255,0.2)";
      rund(ctx, navnX + b + 16, midt - 18, 70, 34, 17);
      ctx.fill();
      ctx.fillStyle = BLÅ;
      ctx.font = "800 19px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("DEG", navnX + b + 16 + 35, midt + 1);
    }

    // Poeng (tall + liten «p»)
    ctx.textAlign = "right";
    ctx.fillStyle = poengFarge(r.plass);
    ctx.font = "800 50px Inter, system-ui, sans-serif";
    ctx.fillText(String(r.poeng), x2 - 26, midt + 1);
    ctx.fillStyle = SVAK;
    ctx.font = "600 24px Inter, system-ui, sans-serif";
    ctx.fillText("p", x2, midt + 3);
    ctx.textBaseline = "alphabetic";

    if (idx < data.rader.length - 1) hairline(y + radH);
    y += radH;
  });

  // Egen plassering som eget kort når man ikke er i topp-lista
  if (visMin) {
    y += 30;
    const kortH = 140;
    const grad = ctx.createLinearGradient(x1, y, x2, y);
    grad.addColorStop(0, "rgba(120,160,255,0.22)");
    grad.addColorStop(1, "rgba(120,160,255,0.05)");
    rund(ctx, x1 - 26, y, x2 - x1 + 52, kortH, 26);
    ctx.fillStyle = grad;
    ctx.fill();
    rund(ctx, x1 - 26, y, x2 - x1 + 52, kortH, 26);
    ctx.strokeStyle = "rgba(120,160,255,0.38)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = BLÅ;
    ctx.font = "800 23px Inter, system-ui, sans-serif";
    ctx.fillText("DIN PLASSERING", x1, y + 46);

    ctx.fillStyle = TEKST;
    ctx.font = "800 52px Inter, system-ui, sans-serif";
    const hash = `#${data.minPlass}`;
    ctx.fillText(hash, x1, y + 106);
    const hashB = ctx.measureText(hash).width; // målt med riktig (52px) font
    ctx.fillStyle = DEMP;
    ctx.font = "500 28px Inter, system-ui, sans-serif";
    ctx.fillText(`av ${data.total}`, x1 + hashB + 18, y + 106);

    ctx.textAlign = "right";
    ctx.fillStyle = GULL;
    ctx.font = "800 62px Inter, system-ui, sans-serif";
    ctx.fillText(String(data.minPoeng ?? 0), x2 - 6, y + 92);
    ctx.fillStyle = DEMP;
    ctx.font = "600 27px Inter, system-ui, sans-serif";
    ctx.fillText("poeng", x2 - 6, y + 124);
    y += kortH;
  }

  // Bunntekst
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = SVAK;
  ctx.font = "600 24px Inter, system-ui, sans-serif";
  ctx.fillText("vm-tipping-gutta.web.app", PAD, H - M - 28);

  return await new Promise<Blob>((res, rej) =>
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error("toBlob feilet"))),
      "image/png",
    ),
  );
}

export async function delLedertavle(data: DelData): Promise<void> {
  const blob = await lagBilde(data);
  const fil = new File([blob], "ledertavle.png", { type: "image/png" });

  const nav = navigator as Navigator & {
    canShare?: (d: { files: File[] }) => boolean;
    share?: (d: {
      files?: File[];
      title?: string;
      text?: string;
    }) => Promise<void>;
  };

  // Mobil: del bildet direkte via systemets delingsark.
  if (nav.canShare?.({ files: [fil] }) && nav.share) {
    try {
      await nav.share({ files: [fil], title: "VM-tipping — Gutta" });
      return;
    } catch (e) {
      // Bruker avbrøt → ikke fall tilbake til nedlasting.
      if ((e as Error)?.name === "AbortError") return;
    }
  }

  // Desktop / ingen fil-deling: last ned bildet.
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "vm-ledertavle.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
