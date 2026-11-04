"""Home real: datos, carrusel táctil, hero, accesibilidad y seis vistas móviles.

Requiere Vite/preview en BITACORA_URL (por defecto http://127.0.0.1:5173),
Playwright Python y Chromium. Los registros de prueba viven sólo en contextos
efímeros; no se añade ninguna API ni dato ficticio a la aplicación.
"""
import json
import os
import re
from pathlib import Path

from playwright.sync_api import sync_playwright, expect


BASE_URL = os.environ.get("BITACORA_URL", "http://127.0.0.1:5173")
DB_KEY = "bitacora_fit_s20fe_v5"
ARTIFACTS = Path("artifacts/home")
METRICS = ["Entrenamientos", "Hidratación", "Energía", "Proteína"]
IDS = ["training", "water", "energy", "protein"]
TABS = ["Inicio", "Entrenar", "Alimentación", "Progreso", "Ajustes"]


def workout(identifier, date, name="Press de banca"):
    return {"id": identifier, "date": date, "time": "10:00", "name": name,
            "category": "Pecho", "mode": "strength", "sets": 3, "reps": 8, "weight": 40}


def database():
    return {
        "version": 5, "updatedAt": 1, "darkMode": False,
        "goals": {"calories": 2000, "proteinG": 120, "waterMl": 1000,
                  "weeklyWorkoutDays": 4, "targetWeightKg": 75},
        "workouts": [workout(1, "2026-11-02"), workout(2, "2026-11-02"),
                     workout(3, "2026-11-04", "Press con mancuernas"),
                     workout(4, "2026-11-01", "Remo anterior")],
        "meals": [
            {"id": 10, "date": "2026-11-04", "time": "08:00", "mealType": "Desayuno",
             "desc": "Avena", "calories": 600.4, "protein": 40.24},
            {"id": 11, "date": "2026-11-04", "time": "13:00", "mealType": "Almuerzo",
             "desc": "Pollo", "calories": 899.6, "protein": 49.76},
            {"id": 12, "date": "2026-11-03", "time": "08:00", "mealType": "Desayuno",
             "desc": "Huevos", "calories": 500, "protein": 30},
        ],
        "waterLogs": [
            {"id": 20, "date": "2026-11-04", "time": "08:00", "ml": 1000, "label": "Agua"},
            {"id": 21, "date": "2026-11-04", "time": "13:00", "ml": 500, "label": "Agua"},
            {"id": 22, "date": "2026-11-03", "time": "08:00", "ml": 500, "label": "Agua"},
        ],
        "bodyMetrics": [], "routines": [], "activeSession": None, "workoutSessions": [],
    }


def open_seeded(browser, db, errors, reduced_motion="no-preference"):
    context = browser.new_context(viewport={"width": 360, "height": 844},
                                  locale="es-CL", has_touch=True,
                                  reduced_motion=reduced_motion)
    # Only seed the first visit: reloads must use the app's actual persistence.
    context.add_init_script("""(() => {
      if (!sessionStorage.getItem('home-test-seeded')) {
        localStorage.setItem(%s, %s);
        sessionStorage.setItem('home-test-seeded', 'yes');
      }
    })();""" % (json.dumps(DB_KEY), json.dumps(json.dumps(db))))
    page = context.new_page()
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE_URL)
    page.get_by_role("region", name="Mediciones del día", exact=True).wait_for()
    page.get_by_label("Fecha de los registros", exact=True).fill("2026-11-04")
    return context, page


def carousel(page):
    return page.get_by_role("region", name="Mediciones del día", exact=True)


def active_panel(page, index):
    root = carousel(page)
    expect(root.get_by_role("group")).to_have_count(1)
    panel = root.get_by_role("group", name=METRICS[index], exact=True)
    expect(panel).to_be_visible()
    expect(panel).to_have_attribute("data-metric", IDS[index])
    return panel


def value_as_number(locator):
    text = re.sub(r"[^\d.,-]", "", locator.inner_text())
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    elif re.fullmatch(r"-?\d{1,3}(\.\d{3})+", text):
        text = text.replace(".", "")
    return float(text)


def assert_metric(page, index, value, percent, ring):
    panel = active_panel(page, index)
    expect(panel.get_by_test_id("metric-value")).to_be_visible()
    assert value_as_number(panel.get_by_test_id("metric-value")) == value
    expect(panel.get_by_test_id("metric-percent")).to_contain_text(re.compile(rf"\b{percent}\s*%"))
    expect(panel.get_by_role("progressbar")).to_have_attribute("aria-valuenow", str(ring))


def select_metric(page, index):
    carousel(page).get_by_role("button", name=f"Ver {METRICS[index]}", exact=True).click()
    active_panel(page, index)


