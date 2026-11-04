"""Verify exercise-guide keyboard focus and reduced motion in Chromium."""
from pathlib import Path
import json
import os
import re
import sys
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "artifacts" / "QA"
URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5173"


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"), headless=True, args=["--no-sandbox"])
        page = browser.new_page(viewport={"width": 320, "height": 800}, locale="es-ES", reduced_motion="reduce")
        page.goto(URL, wait_until="networkidle")
        page.get_by_role("button", name="Entrenar", exact=True).click()
        page.get_by_role("button", name=re.compile("^Abrir guía de ")).first.click()
        dialog = page.get_by_role("dialog")
        result = {
            "dialogLabelled": bool(dialog.get_attribute("aria-labelledby")),
            "initialFocusInside": dialog.evaluate("el => el.contains(document.activeElement)"),
            "tabFocusTrapped": True,
            "shiftTabFocusTrapped": True,
        }
        for _ in range(18):
            page.keyboard.press("Tab")
            result["tabFocusTrapped"] &= dialog.evaluate("el => el.contains(document.activeElement)")
        for _ in range(18):
            page.keyboard.press("Shift+Tab")
            result["shiftTabFocusTrapped"] &= dialog.evaluate("el => el.contains(document.activeElement)")
        result["reducedMotion"] = page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches && getComputedStyle(document.querySelector('.fade-view')).animationName === 'none'")
        page.keyboard.press("Escape")
        result["escapeClosesDialog"] = dialog.count() == 0
        result["focusReturnsToOpener"] = page.evaluate("document.activeElement.getAttribute('aria-label')?.startsWith('Abrir guía de ')")
        page.get_by_role("button", name="Progreso", exact=True).click()
        page.get_by_role("button", name=re.compile("^Consistencia y ")).click()
        calendar = page.get_by_role("region", name="Calendario de actividad desplazable", exact=True)
        result["calendarHasInternalScroll"] = calendar.evaluate("el => el.scrollWidth > el.clientWidth")
        calendar.focus()
        for _ in range(4):
            page.keyboard.press("ArrowRight")
        page.wait_for_timeout(150)
        result["calendarKeyboardScroll"] = calendar.evaluate("el => el.scrollLeft > 0")
        first_date = calendar.get_by_role("button").first
        selected_date = first_date.get_attribute("aria-label").split(",")[0]
        first_date.click()
        result["calendarDateSelection"] = page.get_by_label("Fecha de los registros", exact=True).input_value() == selected_date
        (OUTPUT / "keyboard-accessibility.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
        print(json.dumps(result, ensure_ascii=False, indent=2))
        browser.close()
    assert all(result.values()), result


if __name__ == "__main__":
    main()
