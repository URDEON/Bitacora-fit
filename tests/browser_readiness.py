"""Navegación responsive, temas, persistencia y recursos de la PWA sin red.

Usar contra la compilación: npm run build && npm run preview -- --host 127.0.0.1
BITACORA_URL=http://127.0.0.1:4173 python tests/browser_readiness.py
"""
import json
import os
import re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect


BASE_URL = os.environ.get("BITACORA_URL", "http://127.0.0.1:4173")
DB_KEY = "bitacora_fit_s20fe_v5"
ARTIFACTS = Path("artifacts/readiness")
ARTIFACTS.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True, args=["--no-sandbox"])
    context = browser.new_context(viewport={"width": 390, "height": 844}, locale="es-CL", accept_downloads=True)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE_URL)
    page.get_by_role("button", name="Agua +250 ml", exact=True).wait_for()
    page.evaluate("navigator.serviceWorker.ready")
    page.reload()
    page.wait_for_function("navigator.serviceWorker.controller !== null")
    page.get_by_role("button", name="Agua +250 ml", exact=True).click()
    page.wait_for_function("key => JSON.parse(localStorage.getItem(key)).waterLogs.length === 1", arg=DB_KEY)
    tabs = ["Inicio", "Entrenar", "Alimentación", "Progreso", "Ajustes"]
    widths = [320, 390, 620, 768, 1280]
    for width in widths:
        page.set_viewport_size({"width": width, "height": 900})
        for tab in tabs:
            page.get_by_role("navigation", name="Navegación principal").get_by_role("button", name=tab, exact=True).click()
            assert page.locator(".tab-stage:visible").count() == 1, tab
            assert not page.evaluate("document.documentElement.scrollWidth > innerWidth"), (tab, width)
            expect(page.locator(".tab-stage:visible h1")).to_be_visible()
    page.set_viewport_size({"width": 390, "height": 844})
    page.get_by_role("button", name="Inicio", exact=True).click()
    page.screenshot(path=str(ARTIFACTS / "home-light-390.png"), full_page=True)
    page.get_by_role("button", name="Activar modo oscuro", exact=True).click()
    expect(page.locator("body")).to_have_class("dark-mode")
    page.screenshot(path=str(ARTIFACTS / "home-dark-390.png"), full_page=True)
    for tab in tabs:
        page.get_by_role("navigation", name="Navegación principal").get_by_role("button", name=tab, exact=True).click()
        assert not page.evaluate("document.documentElement.scrollWidth > innerWidth"), (tab, "dark")
    page.reload()
    expect(page.locator("body")).to_have_class("dark-mode")
    # Delete the synchronous fallback only. IndexedDB must restore the record.
    page.evaluate("key => localStorage.removeItem(key)", DB_KEY)
    page.reload()
    page.get_by_role("button", name="Alimentación", exact=True).click()
    expect(page.locator(".ticket-row.water")).to_have_count(1)

    context.set_offline(True)
    page.reload()
    page.get_by_role("button", name="Agua +250 ml", exact=True).click()
    page.wait_for_function("key => JSON.parse(localStorage.getItem(key)).waterLogs.length === 2", arg=DB_KEY)
    page.get_by_role("button", name="Entrenar", exact=True).click()
    if not page.locator(".ex-card-thumb").first.is_visible():
        page.get_by_role("button", name=re.compile(r"^Mostrar catálogo")).click()
    image = page.locator(".ex-card-thumb").first
    expect(image).to_be_visible()
    assert image.evaluate("img => img.complete && img.naturalWidth > 0"), "Exercise images must load offline"
    page.get_by_role("button", name="Ajustes", exact=True).click()
    with page.expect_download() as download:
        page.get_by_role("button", name="Crear respaldo (.json)", exact=True).click()
    backup = ARTIFACTS / "backup-offline.json"
    download.value.save_as(backup)
    assert len(json.loads(backup.read_text())["waterLogs"]) == 2
    with page.expect_download() as download:
        page.get_by_role("button", name="PDF (.pdf)", exact=True).click()
    pdf = ARTIFACTS / "report-offline.pdf"
    download.value.save_as(pdf)
    assert pdf.read_bytes().startswith(b"%PDF-")
    assert not errors, errors
    result = {
        "status": "passed", "tabs": tabs, "widths": widths,
        "checks": ["light/dark", "theme reload", "IndexedDB recovery", "offline reload", "offline save", "offline image", "offline JSON", "offline PDF"],
        "page_errors": errors,
    }
    (ARTIFACTS / "results.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
    browser.close()
