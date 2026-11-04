"""Regresión del entrenamiento guiado con el reloj del navegador controlado.

Requiere Vite en BITACORA_URL (por defecto http://127.0.0.1:5173),
Playwright Python y Chromium. Todos los datos viven en un contexto efímero.
Ejecutar: python tests/browser_guided.py
"""
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright, expect


BASE_URL = os.environ.get("BITACORA_URL", "http://127.0.0.1:5173")
DB_KEY = "bitacora_fit_s20fe_v5"
GUIDED_KEY = "bitacora_fit_guided_workout_v1"
ARTIFACTS = Path("artifacts")
ARTIFACTS.mkdir(exist_ok=True)


with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path="/usr/bin/chromium", headless=True, args=["--no-sandbox"]
    )
    context = browser.new_context(viewport={"width": 390, "height": 844}, locale="es-CL")
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.clock.install()
    page.clock.pause_at(datetime.now(timezone.utc) + timedelta(seconds=60))
    page.goto(BASE_URL)
    # Let the brief brand presentation finish while the test clock is paused.
    page.clock.fast_forward(300)
    page.get_by_role("button", name="Entrenar", exact=True).click()
    coach = page.locator(".guided-workout")

    def state():
        return page.evaluate("key => JSON.parse(localStorage.getItem(key) || 'null')", GUIDED_KEY)

    def workouts():
        return page.evaluate(
            "key => (JSON.parse(localStorage.getItem(key) || '{}').workouts || [])", DB_KEY
        )

    def phase(name):
        expect(coach).to_have_attribute("data-phase", name)

    def configure(sets=2, rest=1):
        page.get_by_role("button", name="Entrenar", exact=True).click()
        page.get_by_label("Series de fuerza", exact=True).fill(str(sets))
        page.get_by_label("Descanso (segundos)", exact=True).fill(str(rest))

    def begin():
        page.get_by_role("button", name="Iniciar entrenamiento guiado", exact=True).click()
        phase("preparing")

    def finish_set():
        coach.get_by_role("button", name="Terminé la serie", exact=True).click()

    print("phase: preparation, pause and reload", flush=True)
    configure()
    begin()
    assert not workouts(), "Empezar un entrenamiento no debe registrarlo como completado"
    page.clock.fast_forward(3000)
    phase("preparing")
    coach.get_by_role("button", name="Pausar entrenamiento", exact=True).click()
    paused = coach.get_by_role("timer").inner_text()
    page.clock.fast_forward(30000)
    expect(coach.get_by_role("timer")).to_have_text(paused)
    page.reload()
    page.clock.fast_forward(300)
    phase("preparing")
    expect(coach.get_by_role("timer")).to_have_text(paused)
    coach.get_by_role("button", name="Reanudar entrenamiento", exact=True).click()
    page.clock.fast_forward(7100)
    phase("work")
    expect(coach.get_by_role("heading", name="Haga el ejercicio", exact=True)).to_be_visible()
    page.get_by_role("button", name="Inicio", exact=True).click()
    page.clock.fast_forward(120000)
    phase("work")
    assert not workouts(), "El tiempo nunca debe completar una serie sin confirmación"
    page.reload()
    page.clock.fast_forward(300)
    phase("work")

    print("phase: manual completion, rest, final save", flush=True)
    finish_set()
    phase("rest")
    page.clock.fast_forward(1100)
    phase("work")
    assert state()["set"] == 2
    finish_set()
    phase("complete")
    page.wait_for_function(
        "key => (JSON.parse(localStorage.getItem(key) || '{}').workouts || []).length === 1",
        arg=DB_KEY,
    )
    recorded = workouts()[0]
    assert recorded["sets"] == 2 and recorded["restSeconds"] == 1
    page.reload()
    page.clock.fast_forward(300)
    phase("complete")
    assert len(workouts()) == 1, "Recargar no debe duplicar el registro"
    coach.get_by_role("button", name="Cerrar entrenamiento", exact=True).click()
    expect(coach).to_have_count(0)

    print("phase: one set and no final rest", flush=True)
    configure(sets=1, rest=90)
    begin()
    page.clock.fast_forward(10100)
    phase("work")
    finish_set()
    phase("complete")
    page.wait_for_function(
        "key => JSON.parse(localStorage.getItem(key)).workouts.length === 2", arg=DB_KEY
    )
    coach.get_by_role("button", name="Cerrar entrenamiento", exact=True).click()

    print("phase: zero rest and cancellation", flush=True)
    configure(sets=2, rest=0)
    begin()
    page.clock.fast_forward(10100)
    phase("work")
    finish_set()
    phase("work")
    assert state()["set"] == 2
    coach.get_by_role("button", name="Cancelar entrenamiento", exact=True).click()
    dialog = page.get_by_role("alertdialog")
    expect(dialog).to_be_visible()
    # The coach remains active if the cancellation dialog is dismissed.
    page.keyboard.press("Escape")
    phase("work")
    coach.get_by_role("button", name="Cancelar entrenamiento", exact=True).click()
    page.get_by_role("alertdialog").locator("button").last.click()
    expect(coach).to_have_count(0)
    assert len(workouts()) == 2, "Cancelar no debe guardar las series pendientes"

    print("phase: skip rest, responsive rendering", flush=True)
    configure(sets=2, rest=90)
    begin()
    page.clock.fast_forward(10100)
    finish_set()
    phase("rest")
    coach.get_by_role("button", name="Omitir descanso", exact=True).click()
    phase("work")
    for width in [320, 390, 768, 1280]:
        page.set_viewport_size({"width": width, "height": 900})
        assert not page.evaluate("document.documentElement.scrollWidth > innerWidth"), width
        expect(coach.get_by_role("button", name="Terminé la serie", exact=True)).to_be_visible()
    page.set_viewport_size({"width": 390, "height": 844})
    coach.scroll_into_view_if_needed()
    page.screenshot(path=str(ARTIFACTS / "guided-workout-390.png"))
    assert not errors, errors
    result = {
        "status": "passed",
        "checks": [
            "preparation", "pause", "reload", "navigation", "manual set completion",
            "rest cycle", "final save once", "single set", "zero rest", "cancel", "skip rest",
            "responsive 320/390/768/1280",
        ],
        "page_errors": errors,
    }
    (ARTIFACTS / "guided-results.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
    browser.close()
