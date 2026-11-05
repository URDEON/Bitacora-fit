"""Focused regression for the four data-driven metric identities.

Reuses the real Home fixture and native Android-style touch harness. Run with
Vite/preview in BITACORA_URL; all records live in ephemeral browser contexts.
"""
import json
import math
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

from browser_home import (
    DB_KEY, IDS, METRICS, active_panel, assert_metric, carousel, database,
    open_seeded, select_metric, text_contrast, touch_drag,
)


ARTIFACTS = Path("artifacts/metric-identity")


def assert_identity(page, index):
    panel = active_panel(page, index)
    visual = panel.locator(".metric-identity-visual")
    expect(visual).to_have_count(1)
    expect(visual).to_have_attribute("data-visual", IDS[index])
    expect(visual).to_have_attribute("aria-hidden", "true")
    assert visual.evaluate("el => getComputedStyle(el).pointerEvents") == "none"
    assert not visual.locator('[tabindex], button, a, input, [role="button"]').count()
    expect(panel.get_by_role("progressbar", name=f"Progreso de {METRICS[index]}")).to_be_visible()
    return visual


def settle(page):
    # Identity transitions finish after <= 320 ms; no animation clock interval.
    page.wait_for_timeout(340)


def assert_geometry_and_labels(page, width, theme, index):
    panel = active_panel(page, index)
    box = panel.bounding_box()
    assert box["x"] >= -0.5 and box["x"] + box["width"] <= width + 0.5, (width, theme, IDS[index], box)
    assert not page.evaluate("document.documentElement.scrollWidth > innerWidth"), (width, theme, IDS[index])
    assert panel.evaluate("el => el.scrollWidth <= el.clientWidth + 1"), (width, theme, IDS[index], "circle overflow")
    for selector in [".metric-content h3", ".metric-main-value", ".metric-target", ".metric-percentage"]:
        label = panel.locator(selector)
        expect(label).to_be_visible()
        assert label.evaluate("el => el.scrollWidth <= el.clientWidth + 1"), (width, theme, IDS[index], selector)
        assert text_contrast(label) >= 4.5, (width, theme, IDS[index], selector)


def water_fraction_from_y(y):
    radius = 146
    offset = max(-radius, min(radius, y - 160))
    return (radius * radius * math.acos(offset / radius)
            - offset * math.sqrt(max(0, radius * radius - offset * offset))) / (math.pi * radius * radius)


