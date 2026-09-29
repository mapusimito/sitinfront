// Text-spill guard (P4). Runs inside the page: returns a list of strings, one per hit.
// Flags: (1) text wider than the element's content box while overflow is visible,
// (2) the text's own rect leaving the element's rect, (3) placeholder wider than its input,
// (4) two visible sibling controls whose rects overlap.
export function spillScan() {
  const hits = [];
  const vis = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.display === 'contents') return false;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2 && cs.opacity !== '0';
  };
  const name = (el) => {
    const id = el.id ? '#' + el.id : '';
    const cls = [...el.classList].slice(0, 2).map((c) => '.' + c).join('');
    const t = (el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    return `${el.tagName.toLowerCase()}${id}${cls}[${t}]`;
  };
  const SEL = 'button, a, .sf-badge, .sf-stat, summary, label, input[placeholder]';
  for (const el of document.body.querySelectorAll(SEL)) {
    if (!vis(el)) continue;
    const cs = getComputedStyle(el);
    if (el.tagName === 'INPUT') {
      const c = document.createElement('canvas').getContext('2d');
      c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const w = c.measureText(el.getAttribute('placeholder')).width;
      const box = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      if (!el.value && w > box + 1) hits.push(`placeholder wider than field: ${name(el)} ${Math.round(w)}>${Math.round(box)}`);
      continue;
    }
    if (cs.display === 'inline') continue;
    const r = el.getBoundingClientRect();
    if (cs.overflowX === 'visible' && el.scrollWidth > el.clientWidth + 1) {
      hits.push(`text wider than box: ${name(el)} scroll ${el.scrollWidth}>${el.clientWidth}`);
      continue;
    }
    // Text nodes only; visually hidden text (sr-only: 1 px box, clipped) is not spill.
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!n.textContent.trim()) continue;
      const pe = n.parentElement;
      const pr = pe.getBoundingClientRect();
      if (pr.width <= 2 || pr.height <= 2 || getComputedStyle(pe).display === 'none') continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      let bad = false;
      for (const tr of range.getClientRects()) {
        if (tr.width >= 1 && (tr.left < r.left - 1 || tr.right > r.right + 1)) bad = true;
      }
      if (bad) { hits.push(`text outside element rect: ${name(el)}`); break; }
    }
  }
  const ctl = 'button, a[href], summary, input, select, textarea';
  const seen = new Set();
  for (const el of document.body.querySelectorAll(ctl)) {
    const p = el.parentElement;
    if (!p || seen.has(p)) continue;
    seen.add(p);
    const kids = [...p.children].filter((k) => k.matches(ctl) && vis(k) && getComputedStyle(k).position !== 'absolute');
    for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
      const a = kids[i].getBoundingClientRect(); const b = kids[j].getBoundingClientRect();
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 1 && oy > 1) hits.push(`sibling controls overlap: ${name(kids[i])} / ${name(kids[j])}`);
    }
  }
  return hits;
}
