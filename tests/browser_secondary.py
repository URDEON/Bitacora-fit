"""Responsive checks for secondary panels and the exercise guide.

Run after the app server starts: python3 tests/browser_secondary.py [URL]
No records are created; each run uses an isolated browser context.
"""
from pathlib import Path
import json
import os
import re
import sys
from playwright.sync_api import sync_playwright
from browser_responsive import INSPECT

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "artifacts" / "QA"
OUTPUT.mkdir(parents=True, exist_ok=True)
URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5173"


def main():
    report = {"runs": [], "consoleErrors": [], "pageErrors": []}
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"), headless=True, args=["--no-sandbox"])
        for width in [320, 412, 1280]:
            context = browser.new_context(viewport={"width": width, "height": 800}, locale="es-ES", timezone_id="UTC", reduced_motion="reduce")
            page = context.new_page()
            page.on("console", lambda msg: report["consoleErrors"].append(msg.text) if msg.type == "error" else None)
            page.on("pageerror", lambda error: report["pageErrors"].append(str(error)))
            page.goto(URL, wait_until="networkidle")
            page.get_by_role("button", name="Inicio", exact=True).wait_for()
            for theme in ["oscuro", "claro"]:
                is_dark = page.locator("body").evaluate("el => el.classList.contains('dark-mode')")
                if is_dark != (theme == "oscuro"):
                    page.get_by_role("button", name=re.compile("Activar modo (claro|oscuro)")).click()

                def capture(key):
                    page.wait_for_timeout(100)
                    page.evaluate("window.scrollTo(0,0)")
                    report["runs"].append({"width": width, "theme": theme, "view": key, **page.evaluate(INSPECT)})
                    (OUTPUT / "secondary-partial.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
                    page.screenshot(path=str(OUTPUT / f"secondary-{width}-{theme}-{key}.png"), full_page=True)

                page.get_by_role("button", name="Entrenar", exact=True).click()
                page.get_by_role("button", name=re.compile("^RUTINAS GUARDADAS")).click()
                capture("rutinas")
                page.get_by_role("button", name=re.compile("^Editar rutina ")).first.click()
                capture("editor-rutina")
                page.get_by_role("button", name="Cerrar editor de rutina", exact=True).click()
                page.get_by_role("button", name=re.compile("^CATÁLOGO VISUAL Y ANOTAR")).click()
                page.get_by_role("button", name=re.compile(r"^CARDIO \/ BICI.*Minutos", re.S)).click()
                capture("registro-cardio")
                page.get_by_role("button", name=re.compile(r"^TIEMPO \/ ABS")).click()
                capture("registro-tiempo")
                page.get_by_role("button", name=re.compile("^Abrir guía de ")).first.click()
                capture("guia-ejercicio")
                page.get_by_role("button", name="Cerrar", exact=True).click()

                page.get_by_role("button", name="Alimentación", exact=True).click()
                page.get_by_role("button", name=re.compile("^CALCULAR POR GRAMOS")).click()
                capture("calculadora-nutricion")
                page.get_by_role("button", name="+ Nuevo alimento", exact=True).click()
                capture("nuevo-alimento")
                page.get_by_role("button", name="Cerrar", exact=True).click()

                page.get_by_role("button", name="Progreso", exact=True).click()
                page.get_by_role("button", name="Gráficos Fuerza/Kcal", exact=True).click()
                capture("graficos")
                page.get_by_role("button", name="Consistencia y Stats", exact=True).click()
                capture("calendario")
                page.get_by_role("button", name=re.compile("^Historial ")).click()
                capture("historial")

                page.get_by_role("button", name="Cronómetro y descanso", exact=True).click()
                page.get_by_role("button", name=re.compile("^LIBRE.*Cardio", re.S)).click()
                capture("cronometro-libre")
                page.get_by_role("button", name=re.compile(r"^HIIT \/ TABATA")).click()
                capture("hiit")
            context.close()
        browser.close()
    summary = {"screens": len(report["runs"])}
    for key in ["overflow", "unnamed", "smallTargets", "failedImages"]:
        summary[key + "Screens"] = sum(bool(r[key]) for r in report["runs"])
    summary["consoleErrors"] = len(report["consoleErrors"])
    summary["pageErrors"] = len(report["pageErrors"])
    report["summary"] = summary
    (OUTPUT / "secondary-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    unique = {}
    for run in report["runs"]:
        for key in ["overflow", "unnamed", "smallTargets", "failedImages"]:
            for item in run[key]:
                signature = json.dumps(item, ensure_ascii=False, sort_keys=True)
                unique.setdefault((key, signature), {"kind": key, "first": {k: run[k] for k in ["width", "theme", "view"]}, "element": item})
    print(json.dumps(list(unique.values())[:50], ensure_ascii=False, indent=2))
    return 1 if any(summary[k] for k in ["overflowScreens", "unnamedScreens", "failedImagesScreens", "consoleErrors", "pageErrors"]) else 0


if __name__ == "__main__":
    raise SystemExit(main())
