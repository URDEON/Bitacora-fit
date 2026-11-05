"""Graphite/glass UI, real theme preferences, accessible sheets and metric history.

Run with BITACORA_URL pointing to Vite or preview. Browser fixtures are ephemeral;
no test records or APIs are included in the application.
"""
import json
import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

from browser_home import (
    DB_KEY, IDS, database, navigate, open_seeded, select_metric, text_contrast,
)

BASE_URL = os.environ.get("BITACORA_URL", "http://127.0.0.1:5173")
APPEARANCE_KEY = "bitacora_fit_appearance_v1"
ARTIFACTS = Path("artifacts/glass")
ROLES = {
    "primary": "Color principal", "fit": "Fit", "finance": "Finanzas", "notes": "Notas",
    "tools": "Herramientas", "icons": "Iconos", "charts": "Gráficos", "calendar": "Calendario",
    "progress": "Barras de progreso", "active": "Botones activos",
}


def theme(page, dark):
    current = bool(page.locator("body.dark-mode").count())
    if current != dark:
        page.get_by_role("button", name="Activar modo oscuro" if dark else "Activar modo claro", exact=True).click()
    expect(page.locator("body")).to_have_class("dark-mode" if dark else "")
    page.wait_for_timeout(280)


def style(locator):
    return locator.evaluate("""el => { const s=getComputedStyle(el); return {
      background:s.backgroundColor, blur:s.backdropFilter || s.webkitBackdropFilter,
      border:s.borderTopColor, shadow:s.boxShadow, image:s.backgroundImage
    }; }""")


def alpha(color):
    if color.startswith("rgba"):
        return float(color.split(",")[-1].rstrip(") "))
    return 1


def assert_glass(locator, case):
    actual = style(locator)
    assert "blur(" in actual["blur"] and "0px" not in actual["blur"], (case, actual)
    assert 0 < alpha(actual["background"]) < .95, (case, actual)
    assert actual["shadow"] != "none", (case, actual)
    return actual


def assert_bounds(page, case):
    assert not page.evaluate("document.documentElement.scrollWidth > innerWidth"), case
    stage = page.locator(".tab-stage:visible")
    expect(stage).to_have_count(1)
    expect(stage.locator("h1")).to_be_visible()
    nav = page.get_by_role("navigation", name="Navegación principal", exact=True)
    rect = nav.bounding_box()
    assert rect["x"] >= -1 and rect["x"] + rect["width"] <= page.viewport_size["width"] + 1, (case, rect)
    for button in nav.get_by_role("button").all():
        rect = button.bounding_box()
        assert rect["width"] >= 43.8 and rect["height"] >= 43.8, (case, button.get_attribute("aria-label"), rect)
    # Essential text and controls must remain readable after transparent compositing.
    assert text_contrast(stage.locator("h1")) >= 4.5, (case, "heading contrast")
    assert text_contrast(nav.locator(".glass-nav-item.active")) >= 4.5, (case, "navigation contrast")
    if stage.locator(".metric-footer").count():
        link = stage.locator(".metric-footer").get_by_role("button", name="Ver registros", exact=False).bounding_box()
        fab = page.get_by_role("button", name="Registro rápido", exact=True).bounding_box()
        horizontal = min(link["x"] + link["width"], fab["x"] + fab["width"]) - max(link["x"], fab["x"])
        vertical = min(link["y"] + link["height"], fab["y"] + fab["height"]) - max(link["y"], fab["y"])
        assert horizontal <= .5 or vertical <= .5, (case, "quick trigger overlaps metric records", link, fab)


def short_pause(page):
    page.wait_for_timeout(320)


