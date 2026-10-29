/**
 * Branded Bulgarian commercial offer PDF for Minimart.
 * Run: node scripts/generate-minimart-offer-pdf.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outPath = path.join(root, "assets", "offers", "expire365-minimart-oferta.pdf");
const logoPath = path.join(root, "public", "landing", "brand-mark.png");
const fontR = "C:/Windows/Fonts/arial.ttf";
const fontB = "C:/Windows/Fonts/arialbd.ttf";

const C = {
  bg: "#0b0b0d",
  card: "#16161a",
  line: "#2e2e36",
  text: "#f4f4f5",
  muted: "#a1a1aa",
  green: "#34d399",
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });

const doc = new PDFDocument({
  size: "A4",
  autoFirstPage: false,
  margins: { top: 0, bottom: 0, left: 0, right: 0 },
  info: {
    Title: "expire365: предложение за Minimart",
    Author: "expire365",
    Subject: "Търговска оферта",
  },
});
const stream = fs.createWriteStream(outPath);
doc.pipe(stream);

const W = 595.28;
const H = 841.89;
const L = 48;
const R = W - 48;
const CW = R - L;
const MAX_Y = H - 56;
let TOTAL = 5;
let pageNum = 0;

function addPaintedPage() {
  doc.addPage({ size: "A4", margin: 0 });
  doc.rect(0, 0, W, H).fill(C.bg);
  pageNum += 1;
}

function footer() {
  doc
    .moveTo(L, H - 48)
    .lineTo(R, H - 48)
    .strokeColor(C.line)
    .lineWidth(0.6)
    .stroke();
  doc.fillColor(C.muted).font(fontR).fontSize(8);
  doc.text("expire365.com", L, H - 36, { width: CW / 2, lineBreak: false });
  doc.text(`${pageNum} / ${TOTAL}`, L, H - 36, {
    width: CW,
    align: "right",
    lineBreak: false,
  });
}

function header(subtitle) {
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, L, 32, { width: 32, height: 32 });
  }
  doc.fillColor(C.green).font(fontB).fontSize(11).text("expire365", L + 42, 34, {
    lineBreak: false,
  });
  doc.fillColor(C.muted).font(fontR).fontSize(9).text(subtitle, L + 42, 50, {
    width: CW - 42,
    lineBreak: false,
  });
  doc
    .moveTo(L, 76)
    .lineTo(R, 76)
    .strokeColor(C.line)
    .lineWidth(0.6)
    .stroke();
  return 92;
}

function title(y, text, size = 16) {
  doc.fillColor(C.text).font(fontB).fontSize(size).text(text, L, y, {
    width: CW,
    lineBreak: false,
  });
  return y + size + 8;
}

function section(y, text) {
  doc.fillColor(C.green).font(fontB).fontSize(11).text(text, L, y, {
    width: CW,
    lineBreak: false,
  });
  return y + 16;
}

function para(y, text, size = 9) {
  doc.fillColor(C.muted).font(fontR).fontSize(size).text(text, L, y, {
    width: CW,
    align: "left",
    lineGap: 1.5,
    height: MAX_Y - y,
  });
  return doc.y + 6;
}

function bullets(y, items, size = 9) {
  for (const item of items) {
    if (y > MAX_Y - 20) break;
    doc.fillColor(C.green).font(fontB).fontSize(size).text("•", L, y, {
      lineBreak: false,
    });
    doc.fillColor(C.muted).font(fontR).fontSize(size).text(item, L + 12, y, {
      width: CW - 12,
      lineGap: 1,
    });
    y = doc.y + 4;
  }
  return y;
}

function card(y, rows) {
  const rowH = 16;
  const pad = 12;
  const h = pad * 2 + rows.length * rowH;
  doc.roundedRect(L, y, CW, h, 8).fill(C.card);
  doc
    .roundedRect(L, y, CW, h, 8)
    .strokeColor(C.line)
    .lineWidth(0.7)
    .stroke();
  let yy = y + pad;
  for (const [label, value] of rows) {
    doc.fillColor(C.text).font(fontR).fontSize(9).text(label, L + 12, yy, {
      width: CW * 0.52,
      lineBreak: false,
    });
    doc
      .fillColor(C.green)
      .font(fontB)
      .fontSize(9)
      .text(value, L + CW * 0.52, yy, {
        width: CW * 0.48 - 12,
        align: "right",
        lineBreak: false,
      });
    yy += rowH;
  }
  return y + h + 10;
}

// ——— 1 Cover ———
addPaintedPage();
if (fs.existsSync(logoPath)) {
  doc.image(logoPath, (W - 88) / 2, 160, { width: 88, height: 88 });
}
doc.fillColor(C.green).font(fontB).fontSize(26).text("expire365", L, 270, {
  width: CW,
  align: "center",
  lineBreak: false,
});
doc
  .fillColor(C.text)
  .font(fontB)
  .fontSize(17)
  .text("Предложение за Minimart", L, 308, {
    width: CW,
    align: "center",
    lineBreak: false,
  });
doc
  .fillColor(C.muted)
  .font(fontR)
  .fontSize(10)
  .text(
    "Варианти за ползване на приложението, ориентировъчни цени и следващи стъпки.",
    L,
    338,
    { width: CW, align: "center" },
  );
doc
  .fillColor(C.muted)
  .font(fontR)
  .fontSize(9.5)
  .text("октомври 2026", L, 372, {
    width: CW,
    align: "center",
    lineBreak: false,
  });
doc.roundedRect(L + 36, 430, CW - 72, 72, 10).fill(C.card);
doc
  .fillColor(C.text)
  .font(fontR)
  .fontSize(9.5)
  .text(
    "Продуктът вече работи в над 40 локации.\nНе става дума за демо или пилотен проект, а за разширяване и евентуална по-дълбока интеграция.",
    L + 50,
    448,
    { width: CW - 100, align: "center", lineGap: 3 },
  );
footer();

// ——— 2 Product + development ———
addPaintedPage();
let y = header("1 / 2. Продукт, архитектура и развитие");
y = title(y, "Операции в магазина", 14);
y = bullets(
  y,
  [
    "Годност по обект: списък, периоди, цветова спешност, премахване, намаление на цена",
    "Динамично търсене в годност и свързани екрани",
    "Сканиране на баркод / ръчно добавяне",
    "Любими и следене на продукти",
    "База от артикули с над 5 милиона записа",
    "Сканиране на документи с оптично разпознаване: камера или галерия, корекция преди импорт",
    "Изкуствен интелект със строги правила и каскада от около 7 модела",
    "Екип и права, график (където е включен), известия, прогресивно уеб приложение",
    "Дневник на действията и проследимост на ползването за собственици",
    "Експорт на график и експорт на артикули",
  ],
  8.5,
);
y += 2;
y = section(y, "Архитектура и експлоатация");
y = bullets(
  y,
  [
    "Роли, сесии, контрол на достъпа, сървърна част и база данни",
    "Политика за архивиране и възможност за възстановяване",
    "Мониторинг, административни инструменти, непрекъснати подобрения",
    "Месеци настройка и подобрения до сегашното качество: сложни каскадни матрици и зависимости между модели, правила и потоци",
  ],
  8.5,
);
y += 4;
doc.roundedRect(L, y, CW, 40, 8).fill(C.card);
doc
  .fillColor(C.text)
  .font(fontB)
  .fontSize(9)
  .text("Публична цена за независим обект", L + 14, y + 8, {
    lineBreak: false,
  });
doc
  .fillColor(C.green)
  .font(fontB)
  .fontSize(13)
  .text("20 € / обект / месец", L + 14, y + 22, { lineBreak: false });
y += 48;
y = section(y, "Постоянно развитие");
y = para(
  y,
  "Работя с честота на подобрения от малки корекции до по-сериозни потоци (сканиране, годност, екип, сигурност). Каталогът „Новости“ има около 100 описани подобрения; публикуват се към потребителите като „Какво е новото“.",
  8.5,
);
y = section(y, "Следващи функции и допълнителни заявки");
y = para(
  y,
  "Примери: отмяна на промени, измервания за изтекла стока, по-широк анализ, връзка с ваша номенклатура или програмен интерфейс. При 300 до 350 обекта заявките могат да са много: (1) в договорения пакет, или (2) допълнително остойностени. Промените е най-добре да се водят от мен.",
  8.5,
);
footer();

// ——— 3 Variant A + B (cloud) ———
addPaintedPage();
y = header("3. Варианти и цени");
y = title(y, "Вариант A: Софтуер като услуга", 15);
y = para(y, "Хостинг при expire365. Най-бърз старт без преместване на инфраструктура.", 9);
y = card(y, [
  ["Мрежа (около 300 до 350 обекта)", "от 3 900 до 5 250 € / месец"],
  ["Плащане за цяла година", "10% отстъпка върху годишната сума"],
  ["Годишно с 10% отстъпка", "от около 42 120 до 56 700 € / година"],
  ["Старт / въвеждане за централа", "от 1 000 до 2 000 € еднократно"],
]);
y = section(y, "Цена на обект");
y = bullets(y, [
  "Публична цена: 20 € / обект / месец (при 350 обекта ≈ 7 000 € / месец)",
  "Оферта за цялата мрежа: от 13 до 15 € / обект / месец",
  "Пример месечно: 300 × 13 € = 3 900 €; 350 × 15 € = 5 250 €",
  "При плащане за цяла година: 10% отстъпка (напр. 3 900 × 12 × 0,9 ≈ 42 120 €)",
]);
y += 6;
y = title(y, "Вариант B: Хостинг във вашия облак", 15);
y = para(
  y,
  "Отделен инженерен проект, не преместване с един клик. Включва по-стабилна база данни, архивиране и мониторинг, сигурност и решение за оптично разпознаване. При номенклатура от ваш програмен интерфейс част от разпознаването може да намалее.",
  9,
);
y = para(
  y,
  "Ползването не дава право на копиране и модифициране. Интелектуалната собственост остава неприкосновена.",
  9,
);
y = card(y, [
  ["Оценка и проучване", "по договаряне"],
  ["Интеграция", "по договаряне и преценка от двете страни"],
  ["Месечна поддръжка", "по договаряне"],
]);
footer();

// ——— 5 Variants C + D ———
addPaintedPage();
y = header("3. Варианти и цени (продължение)");
y = title(y, "Вариант C: Работа за вас + премиум лиценз", 14);
y = para(
  y,
  "Ангажимент към Minimart плюс лиценз за мрежата. В този модел работя както по доразвиването на expire365, така и по други продукти, които Minimart иска да развива. Новите продукти за Minimart остават изцяло собственост на компанията Minimart. expire365 остава мой продукт (ползване по лиценз).",
  8.5,
);
y = card(y, [
  ["Ангажимент (нето / месец)", "от 3 500 до 5 000 €"],
  ["Премиум лиценз / обект", "от 7 до 10 € / обект / месец"],
  ["Лиценз за мрежата (ориентир)", "от около 2 100 до 3 500 € / месец"],
  ["Общо ориентировъчно", "около 5 600 до 8 500 € / месец"],
]);
y = para(
  y,
  "Пример лиценз: 300 × 7 € = 2 100 €; 350 × 10 € = 3 500 €. Големи блокове извън месечния капацитет са допълнително (вариант D).",
  9,
);
y = title(y, "Вариант D: Работа по договор / проект", 14);
y = card(y, [
  ["Дневка", "от 250 до 400 € / ден"],
  ["Месечен абонамент (6 до 10 дни)", "от 1 800 до 3 500 € / месец"],
  ["Конкретен проект", "фиксирана цена след оценка"],
]);
y = para(
  y,
  "Може заедно с A. Допълнителни функционалности: дневка или пакет след техническо задание.",
  9,
);
footer();

// ——— 6 AI / OCR / Next ———
addPaintedPage();
y = header("3.1 / 3.2 / 5. Допълнения и следваща стъпка");
y = title(y, "Изкуствен интелект и инфраструктура", 14);
y = para(
  y,
  "При интерес към модели за B2B и ML, Deep thinking е добре да се помисли за локална инфраструктура и развитието ѝ. Варианти с трети страни са бързо решение, но скъпо такова в дългосрочен план и обхват.",
  9,
);
y = title(y, "Оптично разпознаване при голям обем", 14);
y = para(
  y,
  "При 300 до 350 обекта и средно 30 до 40 документа на магазин на месец платените модели оскъпяват с около 500 до 700 € / месец. Алтернатива: данни от ваша система. Цените са ориентировъчни: с включени платени модели или без тях.",
  9,
);
y = title(y, "Отворени сме за вашия модел", 14);
y = para(
  y,
  "Моля да разгледате вариантите с вътрешния си екип. Ако имате друго предложение за модел, обхват, етапи или бюджет, моля да го обсъдим открито, дори да се различава значително от ориентирите тук.",
  9,
);
y = section(y, "Какво би помогнало като следваща стъпка");
y = bullets(y, [
  "избор на вариант",
  "бюджетна рамка / предложение от ваша страна",
  "допълнителни въпроси и уточнения",
]);
y += 8;
doc.roundedRect(L, y, CW, 112, 10).fill(C.card);
doc.fillColor(C.green).font(fontB).fontSize(11).text("Благодарности", L + 14, y + 14, {
  lineBreak: false,
});
doc
  .fillColor(C.muted)
  .font(fontR)
  .fontSize(9)
  .text(
    "Благодаря на Драгия Драгиев за възможността и представянето ми пред екипа. Също така искам да благодаря на Пламена Крушева за приятния и в същото време ползотворен и професионален разговор и възможност за представянето на продукта и мен самия.\n\nОставам на разположение.\n\nГеорги Николов  ·  0887 628 654\nexpire365@gmail.com  ·  https://expire365.com",
    L + 14,
    y + 32,
    { width: CW - 28, lineGap: 2 },
  );
footer();

TOTAL = pageNum;
doc.end();
await new Promise((resolve, reject) => {
  stream.on("finish", resolve);
  stream.on("error", reject);
});
console.log(`Wrote ${outPath} (${pageNum} pages)`);
