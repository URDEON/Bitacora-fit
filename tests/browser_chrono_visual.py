"""Circular clock presentation and ergonomics, with real persisted timer state.

Run against Vite/preview using BITACORA_URL. Contexts are ephemeral; no app test
hooks, records or timers are added to production code. Core precision/render
performance remains covered by tests/e2e/c04_chrono.e2e.mjs.
"""
import json
import math
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

from browser_home import DB_KEY, database, open_seeded, text_contrast


ARTIFACTS = Path("artifacts/chrono-visual")
MODES = {"countdown": "Descanso", "stopwatch": "Libre", "hiit": "HIIT / Tabata"}
GUIDED_KEY = "bitacora_fit_guided_workout_v1"


def assert_steppers_fit(page, case):
    measurements = root(page).locator(".number-stepper").evaluate_all("""rows => rows.map(row => {
      const box = node => { const r=node.getBoundingClientRect(); return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; };
      return {label:row.querySelector('label')?.textContent, box:box(row), width:row.clientWidth, scroll:row.scrollWidth,
        controls:[...row.querySelectorAll('.stepper-row > *')].map(node => ({tag:node.tagName, box:box(node)}))};
    })""")
    for row in measurements:
        assert row["scroll"] <= row["width"] + 1, (case, row)
        for control in row["controls"]:
            box, bounds = control["box"], row["box"]
            assert box["x"] >= bounds["x"] - 1 and box["right"] <= bounds["right"] + 1, (case, row)
            if control["tag"] == "BUTTON":
                assert box["width"] >= 43.9 and box["height"] >= 43.9, (case, row)
        for first, second in zip(row["controls"], row["controls"][1:]):
            assert first["box"]["right"] <= second["box"]["x"] + 1, (case, row)


def root(page):
    return page.locator(".chrono-view:visible")


def stored(page):
    return page.evaluate("key => JSON.parse(localStorage.getItem(key)).chrono", DB_KEY)


def switch_mode(page, mode):
    root(page).locator(".mode-card").filter(has_text=MODES[mode]).click()
    expect(root(page)).to_have_attribute("data-mode", mode)


def digits_ms(page):
    text = root(page).get_by_role("timer", name="Tiempo del cronómetro", exact=True).text_content().strip()
    match = re.fullmatch(r"(\d+):(\d{2})\.(\d)", text)
    assert match, text
    minutes, seconds, tenths = map(int, match.groups())
    return minutes * 60000 + seconds * 1000 + tenths * 100


def ring_fraction(page):
    """Read the actual painted SVG dash, rather than a CSS class or fixture."""
    return root(page).locator(".chrono-dial-progress").evaluate("""el => {
      const s = getComputedStyle(el);
      const length = Number(el.getAttribute('pathLength')) || el.getTotalLength();
      const raw = el.getAttribute('stroke-dasharray') || s.strokeDasharray;
      const dash = parseFloat(raw) || length;
      const offset = parseFloat(el.getAttribute('stroke-dashoffset') || s.strokeDashoffset) || 0;
      return 1 - offset / dash;
    }""")


def assert_ring(page, expected, tolerance=.012):
    page.wait_for_timeout(340)
    fraction = ring_fraction(page)
    assert math.isfinite(fraction) and abs(fraction - expected) <= tolerance, (fraction, expected)


def set_number(page, label, value):
    field = root(page).get_by_label(label, exact=True)
    field.fill(str(value))
    field.blur()
    expect(field).to_have_value(str(value))


def open_chrono(browser, errors):
    db = database()
    db["chrono"] = {"mode": "countdown", "running": False,
                    "startedAtEpochMs": None, "accumulatedElapsedMs": 0,
                    "initialSelectedMs": 45000, "laps": [],
                    "hiitWorkSec": 10, "hiitRestSec": 8, "hiitTotalRounds": 2,
                    "hiitCurrentRound": 1, "hiitPhase": "work",
                    "autoStartOnSet": False, "keepScreenAwake": False}
    context, page = open_seeded(browser, db, errors)
    page.get_by_role("button", name="Cronómetro y descanso", exact=True).click()
    expect(root(page)).to_be_visible()
    expect(root(page).locator(".chrono-dial")).to_have_count(1)
    expect(root(page).locator(".chrono-dial-progress")).to_have_count(1)
    return context, page


def motion(page):
    return root(page).evaluate("""el => el.getAnimations({subtree:true}).map(a => ({
      name:a.animationName || a.transitionProperty || '',
      duration:a.effect.getTiming().duration, iterations:a.effect.getTiming().iterations,
      state:a.playState, progress:a.effect.getComputedTiming().progress
    }))""")


