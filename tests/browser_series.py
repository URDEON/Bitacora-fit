"""Regresión del editor de series y sus controles en móvil/tablet/escritorio.

Ejecutar con Vite iniciado: python tests/browser_series.py
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect


BASE_URL = os.environ.get("BITACORA_URL", "http://127.0.0.1:5173")
DB_KEY = "bitacora_fit_s20fe_v5"
ARTIFACTS = Path("artifacts")
ARTIFACTS.mkdir(exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True, args=["--no-sandbox"])
    context = browser.new_context(viewport={"width": 390, "height": 844}, locale="es-CL")
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE_URL)
    page.get_by_role("button", name="Entrenar", exact=True).click()
    count = page.get_by_label("Series de fuerza", exact=True)
    count.fill("3")
    page.get_by_label("Registrar peso y repeticiones por serie", exact=True).check()
    expected = [{"reps": 10, "weight": 20}, {"reps": 8, "weight": 22.5}, {"reps": 6, "weight": 25}]
    for index, entry in enumerate(expected, 1):
        page.get_by_label(f"Repeticiones serie {index}", exact=True).fill(str(entry["reps"]))
        page.get_by_label(f"Peso en kg serie {index}", exact=True).fill(str(entry["weight"]))

    # Clearing and retyping the count is normal numeric-input editing. It must
    # never replace the existing user-entered weights or repetitions.
    count.fill("")
    count.fill("3")
    for index, entry in enumerate(expected, 1):
        expect(page.get_by_label(f"Repeticiones serie {index}", exact=True)).to_have_value(str(entry["reps"]))
        expect(page.get_by_label(f"Peso en kg serie {index}", exact=True)).to_have_value(str(entry["weight"]))
    count.fill("31")
    page.get_by_role("button", name="Guardar ejercicio", exact=True).click()
    assert page.evaluate("key => (JSON.parse(localStorage.getItem(key) || '{}').workouts || []).length", DB_KEY) == 0
    count.fill("3")
    count.fill("2")
    expect(page.get_by_label("Repeticiones serie 2", exact=True)).to_have_value("8")
    expect(page.get_by_label("Peso en kg serie 2", exact=True)).to_have_value("22.5")
    expect(page.get_by_label("Repeticiones serie 3", exact=True)).to_have_count(0)
    count.fill("3")
    expect(page.get_by_label("Repeticiones serie 3", exact=True)).to_have_value("6")
    expect(page.get_by_label("Peso en kg serie 3", exact=True)).to_have_value("25")
    count.fill("2")
    page.get_by_role("button", name="Guardar ejercicio", exact=True).click()
    page.wait_for_function("key => JSON.parse(localStorage.getItem(key)).workouts.length === 1", arg=DB_KEY)
    saved = page.evaluate("key => JSON.parse(localStorage.getItem(key)).workouts[0]", DB_KEY)
    assert saved["sets"] == 2 and saved["setDetails"] == expected[:2], saved
    page.reload()
    page.get_by_role("button", name="Entrenar", exact=True).click()
    expect(page.get_by_label("Registrar peso y repeticiones por serie", exact=True)).to_be_checked()
    expect(page.get_by_label("Peso en kg serie 2", exact=True)).to_have_value("22.5")

    widths = [320, 360, 390, 412, 620, 650, 768, 1280]
    for width in widths:
        page.set_viewport_size({"width": width, "height": 900})
        assert not page.evaluate("document.documentElement.scrollWidth > innerWidth"), f"Page overflow at {width}"
        controls = page.locator(".number-stepper .step-circle:visible").evaluate_all("buttons => buttons.map(button => ({width:button.offsetWidth,height:button.offsetHeight}))")
        assert controls and all(button["width"] >= 44 and button["height"] >= 44 for button in controls), (width, controls)
        numeric_width = page.get_by_label("Series de fuerza", exact=True).evaluate("input => input.getBoundingClientRect().width")
        assert numeric_width >= 40, (width, numeric_width)
        containers = page.locator(".number-stepper:visible").evaluate_all("rows => rows.map(row => ({width:row.clientWidth,scroll:row.scrollWidth}))")
        assert all(row["scroll"] <= row["width"] + 1 for row in containers), (width, containers)
    page.set_viewport_size({"width": 390, "height": 844})
    count.scroll_into_view_if_needed()
    page.screenshot(path=str(ARTIFACTS / "series-390.png"))
    assert not errors, errors
    result = {"status": "passed", "saved_sets": saved["setDetails"], "widths": widths, "page_errors": errors}
    (ARTIFACTS / "series-results.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
    browser.close()