def main():
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    errors, checks = [], []
    layouts = screenshots = 0
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True, args=["--no-sandbox"])
        try:
            fresh = browser.new_context(viewport={"width": 360, "height": 844}, locale="es-CL", has_touch=True)
            page = fresh.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(BASE_URL)
            page.locator(".metric-orbit").wait_for()
            expect(page.locator("body")).to_have_class("dark-mode")
            # A pristine DB is persisted after its first real edit, not on mount.
            assert page.evaluate("key => JSON.parse(localStorage.getItem(key) || 'null')?.workouts?.length ?? 0", DB_KEY) == 0
            expect(page.get_by_test_id("metric-value")).to_have_text("0")
            fresh.close()
            checks.append("new installations start in graphite without invented records")

            db = database()
            db["darkMode"] = True
            context, page = open_seeded(browser, db, errors)
            before = page.evaluate("key => JSON.stringify(JSON.parse(localStorage.getItem(key)))", DB_KEY)
            navigate(page, "Apariencia")
            expect(page.locator(".appearance-panel")).to_be_visible()
            expect(page.get_by_role("textbox", name="Código HEX de Color principal", exact=True)).to_be_visible()
            assert page.get_by_role("textbox", name="Código HEX", exact=False).count() == 10
            backgrounds = {}
            for dark in [True, False]:
                theme(page, dark)
                before_colors = page.evaluate("key => JSON.stringify(JSON.parse(localStorage.getItem(key)))", DB_KEY)
                backgrounds[dark] = page.locator("body").evaluate("el => getComputedStyle(el).backgroundColor")
                for role, label in ROLES.items():
                    field = page.get_by_role("textbox", name=f"Código HEX de {label}", exact=True)
                    for picked in ["#000000", "#FFFFFF"]:
                        field.fill(picked)
                        field.blur()
                        expect(field).to_have_value(picked)
                        assert page.evaluate("role => document.body.style.getPropertyValue('--custom-' + role + '-raw').trim()", role) == picked
                        assert page.locator("body").evaluate("el => getComputedStyle(el).backgroundColor") == backgrounds[dark]
                assert page.evaluate("key => JSON.stringify(JSON.parse(localStorage.getItem(key)))", DB_KEY) == before_colors
                assert text_contrast(page.locator(".appearance-preview-button")) >= 4.5
                assert text_contrast(page.locator(".glass-nav-item.active")) >= 4.5
            checks.extend(["all ten HEX roles update live", "black and white accents remain legible in both themes", "chosen accents do not tint the neutral canvas", "appearance edits do not mutate Fit records"])
            invalid = page.get_by_role("textbox", name="Código HEX de Color principal", exact=True)
            invalid.fill("#ZZZZZZ")
            invalid.blur()
            expect(invalid).to_have_attribute("aria-invalid", "true")
            expect(page.get_by_role("alert").filter(has_text="HEX válido")).to_be_visible()
            invalid.fill("#A6B8C2")
            invalid.blur()
            expect(invalid).to_have_attribute("aria-invalid", "false")
            page.reload()
            navigate(page, "Apariencia")
            expect(page.get_by_role("textbox", name="Código HEX de Color principal", exact=True)).to_have_value("#A6B8C2")
            assert page.evaluate("key => JSON.parse(localStorage.getItem(key)).colors.primary", APPEARANCE_KEY) == "#A6B8C2"
            checks.append("invalid HEX is rejected and preferences persist through reload")
            page.locator(".appearance-panel").get_by_role("button", name="Restablecer", exact=True).click()
            theme(page, True)

            print("Glass: native quick sheet and real actions", flush=True)
            navigate(page, "Inicio")
            page.get_by_label("Fecha de los registros", exact=True).fill("2026-11-03")
            select_metric(page, 1)
            short_pause(page)
            assert_glass(page.locator(".glass-nav"), "dock")
            assert_glass(page.locator(".metric-orbit"), "measurement")
            open_sheet = page.get_by_role("button", name="Registro rápido", exact=True)
            open_sheet.click()
            sheet = page.get_by_role("dialog", name="Registro rápido", exact=True)
            expect(sheet).to_be_visible()
            assert page.evaluate("document.activeElement?.closest('dialog')?.open === true")
            assert_glass(page.locator(".quick-register-dialog"), "sheet")
            page.keyboard.press("Shift+Tab")
            # A native dialog can yield focus to browser chrome. It must never
            # yield to an interactive element in the inert application behind it.
            assert sheet.evaluate("el => el.matches(':modal')")
            assert page.evaluate("document.activeElement === document.body || document.activeElement?.closest('dialog')?.open === true")
            page.keyboard.press("Tab")
            assert page.evaluate("document.activeElement?.closest('dialog')?.open === true")
            page.keyboard.press("Escape")
            expect(sheet).not_to_be_visible()
            expect(open_sheet).to_be_focused()
            open_sheet.click()
            sheet.get_by_role("button", name="Añadir 250 ml de agua", exact=False).click()
            expect(sheet).not_to_be_visible()
            page.wait_for_function("key => JSON.parse(localStorage.getItem(key)).waterLogs.length === 4", arg=DB_KEY)
            last_water = page.evaluate("key => JSON.parse(localStorage.getItem(key)).waterLogs.at(-1)", DB_KEY)
            assert last_water["ml"] == 250 and last_water["date"] == "2026-11-03", last_water
            checks.extend(["dock orb and sheet use actual blur translucent surfaces rims and depth", "native modal traps focus and Escape restores trigger", "quick water action stores a real record on the selected date"])
            open_sheet.click()
            sheet.get_by_role("button", name="Registrar peso", exact=False).click()
            expect(page.locator("#body-weight")).to_be_focused()
            expect(page.locator("#weight-title")).to_be_visible()
            checks.append("quick weight opens and focuses the existing measurement form")

            print("Glass: historical chart is synchronized with the current metric and date", flush=True)
            navigate(page, "Inicio")
            for index, metric in enumerate(IDS):
                select_metric(page, index)
                history = page.locator(".metric-history")
                expect(history).to_have_attribute("data-history", metric)
                history.locator("summary").click()
                expect(history.locator("tbody tr")).to_have_count(7)
                expect(history.locator("tbody tr").last).to_have_attribute("aria-current", "date")
                history.locator("summary").click()
            select_metric(page, 1)
            history = page.locator(".metric-history")
            expect(history).to_contain_text("750")
            page.get_by_label("Fecha de los registros", exact=True).fill("2026-11-04")
            expect(history).to_contain_text("1500")
            checks.append("one real seven-day chart follows all four measurements and the selected date")

            print("Glass: fallback, reduced motion and responsive screen matrix", flush=True)
            navigate(page, "Apariencia")
            page.get_by_role("button", name="Efectos", exact=True).click()
            page.get_by_role("radio", name="Reducir transparencia", exact=False).check()
            expect(page.locator("html")).to_have_attribute("data-transparency", "reduced")
            assert style(page.locator(".glass-nav"))["blur"] == "none"
            assert alpha(style(page.locator(".glass-nav"))["background"]) == 1
            page.get_by_role("button", name="Registro rápido", exact=True).click()
            assert style(page.locator(".quick-register-dialog"))["blur"] == "none"
            assert alpha(style(page.locator(".quick-register-dialog"))["background"]) == 1
            page.keyboard.press("Escape")
            page.get_by_role("radio", name="Vidrio esmerilado", exact=False).check()
            page.get_by_role("radio", name="Reducir movimiento", exact=False).check()
            navigate(page, "Inicio")
            select_metric(page, 2)
            motions = page.locator(".metric-carousel, .metric-history, .glass-nav").evaluate_all("""els => els.flatMap(el => [el,...el.querySelectorAll('*')].flatMap(node => {
              const s=getComputedStyle(node); return [s.animationDuration,s.transitionDuration].flatMap(v=>v.split(',').map(x=>parseFloat(x)*(x.trim().endsWith('ms')?1:1000)));
            }))""")
            assert all(value <= 20 for value in motions), motions
            checks.extend(["reduced transparency uses opaque surfaces and disables blur", "user reduced motion removes new transitions"])
            navigate(page, "Apariencia")
            page.get_by_role("radio", name="Seguir el dispositivo", exact=False).check()
            page.emulate_media(reduced_motion="reduce")
            page.get_by_role("button", name="Registro rápido", exact=True).click()
            assert not page.locator(".quick-register-surface").evaluate("el=>el.getAnimations().some(a=>a.effect.getTiming().duration>20)")
            page.keyboard.press("Escape")
            page.emulate_media(reduced_motion="no-preference")
            checks.append("operating system reduced motion is respected")

            screens = ["Inicio", "Entrenar", "Finanzas", "Notas", "Herramientas", "Apariencia"]
            for width in [320, 360, 412, 768]:
                page.set_viewport_size({"width": width, "height": 844})
                for dark in [True, False]:
                    theme(page, dark)
                    for screen in screens:
                        navigate(page, screen)
                        if screen == "Inicio":
                            page.get_by_label("Fecha de los registros", exact=True).fill("2026-11-03")
                            select_metric(page, 1)
                        short_pause(page)
                        page.evaluate("document.activeElement?.blur(); window.scrollTo(0,0)")
                        assert_bounds(page, (width, dark, screen))
                        layouts += 1
                        if (width == 360 and dark) or (width == 320 and not dark):
                            name = {"Inicio":"home","Entrenar":"fit","Finanzas":"finance","Notas":"notes","Herramientas":"tools","Apariencia":"appearance"}[screen]
                            page.screenshot(path=str(ARTIFACTS / f"{name}-{'dark' if dark else 'light'}-{width}.png"), full_page=True)
                            screenshots += 1
            # Include a clean sheet capture after real background content has loaded.
            page.set_viewport_size({"width": 360, "height": 844})
            theme(page, True)
            navigate(page, "Inicio")
            page.get_by_role("button", name="Registro rápido", exact=True).click()
            short_pause(page)
            page.screenshot(path=str(ARTIFACTS / "quick-register-dark-360.png"))
            screenshots += 1
            page.keyboard.press("Escape")
            checks.append("six coherent screens at 320 360 412 and 768 px in both themes with accessible navigation")
            assert not errors, errors
            result = {"status": "passed", "checks": checks, "layouts": layouts, "screenshots": screenshots, "page_errors": errors}
            (ARTIFACTS / "results.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
            print(json.dumps(result, ensure_ascii=False))
            context.close()
        except Exception:
            if browser.contexts and browser.contexts[-1].pages:
                failed = browser.contexts[-1].pages[-1]
                failed.screenshot(path=str(ARTIFACTS / "failure.png"), full_page=True)
                print(json.dumps({"page_errors": errors, "visible_headings": failed.locator("h1:visible, h2:visible").all_text_contents()}, ensure_ascii=False), flush=True)
            raise
        finally:
            browser.close()


if __name__ == "__main__":
    main()
