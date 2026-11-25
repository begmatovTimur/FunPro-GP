"""Builds the FunPro GP podium certificates (P1, P2, P3).

After the race, type the winners' names below and run:
    python build.py      (writes certificates.html)
    node render.js       (writes the PDF and PNG files; needs Playwright: npm i playwright)
Leave a name empty to keep a blank line for writing it by hand.
"""
from pathlib import Path

NAMES = {1: "", 2: "", 3: ""}

PLACES = [
    {"p": 1, "title": "Race Winner", "lead": "taking the chequered flag in first place",
     "metal": "linear-gradient(160deg,#fff4bf 0%,#f2c94c 28%,#b8860b 52%,#ffe27a 70%,#a87400 100%)",
     "accent": "#d4a017", "accent2": "#f2c94c"},
    {"p": 2, "title": "Second Place", "lead": "finishing on the podium in second place",
     "metal": "linear-gradient(160deg,#ffffff 0%,#d9dde1 28%,#8c939a 52%,#f1f3f5 70%,#6e757c 100%)",
     "accent": "#8c939a", "accent2": "#c9ced3"},
    {"p": 3, "title": "Third Place", "lead": "finishing on the podium in third place",
     "metal": "linear-gradient(160deg,#ffe0c2 0%,#e0975f 28%,#9a5428 52%,#f4be8c 70%,#7a3f1b 100%)",
     "accent": "#b4652f", "accent2": "#e0975f"},
]

TROPHY = """<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
<path d="M18 6h28v14c0 9-6 16-14 16S18 29 18 20z" fill="currentColor"/>
<path d="M18 10H8v4c0 7 5 12 11 12M46 10h10v4c0 7-5 12-11 12" fill="none" stroke="currentColor" stroke-width="3.2"/>
<rect x="29" y="35" width="6" height="10" fill="currentColor"/>
<path d="M20 46h24l2 8H18z" fill="currentColor"/><rect x="14" y="54" width="36" height="5" rx="1" fill="currentColor"/>
</svg>"""


def podium(p: int, accent: str) -> str:
    # order on a podium: P2 left, P1 middle, P3 right
    blocks = [(2, 26), (1, 38), (3, 18)]
    out = []
    for i, (pos, h) in enumerate(blocks):
        on = pos == p
        out.append(f'<div class="pod {"on" if on else ""}" style="height:{h}mm;{"background:" + accent + ";" if on else ""}">'
                   f'<span>{pos}</span></div>')
    return '<div class="podium">' + "".join(out) + "</div>"


def page(c: dict) -> str:
    p = c["p"]
    return f"""
<section class="page" style="--metal:{c['metal']};--accent:{c['accent']};--accent2:{c['accent2']}">
  <div class="checker top"></div>

  <div class="left">
    <div class="logos">
      <img src="wiut.png" class="wiut" alt="WIUT Computing Department">
      <img src="club.png" class="club" alt="Club logo">
    </div>

    <div class="eyebrow">FunPro GP · University Grand Prix 2026</div>
    <h1>Certificate<br><span>of achievement</span></h1>

    <p class="presented">This certificate is proudly presented to</p>
    <div class="nameline">{NAMES.get(p, "")}</div>
    <div class="namelabel">Driver name</div>

    <p class="body">
      for {c['lead']} &mdash; <b>P{p} &middot; {c['title']}</b> &mdash; at <b>FunPro GP</b>, a Formula&nbsp;1&ndash;themed
      coding championship of three qualifying sessions (Q1&nbsp;&middot;&nbsp;Q2&nbsp;&middot;&nbsp;Q3),
      held by <b>WestDevs</b> and the <b>WIUT Computing Department</b> on <b>26 November 2026</b>.
    </p>

    <div class="signs">
      <div class="sign"><div class="line"></div><div class="who">Nargiza Akramova</div></div>
      <div class="sign"><div class="line"></div><div class="who">Mukhammadmuso Abduzhabbarov</div></div>
    </div>
  </div>

  <div class="stripes"><i></i><i></i><i></i></div>

  <aside class="right">
    <div class="brand"><span class="mark"></span>FunPro <b>GP</b></div>
    <div class="pos">P{p}</div>
    <div class="title">{c['title']}</div>
    <div class="trophy">{TROPHY}</div>
    {podium(p, c['accent'])}
    <div class="date">26 · 11 · 2026</div>
    <div class="tag">Lights out and away we code</div>
  </aside>

  <div class="band"></div>
</section>"""


