"""Independent responsive/accessibility smoke audit against a running Bitácora server.

Run: python3 tests/browser_responsive.py [http://localhost:5173]
Requires Python Playwright and /usr/bin/chromium (CHROMIUM_PATH may override).
Writes screenshots and a machine-readable report under artifacts/QA.
"""
from pathlib import Path
import json
import os
import re
import sys
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "artifacts" / "QA"
OUTPUT.mkdir(parents=True, exist_ok=True)
BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5173"
WIDTHS = [320, 360, 390, 412, 768, 1280]
VIEWS = [
    ("inicio", "Inicio"),
    ("entrenar", "Entrenar"),
    ("alimentacion", "Alimentación"),
    ("progreso", "Progreso"),
    ("cronometro", "Cronómetro y descanso"),
    ("ajustes", "Ajustes y copias de seguridad"),
]

INSPECT = r"""() => {
  const vw = window.innerWidth;
  const visible = el => {
    if (!el.getClientRects().length || el.closest('[hidden]')) return false;
    const css = getComputedStyle(el);
    return css.visibility !== 'hidden' && css.display !== 'none' && css.opacity !== '0';
  };
  const name = el => {
    const ref = el.getAttribute('aria-labelledby');
    if (ref) return ref.split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ').trim();
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
    const label = [...(el.labels || [])].map(x => x.textContent.trim()).join(' ');
    if (label) return label;
    const nestedImageAlt = [...el.querySelectorAll('img[alt]')].map(x => x.alt).join(' ');
    return ((el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || el.tagName === 'A' || el.tagName === 'SUMMARY') ? el.textContent.trim() : '') || el.title || nestedImageAlt;
  };
  const describe = el => ({
    tag: el.tagName.toLowerCase(), id: el.id || undefined,
    class: typeof el.className === 'string' ? el.className : undefined,
    name: name(el).slice(0, 100),
    text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100),
  });
  // A descendant extending beyond an intentionally scrollable chip/catalog row
  // is valid only when the scroll container itself fits the viewport.
  const intentionallyScrollable = el => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const css = getComputedStyle(a);
      const r = a.getBoundingClientRect();
      if (['auto', 'scroll'].includes(css.overflowX) && r.left >= -1 && r.right <= vw + 1) return true;
    }
    return false;
  };
  const elements = [...document.body.querySelectorAll('*')].filter(visible);
  const overflow = elements.filter(el => {
    if (['SCRIPT', 'STYLE', 'SVG', 'PATH', 'LINE', 'POLYLINE', 'CIRCLE'].includes(el.tagName)) return false;
    if (el.classList.contains('skip-link') || el.classList.contains('sr-only')) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && (r.left < -1 || r.right > vw + 1) && !intentionallyScrollable(el);
  }).map(el => ({...describe(el), left: Math.round(el.getBoundingClientRect().left), right: Math.round(el.getBoundingClientRect().right)}));
  const unnamed = elements.filter(el => el.matches('button, input:not([type="hidden"]):not([type="file"]), select, textarea, a[href], [role="button"]')).filter(el => !name(el)).map(describe);
  const smallTargets = elements.filter(el => el.matches('button, [role="button"]')).filter(el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && (r.width < 43.5 || r.height < 43.5);
  }).map(el => ({...describe(el), width: Math.round(el.getBoundingClientRect().width), height: Math.round(el.getBoundingClientRect().height)}));
  const failedImages = [...document.images].filter(visible).filter(i => i.complete && i.naturalWidth === 0).map(i => ({src: i.currentSrc || i.src, alt: i.alt}));
  return {viewport: vw, documentWidth: document.documentElement.scrollWidth, overflow, unnamed, smallTargets, failedImages, visibleImages: [...document.images].filter(visible).length};
}"""


def main():
    report = {"url": BASE_URL, "widths": WIDTHS, "runs": [], "consoleErrors": [], "pageErrors": [], "requestFailures": []}
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"), headless=True, args=["--no-sandbox"])
        for width in WIDTHS:
            context = browser.new_context(viewport={"width": width, "height": 900 if width > 600 else 800}, locale="es-ES", timezone_id="UTC", reduced_motion="reduce")
            page = context.new_page()
            page.on("console", lambda msg: report["consoleErrors"].append(msg.text) if msg.type == "error" else None)
            page.on("pageerror", lambda error: report["pageErrors"].append(str(error)))
            page.on("requestfailed", lambda request: report["requestFailures"].append({"url": request.url, "failure": request.failure}))
            page.goto(BASE_URL, wait_until="networkidle")
            page.get_by_role("button", name="Inicio", exact=True).wait_for()
            for theme in ["oscuro", "claro"]:
                is_dark = page.locator("body").evaluate("el => el.classList.contains('dark-mode')")
                if is_dark != (theme == "oscuro"):
                    page.get_by_role("button", name=re.compile("Activar modo (claro|oscuro)")).click()
                    page.wait_for_timeout(150)
                for key, name in VIEWS:
                    page.get_by_role("button", name=name, exact=True).click()
                    page.wait_for_timeout(120)
                    page.evaluate("window.scrollTo(0,0)")
                    details = page.evaluate(INSPECT)
                    run = {"width": width, "theme": theme, "view": key, **details}
                    report["runs"].append(run)
                    page.screenshot(path=str(OUTPUT / f"{width}-{theme}-{key}.png"), full_page=True)
            context.close()
        browser.close()
    report["summary"] = {
        "screens": len(report["runs"]),
        "overflowScreens": sum(bool(r["overflow"]) for r in report["runs"]),
        "unnamedControlScreens": sum(bool(r["unnamed"]) for r in report["runs"]),
        "smallTargetScreens": sum(bool(r["smallTargets"]) for r in report["runs"]),
        "failedImageScreens": sum(bool(r["failedImages"]) for r in report["runs"]),
        "consoleErrors": len(report["consoleErrors"]),
        "pageErrors": len(report["pageErrors"]),
    }
    (OUTPUT / "responsive-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    unique = {}
    for run in report["runs"]:
        for key in ["overflow", "unnamed", "smallTargets", "failedImages"]:
            for item in run[key]:
                signature = json.dumps(item, ensure_ascii=False, sort_keys=True)
                unique.setdefault((key, signature), {"kind": key, "first": {k: run[k] for k in ["width", "theme", "view"]}, "element": item})
    print(json.dumps(list(unique.values())[:60], ensure_ascii=False, indent=2))
    return 1 if any(report["summary"][k] for k in ["overflowScreens", "unnamedControlScreens", "failedImageScreens", "consoleErrors", "pageErrors"]) else 0


if __name__ == "__main__":
    raise SystemExit(main())
