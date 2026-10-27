(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const fmt = (n) => n.toLocaleString("mn-MN").replace(/,/g, " ") + "₮";
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Утасны цэс
  const toggle = $(".nav-toggle");
  toggle.addEventListener("click", () => {
    const open = document.body.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", open);
  });
  document.querySelectorAll(".nav-links a").forEach((a) =>
    a.addEventListener("click", () => document.body.classList.remove("nav-open"))
  );

  // Мэдээлэл
  function renderArticles(tag) {
    $("#articles").innerHTML = ARTICLES.filter((a) => tag === "all" || a.tag === tag)
      .map((a) => `<article class="card"><span class="tag">${esc(a.tag)}</span><h3>${esc(a.title)}</h3><p>${esc(a.body)}</p></article>`)
      .join("");
  }
  $("#infoFilter").addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    document.querySelectorAll("#infoFilter .chip").forEach((c) => c.classList.toggle("active", c === btn));
    renderArticles(btn.dataset.tag);
  });
  renderArticles("all");

  // Гарын авлага
  $("#products").innerHTML = PRODUCTS.map(
    (p) => `<div class="card product">
      ${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ""}
      <span class="tag">${esc(p.format)}</span>
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.desc)}</p>
      <div class="product-foot"><span class="price">${fmt(p.price)}</span>
      <button class="btn btn-primary btn-sm" data-add="${p.id}">Сагсанд нэмэх</button></div>
    </div>`
  ).join("");

  // Сагс
  const CART_KEY = "tz_cart";
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch (e) {}
  const save = () => { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {} };
  const cartProducts = () => cart.map((id) => PRODUCTS.find((p) => p.id === id)).filter(Boolean);

  function renderCart() {
    const items = cartProducts();
    $("#cartCount").textContent = items.length;
    $("#cartItems").innerHTML = items.length
      ? items.map((p) => `<li><span>${esc(p.title)}</span><span>${fmt(p.price)} <button class="icon-btn" data-remove="${p.id}" aria-label="Хасах">✕</button></span></li>`).join("")
      : `<li class="empty">Сагс хоосон байна.</li>`;
    $("#cartTotal").textContent = fmt(items.reduce((s, p) => s + p.price, 0));
    $("#checkoutForm").hidden = !items.length;
  }
  const setCart = (open) => {
    document.body.classList.toggle("cart-open", open);
    $("#cart").setAttribute("aria-hidden", !open);
  };

  $("#products").addEventListener("click", (e) => {
    const id = e.target.dataset.add;
    if (!id) return;
    if (!cart.includes(id)) cart.push(id);
    save(); renderCart(); setCart(true);
  });
  $("#cartItems").addEventListener("click", (e) => {
    const id = e.target.dataset.remove;
    if (!id) return;
    cart = cart.filter((x) => x !== id);
    save(); renderCart();
  });
  $("#cartOpen").addEventListener("click", () => { $("#payInfo").hidden = true; setCart(true); });
  $("#cartClose").addEventListener("click", () => setCart(false));
  $("#overlay").addEventListener("click", () => setCart(false));

  $("#checkoutForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const items = cartProducts();
    const total = items.reduce((s, p) => s + p.price, 0);
    const code = "TZ" + Date.now().toString().slice(-6);
    $("#payInfo").innerHTML = `<p><strong>Захиалгын код: ${code}</strong></p>
      <p>${esc(PAYMENT.bank)} · ${esc(PAYMENT.account)}<br>${esc(PAYMENT.holder)}</p>
      <p>Дүн: <strong>${fmt(total)}</strong>. Гүйлгээний утга дээр захиалгын кодоо бичнэ үү.
      Төлбөр баталгаажмагц файлыг <strong>${esc(e.target.email.value)}</strong> хаяг руу илгээнэ.</p>`;
    $("#payInfo").hidden = false;
    cart = []; save(); renderCart();
    e.target.reset();
  });
  renderCart();

  // Эрсдэлийн тооцоолуур
  const form = $("#riskForm");
  form.innerHTML = RISK_QUESTIONS.map(
    (q, i) => `<fieldset><legend>${i + 1}. ${esc(q.q)}</legend>
      ${q.options.map(([label, w], j) => `<label class="opt"><input type="radio" name="q${i}" value="${w}" ${j === 0 ? "required" : ""}> ${esc(label)}</label>`).join("")}
    </fieldset>`
  ).join("") + `<button class="btn btn-primary" type="submit">Эрсдэл тооцоолох</button>`;

  const maxScore = RISK_QUESTIONS.reduce((s, q) => s + Math.max(...q.options.map((o) => o[1])), 0);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const score = RISK_QUESTIONS.reduce((s, _, i) => s + Number(form[`q${i}`].value), 0);
    const pct = Math.round((score / maxScore) * 100);
    const level = pct < 30
      ? { cls: "low", name: "Бага эрсдэл", text: "Татварын үйл ажиллагаа тань харьцангуй эмх цэгцтэй байна. Жилд нэг удаа дотоод шалгалт хийхэд хангалттай." }
      : pct < 60
      ? { cls: "mid", name: "Дунд эрсдэл", text: "Зарим хэсэгт зөрчил үүсэх магадлалтай. Баримтын бүрдэл, тайлангийн хугацаагаа шалгаж, мэргэжилтэнтэй зөвлөлдөхийг зөвлөж байна." }
      : { cls: "high", name: "Өндөр эрсдэл", text: "Нөхөн татвар, торгууль ногдох магадлал өндөр. Аль болох хурдан мэргэжлийн зөвлөгөө авна уу." };
    const r = $("#riskResult");
    r.className = "risk-result " + level.cls;
    r.innerHTML = `<div class="meter"><span style="width:${pct}%"></span></div>
      <h3>${level.name} — ${pct}%</h3><p>${level.text}</p>
      <div class="hero-actions"><a href="#consult" class="btn btn-primary">Зөвлөгөө авах</a><a href="#guides" class="btn btn-ghost">Гарын авлага үзэх</a></div>`;
    r.hidden = false;
    r.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  // Зөвлөгөөний хүсэлт — одоогоор зөвхөн браузерт хадгална. Сервер холбох үед энд илгээнэ.
  $("#consultForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    try {
      const list = JSON.parse(localStorage.getItem("tz_requests") || "[]");
      list.push({ ...data, at: new Date().toISOString() });
      localStorage.setItem("tz_requests", JSON.stringify(list));
    } catch (err) {}
    $("#consultMsg").textContent = `Баярлалаа, ${data.name}! Бид ${data.phone} дугаараар тантай удахгүй холбогдоно.`;
    e.target.reset();
  });
})();
