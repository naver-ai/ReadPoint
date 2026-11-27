// ReadPoint project page: section highlight in the top bar, BibTeX copy, and video loading when it comes into view.
document.addEventListener("DOMContentLoaded", () => {
  const links = [...document.querySelectorAll(".bar nav a")];
  const secs = links.map(a => document.querySelector(a.getAttribute("href"))).filter(Boolean);
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) links.forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id));
    }), { rootMargin: "-40% 0px -55% 0px" });
    secs.forEach(s => io.observe(s));
    const vio = new IntersectionObserver(es => es.forEach(e => {
      const v = e.target;
      if (e.isIntersecting && !v.src) { v.src = v.dataset.src; }
    }), { rootMargin: "400px 0px" });
    document.querySelectorAll("video[data-src]").forEach(v => vio.observe(v));
  } else {
    document.querySelectorAll("video[data-src]").forEach(v => { v.src = v.dataset.src; });
  }
  const btn = document.getElementById("copy-bib");
  if (btn) btn.addEventListener("click", async () => {
    const pre = document.getElementById("bib-text");
    try { await navigator.clipboard.writeText(pre.textContent); btn.textContent = "Copied"; }
    catch (e) { const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); btn.textContent = "Selected"; }
    setTimeout(() => { btn.textContent = "Copy"; }, 1600);
  });
});