def main():
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    errors, checks, captures = [], [], 0
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True, args=["--no-sandbox"])
        try:
            db = database()
            db["waterLogs"] = []
            context, page = open_seeded(browser, db, errors)
            print("Identities: real water records at 0 / 25 / 50 / 100 / 125 %", flush=True)
            select_metric(page, 1)
            levels = []
            for step in range(6):
                percent = step * 25
                assert_metric(page, 1, step * 250, percent, min(100, percent))
                visual = assert_identity(page, 1)
                level = visual.locator(".water-level")
                expect(level).to_have_attribute("data-fill-percent", str(min(100, percent)))
                y = float(level.get_attribute("data-level-y"))
                assert abs(water_fraction_from_y(y) - min(100, percent) / 100) < 0.00001, (percent, y)
                levels.append(y)
                assert page.evaluate("key => JSON.parse(localStorage.getItem(key)).waterLogs.length", DB_KEY) == step
                if percent == 50:
                    # The liquid surface is visible at a real half-goal, not
                    # only as a completely filled blue disc at 125 percent.
                    for theme in ["light", "dark"]:
                        if theme == "dark":
                            page.get_by_role("button", name="Activar modo oscuro", exact=True).click()
                        page.evaluate("document.activeElement?.blur(); window.scrollTo(0, 0)")
                        settle(page)
                        page.screenshot(path=str(ARTIFACTS / f"water-half-{theme}-360.png"), full_page=True)
                        captures += 1
                    page.get_by_role("button", name="Activar modo claro", exact=True).click()
                if step < 5:
                    page.get_by_role("button", name="Agua +250 ml", exact=True).click()
                    page.wait_for_function("([key, count]) => JSON.parse(localStorage.getItem(key)).waterLogs.length === count", arg=[DB_KEY, step + 1])
                    message = page.get_by_role("button", name="Cerrar mensaje", exact=True)
                    if message.count():
                        message.click()
            assert all(levels[i + 1] < levels[i] for i in range(4)), levels
            assert levels[4] == levels[5] == 14, levels
            checks.extend(["water volume follows real +250 ml entries from 0 to 125 %", "water level rises monotonically and caps at full", "real percentage remains over 100"])

            # The selected day changes the visual as well as the numeric content.
            page.get_by_label("Fecha de los registros", exact=True).fill("2026-11-03")
            assert_metric(page, 1, 0, 0, 0)
            expect(assert_identity(page, 1).locator(".water-level")).to_have_attribute("data-fill-percent", "0")
            for index, value, selector in [(2, 500, "[data-energy-cell]"), (3, 30, "[data-protein-node]")]:
                select_metric(page, index)
                assert_metric(page, index, value, 25, 25)
                fractions = assert_identity(page, index).locator(selector).evaluate_all("els => els.map(el => Number(el.dataset.fraction))")
                assert abs(sum(fractions) / len(fractions) - 0.25) < 0.000001, fractions
            page.get_by_label("Fecha de los registros", exact=True).fill("2026-11-09")
            for index in range(4):
                select_metric(page, index)
                assert_metric(page, index, 0, 0, 0)
                assert_identity(page, index)
            page.get_by_label("Fecha de los registros", exact=True).fill("2026-11-04")
            select_metric(page, 1)
            assert_metric(page, 1, 1250, 125, 100)
            checks.append("selected date updates all four visuals, including an empty day, without duplicate records")

            print("Identities: week segments, charge cells and protein nodes", flush=True)
            select_metric(page, 0)
            training = assert_identity(page, 0)
            expect(training.locator("[data-segment]")).to_have_count(4)
            expect(training.locator('.training-segment[data-complete="true"]')).to_have_count(2)
            for index, selector, count in [(2, "[data-energy-cell]", 20), (3, "[data-protein-node]", 12)]:
                select_metric(page, index)
                visual = assert_identity(page, index)
                expect(visual.locator(selector)).to_have_count(count)
                fractions = visual.locator(selector).evaluate_all("els => els.map(el => Number(el.dataset.fraction))")
                assert all(0 <= value <= 1 for value in fractions), fractions
                assert abs(sum(fractions) / count - 0.75) < 0.000001, fractions
            checks.append("four distinct visuals express actual training / energy / protein progress")

            # Native touch must keep working even when it starts over the SVG.
            select_metric(page, 0)
            touch_drag(page, -110)
            assert_identity(page, 1)
            touch_drag(page, 110)
            assert_identity(page, 0)
            touch_drag(page, -12)
            assert_identity(page, 0)
            carousel(page).get_by_role("group").scroll_into_view_if_needed()
            before = page.evaluate("window.scrollY")
            touch_drag(page, 8, -120)
            assert_identity(page, 0)
            page.wait_for_function("before => window.scrollY > before + 20", arg=before)
            checks.extend(["native left/right touch changes one visual", "small gestures ignored", "vertical scroll remains native", "decorative SVG does not intercept input"])

            print("Identities: 24 mobile geometries, 8 light/dark captures", flush=True)
            for width in [320, 360, 412]:
                page.set_viewport_size({"width": width, "height": 844})
                for theme in ["light", "dark"]:
                    if theme == "dark":
                        page.get_by_role("button", name="Activar modo oscuro", exact=True).click()
                    for index in range(4):
                        select_metric(page, index)
                        settle(page)
                        assert_identity(page, index)
                        assert_geometry_and_labels(page, width, theme, index)
                        if width == 360:
                            # Full-page capture otherwise preserves the sticky
                            # header at the swipe test's previous scroll offset.
                            page.evaluate("document.activeElement?.blur(); window.scrollTo(0, 0)")
                            page.wait_for_timeout(80)
                            page.screenshot(path=str(ARTIFACTS / f"{IDS[index]}-{theme}-{width}.png"), full_page=True)
                            captures += 1
                    if theme == "dark":
                        page.get_by_role("button", name="Activar modo claro", exact=True).click()
            checks.extend(["all four visuals fit 320 / 360 / 412 px in light and dark", "labels / goals / percentages retain AA contrast and fit", "eight actual Home screenshots plus two real half-full water captures"])

            page.emulate_media(reduced_motion="reduce")
            select_metric(page, 1)
            durations = carousel(page).evaluate("""el => [el, ...el.querySelectorAll('*')].flatMap(node => {
              const style = getComputedStyle(node);
              return [style.animationDuration, style.transitionDuration].flatMap(value => value.split(',').map(s => parseFloat(s) * (s.trim().endsWith('ms') ? 1 : 1000)));
            })""")
            assert all(duration <= 20 for duration in durations), durations
            assert not carousel(page).evaluate("el => el.getAnimations({subtree:true}).some(a => a.effect.getTiming().iterations === Infinity)")
            checks.append("reduced motion respected without perpetual identity animation")
            context.close()
            assert not errors, errors
            result = {"status": "passed", "checks": checks, "screenshots": captures, "page_errors": errors}
            (ARTIFACTS / "results.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
            print(json.dumps(result, ensure_ascii=False))
        finally:
            browser.close()


if __name__ == "__main__":
    main()
