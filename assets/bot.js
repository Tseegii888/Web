(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (n, d = 1) => Number(n.toFixed(d)).toLocaleString("en-US").replace(/,/g, " ");

  const log = $("#botLog");
  const input = $("#botInput");
  const result = $("#riskResult");

  let answers = {};
  let history = []; // [{ id, label }]

  const optionsOf = (step) =>
    step.options === "industries"
      ? Object.entries(BOT.industries).map(([value, i]) => ({ label: i.label, value, score: 0 }))
      : step.options;

  // Хариулсан асуултаас хойших, нөхцөл нь биелсэн дараагийн алхам
  function nextStep() {
    const done = new Set(history.map((h) => h.id));
    return BOT.steps.find((s) => !done.has(s.id) && (!s.when || s.when(answers)));
  }

  function render() {
    const msgs = [];
    history.forEach((h) => {
      msgs.push(`<div class="msg bot-msg">${esc(BOT.steps.find((s) => s.id === h.id).text)}</div>`);
      msgs.push(`<div class="msg user-msg">${esc(h.label)}</div>`);
    });
    const step = nextStep();
    if (step) msgs.push(`<div class="msg bot-msg new">${esc(step.text)}</div>`);
    else msgs.push(`<div class="msg bot-msg new">Баярлалаа! Таны тайлан доор бэлэн боллоо.</div>`);
    log.innerHTML = msgs.join("");
    log.scrollTop = log.scrollHeight;

    const back = history.length ? `<button class="btn btn-ghost btn-sm" data-back>← Буцах</button>` : "";
    if (!step) {
      input.innerHTML = `<button class="btn btn-ghost btn-sm" data-restart>Дахин эхлэх</button>`;
      showReport();
      return;
    }
    result.hidden = true;
    if (step.type === "number") {
      input.innerHTML = `<form class="bot-num" data-num>
          <input inputmode="decimal" autocomplete="off" placeholder="${esc(step.unit)}" aria-label="${esc(step.text)}" required>
          <button class="btn btn-primary btn-sm" type="submit">Илгээх</button>
        </form>
        <div class="bot-actions">${back}${step.optional ? `<button class="btn btn-ghost btn-sm" data-skip>Мэдэхгүй / алгасах</button>` : ""}</div>
        <p class="bot-err" hidden></p>`;
      input.querySelector("input").focus({ preventScroll: true });
    } else {
      input.innerHTML = `<div class="bot-options">${optionsOf(step)
        .map((o, i) => `<button class="chip" data-opt="${i}">${esc(o.label)}</button>`)
        .join("")}</div><div class="bot-actions">${back}</div>`;
    }
  }

  function answer(step, value, label) {
    answers[step.id] = value;
    history.push({ id: step.id, label });
    render();
  }

  input.addEventListener("click", (e) => {
    const step = nextStep();
    const t = e.target;
    if (t.dataset.restart !== undefined) {
      answers = {}; history = []; render(); return;
    }
    if (t.dataset.back !== undefined) {
      const last = history.pop();
      delete answers[last.id];
      // Буцсан хариултаас хамааралтай, одоо асуух нөхцөлгүй болсон хариултуудыг цэвэрлэнэ
      history = history.filter((h) => { const s = BOT.steps.find((x) => x.id === h.id); return !s.when || s.when(answers); });
      render(); return;
    }
    if (t.dataset.skip !== undefined) return answer(step, null, "Мэдэхгүй / алгасав");
    if (t.dataset.opt !== undefined) {
      const o = optionsOf(step)[t.dataset.opt];
      answer(step, o.value, o.label);
    }
  });

  input.addEventListener("submit", (e) => {
    e.preventDefault();
    const step = nextStep();
    const raw = e.target.querySelector("input").value.trim().replace(/\s/g, "").replace(",", ".");
    const v = Number(raw);
    const err = input.querySelector(".bot-err");
    if (raw === "" || !isFinite(v) || v < 0) {
      err.textContent = "Зөвхөн 0 ба түүнээс их тоо оруулна уу.";
      err.hidden = false;
      return;
    }
    answer(step, v, `${num(v, 2)} ${step.unit}`);
  });

  // ---------- Шинжилгээ ----------

  // 1-р шат: сонгосон хариултын оноо ба дүгнэлт
  function questionFindings() {
    const out = [];
    history.forEach((h) => {
      const step = BOT.steps.find((s) => s.id === h.id);
      if (step.type === "number" || step.options === "industries") return;
      const opts = optionsOf(step);
      if (!opts.some((o) => o.score !== undefined)) return;
      const o = opts.find((x) => x.value === answers[step.id]);
      out.push({ score: o.score || 0, max: Math.max(...opts.map((x) => x.score || 0)), note: o.note, guide: o.guide });
    });
    return out;
  }

  // 2-р шат: санхүүгийн үзүүлэлтийн дүрэм
  function financialFindings(a) {
    const out = [];
    const ind = BOT.industries[a.industry] || BOT.industries.other;
    const has = (k) => typeof a[k] === "number";

    if (has("sales") && has("cogs") && a.sales > 0) {
      const m = ((a.sales - a.cogs) / a.sales) * 100;
      const f = { max: 4, metric: `Нийт ашгийн хувь: ${num(m)}% (салбарын жишиг ${ind.margin}%)`, guide: "g1" };
      if (m < 0) Object.assign(f, { score: 4, note: "Өртөг нь борлуулалтаас их байна. Орлогоо дутуу тусгасан эсвэл өртгөө өсгөсөн гэж үзэгдэх эрсдэлтэй." });
      else if (m < ind.margin * 0.5) Object.assign(f, { score: 3, note: "Нийт ашгийн хувь салбарын жишгээс хэт бага байна. Татварын алба орлого дутуу тусгасан эсэхийг шалгах магадлалтай." });
      else if (m < ind.margin * 0.75) Object.assign(f, { score: 1, note: "Нийт ашгийн хувь салбарын жишгээс бага зэрэг доогуур байна." });
      else Object.assign(f, { score: 0 });
      out.push(f);
    }

    if (has("lossYears")) {
      const s = [0, 1, 2, 4][a.lossYears];
      out.push({ score: s, max: 4, metric: `Алдагдалтай жил: ${a.lossYears}/3`, guide: "g4",
        note: s >= 2 ? "Удаа дараа алдагдалтай ажиллаж байгаа байгууллага хяналт шалгалтын сонголтод түлхүү ордог. Алдагдлын шалтгааныг баримтжуулаарай." : null });
    }

    if (has("sales") && a.sales >= BOT.vatThreshold && a.vat !== "yes" && a.vat !== "no" && a.vat !== "unknown") {
      out.push({ score: 4, max: 4, metric: `Борлуулалт ${num(a.sales)} сая ₮ ≥ ${BOT.vatThreshold} сая ₮`, guide: "g2",
        note: "Орлого НӨАТ-ын бүртгэлийн босгыг давсан байна. НӨАТ төлөгчөөр бүртгүүлэх үүрэгтэй." });
    }

    if (has("vatOut") && has("vatIn") && a.vatOut > 0) {
      const r = a.vatIn / a.vatOut;
      out.push({ score: r > 1 ? 3 : r > 0.9 ? 2 : 0, max: 3, metric: `Хасагдах / төлөх НӨАТ: ${num(r * 100)}%`, guide: "g2",
        note: r > 1 ? "Хасагдах НӨАТ төлөх НӨАТ-аас их байна — илүү төлөлт, буцаан олголтын хүсэлт нь хяналт шалгалт дагуулдаг." : r > 0.9 ? "Хасагдах НӨАТ төлөх НӨАТ-тай бараг тэнцүү — нэмэгдсэн өртөг бага байгаа нь анхаарал татна." : null });
    }

    if (has("vatOut") && has("sales") && a.sales > 0) {
      const expected = a.sales * BOT.vatRate;
      const low = a.vatOut < expected * 0.7;
      out.push({ score: low ? 2 : 0, max: 2, metric: `Ногдуулсан НӨАТ: ${num(a.vatOut)} сая ₮ (борлуулалтын ${BOT.vatRate * 100}% = ${num(expected)} сая ₮)`, guide: "g2",
        note: low ? "Ногдуулсан НӨАТ борлуулалттай уялдахгүй байна. Чөлөөлөгдөх/0 хувь хэмжээтэй борлуулалт байгаа бол баримтаар нотлоход бэлэн байгаарай." : null });
    }

    if (has("payroll") && a.employees > 0) {
      const avg = (a.payroll * 1e6) / a.employees / 12;
      const low = avg < BOT.minWage;
      out.push({ score: low ? 3 : 0, max: 3, metric: `Нэг ажилтны сарын дундаж цалин: ${num(avg, 0)} ₮`, guide: "g3",
        note: low ? `Дундаж цалин хөдөлмөрийн хөлсний доод хэмжээнээс (${num(BOT.minWage, 0)} ₮) бага байна. Цалин дутуу тайлагнасан гэж үзэгдэж ХХОАТ, НДШ нөхөн ногдох эрсдэлтэй.` : null });
    }

    if (has("ebarimtSales") && has("sales") && a.sales > 0) {
      const d = Math.abs(a.sales - a.ebarimtSales) / a.sales;
      out.push({ score: d > 0.2 ? 3 : d > 0.1 ? 2 : 0, max: 3, metric: `И-баримт ба тайлангийн зөрүү: ${num(d * 100)}%`, guide: "g4",
        note: d > 0.1 ? "И-баримтаар баталгаажсан борлуулалт тайлагнасан орлоготой зөрж байна. Татварын алба энэ зөрүүг автоматаар илрүүлдэг." : null });
    }
    return out;
  }

  function showReport() {
    const findings = [...questionFindings(), ...financialFindings(answers)];
    const total = findings.reduce((s, f) => s + f.score, 0);
    const max = findings.reduce((s, f) => s + f.max, 0) || 1;
    const pct = Math.round((total / max) * 100);
    // Ноцтой дүгнэлт нь нийт хувиас үл хамааран түвшинг өсгөнө
    const serious = findings.filter((f) => f.score >= 3).length;
    const tier = findings.some((f) => f.score >= 4) || serious >= 3 ? 2 : serious ? 1 : 0;
    const level = [
      { cls: "low", name: "Бага эрсдэл", text: "Татварын үйл ажиллагаа тань харьцангуй эмх цэгцтэй байна. Жилд нэг удаа дотоод шалгалт хийхэд хангалттай." },
      { cls: "mid", name: "Дунд эрсдэл", text: "Зарим хэсэгт зөрчил үүсэх магадлалтай. Доорх асуудлуудыг засаж, мэргэжилтэнтэй зөвлөлдөхийг зөвлөж байна." },
      { cls: "high", name: "Өндөр эрсдэл", text: "Нөхөн татвар, торгууль ногдох магадлал өндөр. Аль болох хурдан мэргэжлийн зөвлөгөө авна уу." }
    ][Math.max(tier, pct < 30 ? 0 : pct < 60 ? 1 : 2)];

    const issues = findings.filter((f) => f.score > 0 && f.note).sort((x, y) => y.score - x.score);
    const metrics = findings.filter((f) => f.metric);
    const guides = [...new Set(issues.map((f) => f.guide).filter(Boolean))].map((id) => PRODUCTS.find((p) => p.id === id)).filter(Boolean);
    const sev = (s) => (s >= 3 ? "high" : s >= 2 ? "mid" : "low");

    result.className = "risk-result " + level.cls;
    result.innerHTML = `<div class="meter"><span style="width:${pct}%"></span></div>
      <h3>${level.name} — эрсдэлийн оноо ${pct}%</h3><p>${level.text}</p>
      ${tier > (pct < 30 ? 0 : pct < 60 ? 1 : 2) ? `<p><strong>Тайлбар:</strong> ноцтой эрсдэл илэрсэн тул түвшинг онооноос гарахаас өндөр үнэлэв.</p>` : ""}
      ${metrics.length ? `<h4>Санхүүгийн үзүүлэлт</h4><ul class="metrics">${metrics.map((f) => `<li class="sev-${sev(f.score)}">${esc(f.metric)}</li>`).join("")}</ul>` : ""}
      ${issues.length ? `<h4>Илэрсэн эрсдэл (${issues.length})</h4><ul class="findings">${issues.map((f) => `<li class="sev-${sev(f.score)}">${esc(f.note)}</li>`).join("")}</ul>` : `<p>Онцгой эрсдэл илэрсэнгүй.</p>`}
      ${guides.length ? `<h4>Танд тохирох гарын авлага</h4><ul class="rec-guides">${guides.map((p) => `<li><span>${esc(p.title)}</span><button class="btn btn-ghost btn-sm" data-guide="${p.id}">Сагсанд нэмэх</button></li>`).join("")}</ul>` : ""}
      <div class="hero-actions"><a href="#consult" class="btn btn-primary">Мэргэжилтнээс зөвлөгөө авах</a><button class="btn btn-ghost" data-print>Тайлан хэвлэх</button></div>
      <p class="disclaimer">Энэ үнэлгээ нь ерөнхий чиглэл өгөх зорилготой бөгөөд хууль зүйн дүгнэлт биш.</p>`;
    result.hidden = false;
  }

  result.addEventListener("click", (e) => {
    if (e.target.dataset.guide) window.addToCart(e.target.dataset.guide);
    if (e.target.dataset.print !== undefined) window.print();
  });

  render();
})();