def touch_drag(page, dx, dy=0):
    panel = carousel(page).get_by_role("group")
    panel.scroll_into_view_if_needed()
    box = panel.bounding_box()
    # Stay inside the circle; native touch input generates the Android-style
    # Pointer Events, including pointercancel when vertical scrolling takes over.
    x = box["x"] + box["width"] / 2 - dx / 2
    y = box["y"] + box["height"] / 2 - dy / 2
    session = page.context.new_cdp_session(page)
    def point(px, py):
        return [{"x": px, "y": py, "radiusX": 4, "radiusY": 4, "force": 1, "id": 1}]
    session.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": point(x, y)})
    for step in range(1, 9):
        session.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": point(x + dx * step / 8, y + dy * step / 8)})
        page.wait_for_timeout(18)
    session.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    session.detach()


def assert_home_structure(page):
    root = carousel(page)
    expect(root).to_have_attribute("aria-roledescription", "carrusel")
    for name in METRICS:
        expect(root.get_by_role("button", name=f"Ver {name}", exact=True)).to_be_visible()
    expect(root.get_by_role("button", name="Medición anterior", exact=True)).to_be_visible()
    expect(root.get_by_role("button", name="Medición siguiente", exact=True)).to_be_visible()
    navigation = page.get_by_role("navigation", name="Navegación principal", exact=True)
    for tab in TABS:
        expect(navigation.get_by_role("button", name=tab, exact=True)).to_be_visible()
    assert root.get_by_role("group").evaluate("""el => {
      while (el) { if (getComputedStyle(el).touchAction.includes('pan-y')) return true; el = el.parentElement; }
      return false;
    }"""), "El carrusel debe permitir desplazamiento vertical nativo"


def text_contrast(locator):
    """WCAG relative luminance, compositing CSS surface alpha over ancestors."""
    return locator.evaluate("""el => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const rgba = color => { ctx.clearRect(0,0,1,1); ctx.fillStyle = color; ctx.fillRect(0,0,1,1); return [...ctx.getImageData(0,0,1,1).data]; };
      const blend = (front, back) => front.slice(0,3).map((c,i) => c * front[3] / 255 + back[i] * (1 - front[3] / 255));
      const ancestors = []; let node = el;
      while(node) { ancestors.unshift(node); node = node.parentElement; }
      let background = [255,255,255];
      for(const ancestor of ancestors) background = blend(rgba(getComputedStyle(ancestor).backgroundColor), background);
      const foreground = blend(rgba(getComputedStyle(el).color), background);
      const luminance = rgb => rgb.map(v => { const s=v/255; return s <= .04045 ? s/12.92 : ((s+.055)/1.055)**2.4; }).reduce((sum,v,i) => sum+v*[.2126,.7152,.0722][i],0);
      const a=luminance(foreground), b=luminance(background);
      return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    }""")


