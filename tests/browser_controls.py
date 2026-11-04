"""Controles de medición, navegación y movimiento con tamaños de teléfono reales.

BITACORA_URL=http://127.0.0.1:5173 python tests/browser_controls.py
Requiere Playwright Python y Chromium. Usa un perfil vacío y no toca datos del usuario.
"""
import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright, expect


BASE_URL = os.environ.get("BITACORA_URL", "http://127.0.0.1:5173")
ARTIFACTS = Path("artifacts/controls")
ARTIFACTS.mkdir(parents=True, exist_ok=True)
WIDTHS = [320, 360, 384, 390, 412, 540, 620, 768]
FONTS = [100, 125, 150]
MODES = {"strength": "Pesas", "cardio": "Cardio / Bici", "time": "Tiempo / Abs"}


MEASURE_CONTROLS = """rows => rows.map(row => {
  const box = el => {
    const r = el.getBoundingClientRect();
    return { x:r.x, y:r.y, right:r.right, bottom:r.bottom, width:r.width, height:r.height };
  };
  const label = row.querySelector('.lbl');
  const controls = [...row.querySelectorAll('.stepper-row > *')];
  return {
    label: label?.textContent.trim(), container: box(row), labelBox: label ? box(label) : null,
    scroll: row.scrollWidth, client: row.clientWidth,
    controls: controls.map(el => {
      const s = getComputedStyle(el);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.font = s.font;
      return {
        tag:el.tagName, type:el.type, value:el.value || el.textContent.trim(), rect:box(el),
        textWidth:ctx.measureText(el.value || '').width,
        horizontalPadding:parseFloat(s.paddingLeft) + parseFloat(s.paddingRight),
      };
    }),
  };
})"""


def overlap(a, b):
    return min(a["right"], b["right"]) - max(a["x"], b["x"]) > 1 and min(a["bottom"], b["bottom"]) - max(a["y"], b["y"]) > 1