def assert_layout(page, width, font, theme, mode):
    dial = root(page).locator(".chrono-dial")
    box = dial.bounding_box()
    assert box and box["x"] >= -1 and box["x"] + box["width"] <= width + 1, (width, font, theme, mode, box)
    assert abs(box["width"] - box["height"]) <= 1, (width, font, theme, mode, "dial deformed", box)
    assert not page.evaluate("document.documentElement.scrollWidth > innerWidth"), (width, font, theme, mode, "page overflow")
    timer = root(page).get_by_role("timer", name="Tiempo del cronómetro", exact=True)
    expect(timer).to_be_visible()
    assert timer.evaluate("el => el.scrollWidth <= el.clientWidth + 1"), (width, font, theme, mode, "digits overflow")
    timer_box = timer.bounding_box()
    assert timer_box["x"] >= box["x"] and timer_box["x"] + timer_box["width"] <= box["x"] + box["width"] + 1, (width, font, theme, mode, "digits outside dial")
    assert text_contrast(timer) >= 4.5, (width, font, theme, mode, "digit contrast")
    for name in ["Iniciar", "Restablecer"]:
        button = root(page).get_by_role("button", name=name, exact=True)
        expect(button).to_be_visible()
        rect = button.bounding_box()
        assert rect["width"] >= 44 and rect["height"] >= 44, (width, font, theme, mode, name, rect)
        assert text_contrast(button) >= 4.5, (width, font, theme, mode, name, "contrast")
    if font == 100 and width <= 412:
        page.evaluate("document.activeElement?.blur(); window.scrollTo(0,0)")
        primary = root(page).get_by_role("button", name="Iniciar", exact=True).bounding_box()
        navigation = page.get_by_role("navigation", name="Navegación principal", exact=True).bounding_box()
        assert primary["y"] >= 0 and primary["y"] + primary["height"] <= navigation["y"] - 4, (width, theme, mode, "primary action below first viewport", primary, navigation)
    assert_steppers_fit(page, (width, font, theme, mode))


def check_guided_visuals(browser, errors):
    context, page = open_chrono(browser, errors)
    page.clock.install()
    # Freeze JavaScript time so the active phase stays visible during its
    # geometry matrix and captures, without presenting paused UI everywhere.
    browser_now = page.evaluate("Date.now()")
    page.clock.pause_at(datetime.fromtimestamp(browser_now / 1000, timezone.utc) + timedelta(seconds=1))
    page.get_by_role("button", name="Entrenar", exact=True).click()
    page.get_by_label("Series de fuerza", exact=True).fill("2")
    page.get_by_label("Descanso (segundos)", exact=True).fill("20")
    page.get_by_role("button", name="Iniciar entrenamiento guiado", exact=True).click()
    coach = page.locator(".guided-workout")
    cases, captures = 0, 0
    for phase in ["preparing", "work", "rest", "complete"]:
        expect(coach).to_have_attribute("data-phase", phase)
        if phase != "complete":
            if phase == "preparing":
                page.clock.fast_forward(2500)
            elif phase == "work":
                page.clock.fast_forward(15000)
            elif phase == "rest":
                page.clock.fast_forward(5000)
        state = page.evaluate("key => JSON.parse(localStorage.getItem(key))", GUIDED_KEY)
        circle = coach.locator(".guided-clock-value")
        expect(circle).to_have_count(1)
        offset = float(circle.get_attribute("stroke-dashoffset"))
        if phase in ["preparing", "rest"]:
            remaining = state["deadline"] - page.evaluate("Date.now()")
            duration = state["deadline"] - state["phaseStartedAt"]
            assert abs((1 - offset / 100) - remaining / duration) < .0001, (phase, state, offset)
        elif phase == "work":
            expect(coach.locator(".guided-clock-hand")).to_have_count(1)
            assert offset == 100, offset
        else:
            assert offset == 0 and state["recorded"], state

        for width in [320, 360, 412, 768]:
            page.set_viewport_size({"width": width, "height": 950})
            for font in [100, 150]:
                page.evaluate("value => document.documentElement.style.fontSize = value + '%'", font)
                for theme in ["light", "dark"]:
                    if theme == "dark":
                        page.get_by_role("button", name="Activar modo oscuro", exact=True).click()
                    clock = coach.locator(".guided-clock").bounding_box()
                    assert abs(clock["width"] - clock["height"]) <= 1, (phase, width, font, theme, clock)
                    assert clock["x"] >= -1 and clock["x"] + clock["width"] <= width + 1, (phase, width, font, theme, clock)
                    assert not page.evaluate("document.documentElement.scrollWidth > innerWidth"), (phase, width, font, theme)
                    timer = coach.get_by_role("timer")
                    assert timer.evaluate("el => el.scrollWidth <= el.clientWidth + 1"), (phase, width, font, theme, "timer text")
                    assert text_contrast(timer) >= 4.5, (phase, width, font, theme, "timer contrast")
                    if width == 360 and font == 100:
                        page.evaluate("document.activeElement?.blur(); window.scrollTo(0,0)")
                        page.wait_for_timeout(80)
                        page.screenshot(path=str(ARTIFACTS / f"guided-{phase}-{theme}.png"), full_page=True)
                        captures += 1
                    cases += 1
                    if theme == "dark":
                        page.get_by_role("button", name="Activar modo claro", exact=True).click()
        page.evaluate("document.documentElement.style.fontSize = '100%'")
        page.set_viewport_size({"width": 360, "height": 950})
        if phase == "preparing":
            page.clock.fast_forward(11000)
        elif phase == "work":
            coach.get_by_role("button", name="Terminé la serie", exact=True).click()
        elif phase == "rest":
            page.clock.fast_forward(21000)
            coach.get_by_role("button", name="Terminé la serie", exact=True).click()
    context.close()
    return cases, captures