def main():
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    errors, checks = [], []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True, args=["--no-sandbox"])
        try:
            context, page = open_seeded(browser, database(), errors)
            assert_home_structure(page)
            for index, expected in enumerate([(2, 50, 50), (1500, 150, 100), (1500, 75, 75), (90, 75, 75)]):
                select_metric(page, index)
                assert_metric(page, index, *expected)
            checks.extend(["four real metrics", "single visible panel", "pagination", "over 100 text and capped ring", "five accessible navigation tabs"])

            print("Home: native touch, keyboard and vertical scroll", flush=True)
            select_metric(page, 0)
            touch_drag(page, -110)
            active_panel(page, 1)
            touch_drag(page, 110)
            active_panel(page, 0)
            touch_drag(page, 110)
            active_panel(page, 3)
            touch_drag(page, -110)
            active_panel(page, 0)
            touch_drag(page, -12)
            active_panel(page, 0)
            active_panel(page, 0).focus()
            page.keyboard.press("ArrowRight")
            active_panel(page, 1)
            page.keyboard.press("ArrowLeft")
            active_panel(page, 0)
            carousel(page).get_by_role("button", name="Medición siguiente", exact=True).click()
            active_panel(page, 1)
            carousel(page).get_by_role("button", name="Medición anterior", exact=True).click()
            active_panel(page, 0)
            carousel(page).get_by_role("group").scroll_into_view_if_needed()
            before_scroll = page.evaluate("window.scrollY")
            touch_drag(page, 8, -120)
            active_panel(page, 0)
            page.wait_for_function("before => window.scrollY > before + 20", arg=before_scroll)
            checks.extend(["native left/right swipes", "circular wrap", "one step per gesture", "small movement ignored", "arrow keys", "previous/next buttons", "vertical touch scroll"])

            print("Home: real entry update and selected date", flush=True)
            select_metric(page, 1)
            page.get_by_role("button", name="Agua +250 ml", exact=True).click()
            assert_metric(page, 1, 1750, 175, 100)
            page.wait_for_function("key => JSON.parse(localStorage.getItem(key)).waterLogs.length === 4", arg=DB_KEY)
            close_message = page.get_by_role("button", name="Cerrar mensaje", exact=True)
            if close_message.count():
                close_message.click()
            page.get_by_label("Fecha de los registros", exact=True).fill("2026-11-03")
            assert_metric(page, 1, 500, 50, 50)
            for index, expected in [(0, (2, 50, 50)), (2, (500, 25, 25)), (3, (30, 25, 25))]:
                select_metric(page, index)
                assert_metric(page, index, *expected)
            page.get_by_label("Fecha de los registros", exact=True).fill("2026-11-01")
            select_metric(page, 0)
            assert_metric(page, 0, 1, 25, 25)
            page.get_by_label("Fecha de los registros", exact=True).fill("2026-11-09")
            for index in range(4):
                select_metric(page, index)
                assert_metric(page, index, 0, 0, 0)
            page.get_by_label("Fecha de los registros", exact=True).fill("2026-11-04")
            expect(page.locator(".home-hero")).to_contain_text("Press con mancuernas")
            page.locator(".home-hero").get_by_role("button", name="Registrar ejercicio", exact=True).click()
            expect(page.get_by_role("navigation", name="Navegación principal").get_by_role("button", name="Entrenar", exact=True)).to_have_attribute("aria-current", "page")
            page.get_by_role("navigation", name="Navegación principal").get_by_role("button", name="Inicio", exact=True).click()
            checks.extend(["reactive water entry", "selected date updates all metrics", "weekly boundary", "empty day", "recent record hero", "hero navigation"])

            print("Home: responsive light/dark captures", flush=True)
            for width in [320, 360, 412]:
                page.set_viewport_size({"width": width, "height": 844})
                select_metric(page, 0)
                for theme in ["light", "dark"]:
                    if theme == "dark":
                        page.get_by_role("button", name="Activar modo oscuro", exact=True).click()
                    expect(page.locator("body")).to_have_class("dark-mode" if theme == "dark" else "")
                    page.evaluate("window.scrollTo(0,0)")
                    assert not page.evaluate("document.documentElement.scrollWidth > innerWidth"), (width, theme)
                    assert_home_structure(page)
                    panel_box = active_panel(page, 0).bounding_box()
                    assert panel_box["x"] >= 0 and panel_box["x"] + panel_box["width"] <= width + 1, (width, theme, panel_box)
                    for selector in [".home-training h2", ".metric-content h3", ".metric-target", ".metric-percentage", ".home-training .hero-action"]:
                        contrast = text_contrast(page.locator(selector))
                        assert contrast >= 4.5, (width, theme, selector, contrast)
                    page.screenshot(path=str(ARTIFACTS / f"home-{theme}-{width}.png"), full_page=True)
                    if theme == "dark":
                        page.get_by_role("button", name="Activar modo claro", exact=True).click()
            checks.append("320/360/412 light and dark screenshots without horizontal overflow")
            checks.append("WCAG AA text contrast in metric label/goal/percentage and hero title/button")
            page.emulate_media(reduced_motion="reduce")
            select_metric(page, 3)
            assert page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches")
            durations = carousel(page).evaluate("""el => [el, ...el.querySelectorAll('*')].flatMap(node => {
              const style = getComputedStyle(node);
              return [style.animationDuration, style.transitionDuration].flatMap(value => value.split(',').map(s => parseFloat(s) * (s.trim().endsWith('ms') ? 1 : 1000)));
            })""")
            assert all(duration <= 20 for duration in durations), durations
            checks.append("reduced motion")
            context.close()

            print("Home: empty and active session hero", flush=True)
            empty = database()
            empty.update(workouts=[], meals=[], waterLogs=[])
            context, page = open_seeded(browser, empty, errors)
            expect(page.locator(".home-hero").get_by_role("button", name="Comenzar a entrenar", exact=True)).to_be_visible()
            for index in range(4):
                select_metric(page, index)
                assert_metric(page, index, 0, 0, 0)
            context.close()
            active = database()
            exercise = {"name": "Press de banca", "category": "Pecho", "mode": "strength", "sets": 3, "reps": 8, "weight": 40}
            active["activeSession"] = {"id": "home-test-session", "title": "Sesión de fuerza", "startedAt": "2026-11-04T10:00:00Z", "exercises": [exercise], "completedIds": []}
            context, page = open_seeded(browser, active, errors)
            expect(page.locator(".home-hero")).to_contain_text("Sesión de fuerza")
            page.locator(".home-hero").get_by_role("button", name="Continuar sesión", exact=True).click()
            expect(page.get_by_role("navigation", name="Navegación principal").get_by_role("button", name="Entrenar", exact=True)).to_have_attribute("aria-current", "page")
            context.close()
            checks.extend(["empty state hero", "active session hero continuation"])
            assert not errors, errors
            result = {"status": "passed", "checks": checks, "screenshots": 6, "page_errors": errors}
            (ARTIFACTS / "results.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
            print(json.dumps(result, ensure_ascii=False))
        finally:
            browser.close()


if __name__ == "__main__":
    main()