CSS = """
@font-face{font-family:T;src:url(fonts/titillium-web-latin-400-normal.woff2);font-weight:400}
@font-face{font-family:T;src:url(fonts/titillium-web-latin-600-normal.woff2);font-weight:600}
@font-face{font-family:T;src:url(fonts/titillium-web-latin-700-normal.woff2);font-weight:700}
@font-face{font-family:T;src:url(fonts/titillium-web-latin-900-normal.woff2);font-weight:900}
@font-face{font-family:T;src:url(fonts/titillium-web-latin-700-italic.woff2);font-weight:700;font-style:italic}
@page{size:297mm 210mm;margin:0}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0;padding:0;background:#777}
body{font-family:T,sans-serif;color:#15151e}
.page{width:297mm;height:210mm;position:relative;overflow:hidden;background:#fff;page-break-after:always;margin:0 auto}
.page:last-child{page-break-after:auto}
.page::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(-60deg,transparent 0 9mm,rgba(21,21,30,.025) 9mm 12mm)}
.checker{position:absolute;left:0;right:0;height:6mm;z-index:3;
  background-color:#fff;background-image:linear-gradient(45deg,#15151e 25%,transparent 25%,transparent 75%,#15151e 75%),
  linear-gradient(45deg,#15151e 25%,transparent 25%,transparent 75%,#15151e 75%);
  background-size:6mm 6mm;background-position:0 0,3mm 3mm}
.checker.top{top:0}
.band{position:absolute;left:0;right:0;bottom:0;height:4mm;background:linear-gradient(90deg,#e10600 0 62%,var(--accent) 62%);z-index:3}

.left{position:absolute;left:20mm;top:15mm;width:132mm;bottom:12mm;z-index:2}
.logos{display:flex;align-items:center;gap:8mm;height:24mm}
.logos .wiut{height:17mm}
.logos .club{height:22mm}
.eyebrow{margin-top:11mm;font-weight:700;font-size:9.5pt;letter-spacing:3.2pt;text-transform:uppercase;color:#e10600}
h1{margin:2mm 0 0;font-weight:900;font-size:40pt;line-height:.92;text-transform:uppercase;letter-spacing:-.5pt}
h1 span{font-weight:600;font-size:21pt;letter-spacing:2.5pt;color:#55555f}
.presented{margin:9mm 0 0;font-size:12pt;color:#55555f}
.nameline{margin-top:6mm;width:128mm;height:13mm;border-bottom:.5mm solid #15151e;font-weight:900;font-size:26pt;line-height:13mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.namelabel{margin-top:1.5mm;font-size:8pt;font-weight:700;letter-spacing:2pt;text-transform:uppercase;color:#9a9aa5}
.body{margin:7mm 0 0;width:128mm;font-size:11pt;line-height:1.55;color:#33333d}
.body b{color:#15151e}
.signs{position:absolute;left:0;right:0;bottom:6mm;display:flex;justify-content:space-between}
.sign{width:60mm;text-align:center}
.sign .line{border-top:.35mm solid #c9c9d1;margin-bottom:2.5mm}
.sign .who{font-size:10pt;font-weight:600;white-space:nowrap}

.stripes{position:absolute;top:0;bottom:0;right:84mm;width:30mm;z-index:1}
.stripes i{position:absolute;top:-10mm;bottom:-10mm;width:4mm;transform:skewX(-14deg)}
.stripes i:nth-child(1){left:6mm;background:#e10600}
.stripes i:nth-child(2){left:13mm;background:var(--accent);width:2.5mm}
.stripes i:nth-child(3){left:18.5mm;background:#e10600;width:1.3mm;opacity:.7}

.right{position:absolute;top:0;bottom:0;right:0;width:92mm;background:#15151e;color:#fff;z-index:2;
  clip-path:polygon(15mm 0,100% 0,100% 100%,0 100%);display:flex;flex-direction:column;align-items:center;padding:16mm 6mm 10mm 18mm}
.right::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(-60deg,transparent 0 7mm,rgba(255,255,255,.035) 7mm 10mm)}
.right>*{position:relative}
.brand{align-self:flex-end;display:flex;align-items:center;gap:2.5mm;font-weight:700;font-style:italic;font-size:14pt}
.brand b{color:#e10600}
.mark{width:11mm;height:5mm;background:#e10600;clip-path:polygon(22% 0,100% 0,78% 100%,0 100%);position:relative}
.pos{margin-top:12mm;font-weight:900;font-size:118pt;line-height:.85;letter-spacing:-4pt;font-style:italic;
  background:var(--metal);-webkit-background-clip:text;background-clip:text;color:transparent;padding:0 4mm 0 0}
.title{margin-top:3mm;font-weight:900;font-size:16pt;letter-spacing:3pt;text-transform:uppercase;color:var(--accent2)}
.trophy{margin-top:8mm;width:20mm;height:20mm;color:var(--accent2)}
.podium{margin-top:auto;display:flex;align-items:flex-end;gap:1.5mm}
.pod{width:16mm;background:#2c2c38;border-radius:1mm 1mm 0 0;display:flex;justify-content:center;padding-top:2mm;
  font-weight:900;font-style:italic;font-size:13pt;color:#8a8a96}
.pod.on{color:#15151e}
.date{margin-top:5mm;font-weight:700;letter-spacing:3pt;font-size:11pt}
.tag{margin-top:1mm;font-size:8pt;letter-spacing:2pt;text-transform:uppercase;color:#8a8a96}
"""

html = f"""<!doctype html><html><head><meta charset="utf-8"><title>FunPro GP certificates</title>
<style>{CSS}</style></head><body>{''.join(page(c) for c in PLACES)}</body></html>"""
Path("certificates.html").write_text(html, encoding="utf-8")
print("written")