def main():
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    errors, checks, layouts, captures = [], [], [], 0
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True, args=["--no-sandbox"])
        try:
            context, page = open_chrono(browser, errors)
            page.clock.install()
            assert digits_ms(page) == 45000
            assert_ring(page, 1)
            page.get_by_role("button", name="Iniciar", exact=True).click()
            page.clock.fast_forward(10500)
            page.get_by_role("button", name="Pausar", exact=True).click()
            paused = stored(page)
            assert not paused["running"] and paused["accumulatedElapsedMs"] >= 10500, paused
            remaining = paused["initialSelectedMs"] - paused["accumulatedElapsedMs"]
            assert abs(digits_ms(page) - remaining) < 110, (digits_ms(page), remaining)
            assert_ring(page, remaining / paused["initialSelectedMs"])
            frozen = digits_ms(page)
            page.clock.fast_forward(3000)
            assert digits_ms(page) == frozen
            page.get_by_role("button", name="Reanudar", exact=True).click()
            page.clock.fast_forward(1100)
            page.get_by_role("button", name="Pausar", exact=True).click()
            assert digits_ms(page) < frozen - 1000
            page.get_by_role("button", name="Restablecer", exact=True).click()
            assert digits_ms(page) == 45000 and stored(page)["accumulatedElapsedMs"] == 0
            checks.extend(["countdown circle follows real remaining time", "start pause resume and reset keep accurate state"])

            # Presets and validated custom duration update the real clock.
            root(page).get_by_role("button", name="2:00 min", exact=True).click()
            assert digits_ms(page) == 120000 and stored(page)["initialSelectedMs"] == 120000
            set_number(page, "Minutos iniciales", 1)
            set_number(page, "Segundos iniciales", 7)
            root(page).get_by_role("button", name="Aplicar duración", exact=True).click()
            assert digits_ms(page) == 67000 and stored(page)["initialSelectedMs"] == 67000
            assert_ring(page, 1)
            checks.append("preset and custom duration are functional and persisted")

            switch_mode(page, "stopwatch")
            assert digits_ms(page) == 0
            before = root(page).locator(".chrono-orbit-pointer").get_attribute("style")
            root(page).get_by_role("button", name="Iniciar", exact=True).click()
            page.clock.fast_forward(15000)
            root(page).get_by_role("button", name="Marcar vuelta", exact=True).click()
            root(page).get_by_role("button", name="Pausar", exact=True).click()
            state = stored(page)
            assert 15000 <= state["accumulatedElapsedMs"] < 17000, state
            assert state["laps"] and state["laps"][0] >= 15000
            assert abs(digits_ms(page) - state["accumulatedElapsedMs"]) < 110
            after = root(page).locator(".chrono-orbit-pointer").get_attribute("style")
            assert before != after, (before, after)
            expect(root(page).locator(".lap-row")).to_have_count(1)
            root(page).get_by_role("button", name="Restablecer", exact=True).click()
            assert digits_ms(page) == 0 and not stored(page)["laps"]
            checks.append("stopwatch sweep, lap and reset reflect elapsed time")

            switch_mode(page, "hiit")
            set_number(page, "Trabajo (s)", 10)
            set_number(page, "Descanso (s)", 8)
            set_number(page, "Rondas", 2)
            state = stored(page)
            assert [state["hiitWorkSec"], state["hiitRestSec"], state["hiitTotalRounds"]] == [10, 8, 2], state
            root(page).get_by_role("button", name="Iniciar", exact=True).click()
            page.clock.fast_forward(11000)
            expect(root(page)).to_have_attribute("data-phase", "rest")
            root(page).get_by_role("button", name="Pausar", exact=True).click()
            state = stored(page)
            rest_remaining = 18000 - state["accumulatedElapsedMs"]
            assert 0 < rest_remaining <= 7000, state
            assert_ring(page, rest_remaining / 8000)
            assert abs(digits_ms(page) - rest_remaining) < 110
            root(page).get_by_role("button", name="Restablecer", exact=True).click()
            checks.append("HIIT custom settings and work-to-rest circle use real phase time")
            context.close()

            # A fresh real-clock context checks actual CSS animations and all
            # layouts; virtual time above cannot accidentally mask animation.
            context, page = open_chrono(browser, errors)
            switch_mode(page, "stopwatch")
            active = motion(page)
            assert any(a["state"] == "running" and isinstance(a["duration"], (int, float)) and 180 <= a["duration"] <= 400 for a in active), active
            page.wait_for_timeout(420)
            assert not any(a["state"] == "running" and a["iterations"] == float("inf") for a in motion(page)), motion(page)
            checks.append("mode changes run finite sophisticated CSS animations")

            print("Chrono: 48 circular layouts at 320 / 360 / 412 / 768 px, 100 / 150 %, both themes", flush=True)
            for width in [320, 360, 412, 768]:
                page.set_viewport_size({"width": width, "height": 844 if width <= 412 else 950})
                for font in [100, 150]:
                    page.evaluate("value => document.documentElement.style.fontSize = value + '%'", font)
                    for theme in ["light", "dark"]:
                        if theme == "dark":
                            page.get_by_role("button", name="Activar modo oscuro", exact=True).click()
                        for mode in MODES:
                            switch_mode(page, mode)
                            page.wait_for_timeout(360)
                            assert_layout(page, width, font, theme, mode)
                            layouts.append({"width": width, "font": font, "theme": theme, "mode": mode})
                            if width == 360 and font == 100:
                                page.evaluate("document.activeElement?.blur(); window.scrollTo(0,0)")
                                page.wait_for_timeout(80)
                                page.screenshot(path=str(ARTIFACTS / f"{mode}-{theme}-{width}.png"), full_page=True)
                                captures += 1
                        if theme == "dark":
                            page.get_by_role("button", name="Activar modo claro", exact=True).click()
            checks.extend(["48 layouts have circular bounds without overflow", "large fonts and real controls stay readable", "44 px primary actions and AA text contrast", "six clean light and dark clock screenshots"])

            page.emulate_media(reduced_motion="reduce")
            switch_mode(page, "countdown")
            timings = root(page).evaluate("""el => [el,...el.querySelectorAll('*')].flatMap(node => {
              const s = getComputedStyle(node);
              return [s.animationDuration,s.transitionDuration].flatMap(v => v.split(',').map(t => parseFloat(t) * (t.trim().endsWith('ms') ? 1 : 1000)));
            })""")
            assert all(t <= 20 for t in timings), max(timings)
            # The global accessibility rule uses .01 ms so transition events
            # still fire. It can be reported running within this same frame.
            page.wait_for_timeout(50)
            assert not any(a["state"] == "running" and a["duration"] > 20 for a in motion(page)), motion(page)
            checks.append("reduced motion removes clock mode and progress animation")
            context.close()
            print("Chrono: guided preparation / exercise / rest / completion circles", flush=True)
            guided_layouts, guided_captures = check_guided_visuals(browser, errors)
            checks.extend(["guided preparation and rest rings follow actual deadlines", "exercise remains manual with an elapsed hand", "completed guided circle is full and saved", "64 guided-circle layouts at four widths and large fonts"])
            captures += guided_captures
            assert not errors, errors
            result = {"status": "passed", "checks": checks, "layouts": len(layouts), "guided_layouts": guided_layouts, "screenshots": captures, "page_errors": errors}
            (ARTIFACTS / "results.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
            print(json.dumps(result, ensure_ascii=False))
        finally:
            browser.close()


if __name__ == "__main__":
    main()