def control_errors(rows):
    issues = []
    for row in rows:
        bounds = row["container"]
        if row["scroll"] > row["client"] + 1:
            issues.append(f"{row['label']}: contenido desborda su contenedor")
        for item in row["controls"]:
            r = item["rect"]
            if r["x"] < bounds["x"] - 1 or r["right"] > bounds["right"] + 1 or r["y"] < bounds["y"] - 1 or r["bottom"] > bounds["bottom"] + 1:
                issues.append(f"{row['label']}: {item['tag']} {item['value']} fuera del contenedor")
            if row["labelBox"] and overlap(row["labelBox"], r):
                issues.append(f"{row['label']}: etiqueta pisa {item['tag']} {item['value']}")
            if item["tag"] == "BUTTON" and (r["width"] < 43.9 or r["height"] < 43.9):
                issues.append(f"{row['label']}: botón menor de 44px")
            if item["tag"] == "INPUT":
                if r["width"] < 40:
                    issues.append(f"{row['label']}: campo de valor menor de 40px")
                if item["textWidth"] + item["horizontalPadding"] > r["width"] + 1:
                    issues.append(f"{row['label']}: el valor {item['value']} no cabe")
        for index, item in enumerate(row["controls"]):
            for other in row["controls"][index + 1:]:
                if overlap(item["rect"], other["rect"]):
                    issues.append(f"{row['label']}: controles solapados")
    return issues


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True, args=["--no-sandbox"])
    context = browser.new_context(viewport={"width": 384, "height": 850}, locale="es-CL")
    page = context.new_page()
    js_errors = []
    page.on("pageerror", lambda error: js_errors.append(str(error)))
    try:
        page.goto(BASE_URL)
        nav = page.get_by_role("navigation", name="Navegación principal")
        nav.get_by_role("button", name="Entrenar", exact=True).click()
        cases = []
        failures = []

        for font in FONTS:
            page.evaluate("font => document.documentElement.style.fontSize = font + '%'", font)
            for width in WIDTHS:
                page.set_viewport_size({"width": width, "height": 950})
                for mode, text in MODES.items():
                    page.locator(".mode-card:visible").filter(has_text=text).click()
                    if mode == "time":
                        page.get_by_label("Segundos por serie", exact=True).fill("86400")
                    rows = page.locator(".number-stepper:visible").evaluate_all(MEASURE_CONTROLS)
                    issues = control_errors(rows)
                    if page.evaluate("document.documentElement.scrollWidth > innerWidth"):
                        issues.append("desbordamiento de la página")
                    case = {"mode": mode, "width": width, "font_percent": font, "issues": issues}
                    cases.append(case)
                    if issues:
                        failures.append(case)

        if failures:
            (ARTIFACTS / "controls-failures.json").write_text(json.dumps(failures, ensure_ascii=False, indent=2))
            raise AssertionError(json.dumps(failures[:8], ensure_ascii=False))
        (ARTIFACTS / "measurement-cases.json").write_text(json.dumps(cases, ensure_ascii=False, indent=2))

        # Exercise the very fields in the user screenshot, including upper bounds.
        page.evaluate("document.documentElement.style.fontSize = '100%'")
        page.set_viewport_size({"width": 384, "height": 850})
        page.locator(".mode-card:visible").filter(has_text="Tiempo / Abs").click()
        seconds = page.get_by_label("Segundos por serie", exact=True)
        seconds_row = page.locator(".number-stepper:visible").filter(has=seconds)
        seconds.fill("15")
        seconds_row.locator("button").last.click()
        expect(seconds).to_have_value("30")
        seconds_row.locator("button").first.click()
        expect(seconds).to_have_value("15")
        seconds.fill("86400")
        expect(seconds_row.locator("button").last).to_be_disabled()
        expect(seconds).to_have_value("86400")
        count = page.get_by_label("Series por duración", exact=True)
        count.fill("")
        count.fill("3")
        page.get_by_role("button", name="Añadir serie por tiempo", exact=True).click()
        expect(count).to_have_value("4")
        page.get_by_role("button", name="Quitar serie por tiempo", exact=True).click()
        expect(count).to_have_value("3")

        seconds.fill("15")
        count.scroll_into_view_if_needed()
        page.screenshot(path=str(ARTIFACTS / "time-controls-384.png"))

        # The independent clock reuses the same controls for custom rests and HIIT.
        page.get_by_role("button", name="Cronómetro y descanso", exact=True).click()
        page.evaluate("document.documentElement.style.fontSize = '150%'")
        chrono_cases = []
        for width in [320, 390]:
            page.set_viewport_size({"width": width, "height": 950})
            for mode in ["Descanso", "HIIT / Tabata"]:
                page.locator(".mode-card:visible").filter(has_text=mode).click()
                rows = page.locator(".number-stepper:visible").evaluate_all(MEASURE_CONTROLS)
                issues = control_errors(rows)
                assert rows and not issues, ("clock", mode, width, issues)
                assert not page.evaluate("document.documentElement.scrollWidth > innerWidth"), ("clock", mode, width)
                chrono_cases.append({"mode": mode, "width": width, "font_percent": 150})
        page.evaluate("document.documentElement.style.fontSize = '100%'")
        nav.get_by_role("button", name="Entrenar", exact=True).click()

        # Labels remain accessible even when inactive navigation labels are visually compact.
        labels = ["Inicio", "Entrenar", "Alimentación", "Progreso", "Ajustes"]
        for width in [320, 384, 768]:
            page.set_viewport_size({"width": width, "height": 850})
            for label in labels:
                button = nav.get_by_role("button", name=label, exact=True)
                button.click()
                expect(button).to_have_attribute("aria-current", "page")
                bounds = button.bounding_box()
                assert bounds["width"] >= 43.9 and bounds["height"] >= 43.9, (label, width, bounds)
                nav_bounds = nav.bounding_box()
                assert nav_bounds["x"] >= -1 and nav_bounds["x"] + nav_bounds["width"] <= width + 1, (label, width, nav_bounds)
                assert page.locator(".tab-stage:visible").count() == 1

        # Simulate a native bottom system inset. It must sit outside the capsule,
        # rather than turning the entire dock into a tall empty block.
        nav.get_by_role("button", name="Entrenar", exact=True).click()
        page.set_viewport_size({"width": 384, "height": 850})
        page.evaluate("document.documentElement.style.setProperty('--safe-area-inset-bottom', '48px')")
        page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
        nav_bounds = nav.bounding_box()
        assert nav_bounds["height"] <= 100, nav_bounds
        assert nav_bounds["y"] + nav_bounds["height"] <= 850 - 47, nav_bounds
        last_section = page.locator(".tab-stage:visible .card-cut").last.bounding_box()
        assert last_section["y"] + last_section["height"] <= nav_bounds["y"] + 1, (last_section, nav_bounds)
        page.evaluate("document.documentElement.style.removeProperty('--safe-area-inset-bottom')")

        # The tactile animation changes the actual pressed transform, not only
        # a class name. It must disappear under the platform motion preference.
        press_button = page.get_by_role("button", name="Añadir serie por tiempo", exact=True)
        press_button.scroll_into_view_if_needed()
        page.mouse.move(1, 1)
        resting_transform = press_button.evaluate("el => getComputedStyle(el).transform")
        pos = press_button.bounding_box()
        page.mouse.move(pos["x"] + pos["width"] / 2, pos["y"] + pos["height"] / 2)
        page.mouse.down()
        press_button.evaluate("el => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
        pressed_transform = press_button.evaluate("el => getComputedStyle(el).transform")
        assert pressed_transform != "none" and pressed_transform != resting_transform, (resting_transform, pressed_transform)
        page.mouse.up()

        # New glass and depth effects must honor the platform motion setting.
        page.emulate_media(reduced_motion="reduce")
        nav.get_by_role("button", name="Inicio", exact=True).click()
        nav.get_by_role("button", name="Entrenar", exact=True).click()
        motion = page.locator("nav[aria-label='Navegación principal'], nav[aria-label='Navegación principal'] button, .step-circle:visible").evaluate_all("""els => els.map(el => {
          const s = getComputedStyle(el);
          return { element:el.tagName, transition:s.transitionDuration, animation:s.animationDuration, name:s.animationName };
        })""")
        for item in motion:
            def seconds_list(value):
                return [float(x.strip().replace("ms", "")) / 1000 if "ms" in x else float(x.strip().replace("s", "")) for x in value.split(",")]
            assert max(seconds_list(item["transition"])) <= .01, item
            if item["name"] != "none":
                assert max(seconds_list(item["animation"])) <= .01, item
        press_button.scroll_into_view_if_needed()
        pos = press_button.bounding_box()
        page.mouse.move(pos["x"] + pos["width"] / 2, pos["y"] + pos["height"] / 2)
        page.mouse.down()
        press_button.evaluate("el => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
        assert press_button.evaluate("el => getComputedStyle(el).transform") == "none"
        page.mouse.up()
        page.emulate_media(reduced_motion="no-preference")

        page.evaluate("document.documentElement.dataset.motion = 'reduced'")
        assert press_button.evaluate("el => getComputedStyle(el).transitionDuration") == "0s"
        page.evaluate("delete document.documentElement.dataset.motion")

        assert not js_errors, js_errors
        result = {"status": "passed", "measurement_cases": len(cases), "chrono_cases": chrono_cases, "widths": WIDTHS, "font_percent": FONTS, "modes": list(MODES), "checks": ["container bounds", "label overlap", "44px targets", "readable values", "time increments and limits", "custom rest and HIIT controls", "all navigation tabs", "native bottom inset", "3D press transform", "OS and app reduced motion"], "page_errors": js_errors}
        (ARTIFACTS / "results.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
        print(json.dumps(result, ensure_ascii=False))
    finally:
        context.close()
        browser.close()
