"""Real personal-module workflows and data protection in ephemeral browser contexts.

BITACORA_URL=http://127.0.0.1:5173 python tests/browser_personal.py
No test records or test-only APIs are included in the product.
"""
import copy
import json
import os
import re
from pathlib import Path

from playwright.sync_api import expect, sync_playwright
from browser_home import database

URL = os.environ.get("BITACORA_URL", "http://127.0.0.1:5173")
FIT = "bitacora_fit_s20fe_v5"
PERSONAL = "bitacora_personal_v1"
ARTIFACTS = Path("artifacts/personal")


def nav(page, label):
    page.get_by_role("navigation", name="Navegación principal", exact=True).get_by_role("button", name=label, exact=True).click()


def state(page):
    return page.evaluate("key => JSON.parse(localStorage.getItem(key) || 'null')", PERSONAL)


def wait_count(page, kind, count):
    page.wait_for_function("([key,kind,count]) => JSON.parse(localStorage.getItem(key) || '{}')[kind]?.length === count", arg=[PERSONAL, kind, count])


def quick(page, label):
    page.get_by_role("button", name="Registro rápido", exact=True).click()
    sheet = page.get_by_role("dialog", name="Registro rápido", exact=True)
    expect(sheet).to_be_visible()
    sheet.get_by_role("button", name=re.compile("^" + re.escape(label))).click()
    expect(sheet).not_to_be_visible()


def transaction(page, kind, amount, category, description, date="2026-11-04"):
    quick(page, "Registrar ingreso" if kind == "income" else "Registrar gasto")
    editor = page.locator(".finance-view .personal-editor")
    expect(editor).to_be_visible()
    editor.get_by_label("Monto (CLP)", exact=True).fill(str(amount))
    editor.get_by_label("Categoría", exact=True).fill(category)
    editor.get_by_label("Descripción opcional", exact=True).fill(description)
    editor.get_by_label("Fecha", exact=True).fill(date)
    editor.get_by_label("Hora", exact=True).fill("09:30")
    editor.get_by_role("button", name="Guardar movimiento", exact=True).click()
    expect(editor).not_to_be_visible()


def upload(panel, content):
    panel.get_by_label("Archivo de respaldo de Finanzas y Notas", exact=True).set_input_files({
        "name": "personal.json", "mimeType": "application/json", "buffer": json.dumps(content).encode()
    })


def confirm(page, name):
    dialog = page.get_by_role("alertdialog")
    expect(dialog).to_be_visible()
    dialog.get_by_role("button", name=name, exact=True).click()
    expect(dialog).not_to_be_visible()


def fit_bytes(page):
    return page.evaluate("key => localStorage.getItem(key)", FIT)


def assert_bounds(page):
    assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")


def main():
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    errors, checks = [], []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True, args=["--no-sandbox"])
        try:
            context = browser.new_context(viewport={"width": 360, "height": 844}, locale="es-CL", accept_downloads=True)
            seed = database()
            seed["darkMode"] = True
            context.add_init_script("""(() => {
              if (!localStorage.getItem('personal-qa-seeded')) {
                localStorage.setItem(%s, %s);
                localStorage.setItem('personal-qa-seeded', 'yes');
              }
            })()""" % (json.dumps(FIT), json.dumps(json.dumps(seed))))
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(URL)
            page.locator(".metric-orbit").wait_for()
            page.get_by_label("Fecha de los registros", exact=True).fill("2026-11-04")
            page.wait_for_timeout(350)
            original_fit = fit_bytes(page)

            transaction(page, "income", 100000, "Sueldo", "Ingreso QA")
            wait_count(page, "transactions", 1)
            assert state(page)["transactions"][0]["kind"] == "income"
            transaction(page, "expense", 12500, "Alimentación", "Compra QA")
            wait_count(page, "transactions", 2)
            assert sum(t["amount"] * (1 if t["kind"] == "income" else -1) for t in state(page)["transactions"]) == 87500
            expect(page.locator(".finance-balance strong")).to_contain_text("87.500")
            expect(page.locator(".finance-category-list")).to_contain_text("Alimentación")
            expect(page.locator(".finance-category-list")).to_contain_text("100 %")
            checks.append("quick income and expense create exact CLP records and real balance/categories")

            transaction(page, "expense", 5000, "Transporte", "Octubre QA", "2026-10-31")
            wait_count(page, "transactions", 3)
            expect(page.locator(".finance-balance strong")).to_contain_text("82.500")
            expect(page.locator(".finance-movements > li")).to_have_count(2)
            page.locator(".personal-month input").fill("2026-10")
            expect(page.locator(".finance-movements > li")).to_have_count(1)
            expect(page.locator(".finance-movements")).to_contain_text("Octubre QA")
            page.locator(".personal-month input").fill("2026-11")
            checks.append("month filter changes displayed movements without changing total registered balance")

            before = state(page)
            quick(page, "Registrar gasto")
            editor = page.locator(".finance-view .personal-editor")
            editor.get_by_label("Monto (CLP)", exact=True).fill("12.5")
            editor.get_by_label("Categoría", exact=True).fill("Inválido")
            editor.get_by_role("button", name="Guardar movimiento", exact=True).click()
            assert state(page) == before
            assert not editor.get_by_label("Monto (CLP)", exact=True).evaluate("el => el.checkValidity()")
            editor.get_by_label("Monto (CLP)", exact=True).fill("0")
            editor.get_by_role("button", name="Guardar movimiento", exact=True).click()
            expect(editor.get_by_role("alert")).to_contain_text("pesos enteros")
            assert state(page) == before
            editor.get_by_label("Monto (CLP)", exact=True).fill("10")
            editor.get_by_label("Fecha", exact=True).fill("")
            editor.get_by_role("button", name="Guardar movimiento", exact=True).click()
            assert state(page) == before
            editor.get_by_role("button", name="Cerrar editor de movimiento", exact=True).click()
            confirm(page, "Descartar cambios")
            checks.append("fractional or zero money and missing dates cannot write financial records")

            page.get_by_role("button", name="Editar movimiento: Compra QA", exact=True).click()
            editor = page.locator(".finance-view .personal-editor")
            editor.get_by_label("Monto (CLP)", exact=True).fill("15000")
            editor.get_by_role("button", name="Guardar movimiento", exact=True).click()
            wait_count(page, "transactions", 3)
            assert next(t for t in state(page)["transactions"] if t["description"] == "Compra QA")["amount"] == 15000
            page.get_by_role("button", name="Eliminar movimiento: Compra QA", exact=True).click()
            confirm(page, "Cancelar")
            wait_count(page, "transactions", 3)
            page.get_by_role("button", name="Eliminar movimiento: Compra QA", exact=True).click()
            confirm(page, "Eliminar movimiento")
            wait_count(page, "transactions", 2)
            assert state(page)["deleted"]["transactions"]
            page.reload()
            nav(page, "Finanzas")
            wait_count(page, "transactions", 2)
            checks.append("editing preserves identity and confirmed deletion survives reload with a tombstone")

            quick(page, "Crear nota")
            form = page.get_by_role("form", name="Crear nota", exact=True)
            before = state(page)
            form.get_by_role("button", name="Guardar nota", exact=True).click()
            assert state(page) == before
            assert not form.get_by_label("Título", exact=True).evaluate("el => el.checkValidity()")
            checks.append("an empty note title cannot write an incomplete record")
            form.get_by_label("Título", exact=True).fill("Idea QA")
            payload = '<img src=x onerror="window.personalXss=true"> Texto literal'
            form.get_by_label("Contenido", exact=True).fill(payload)
            form.get_by_role("button", name="Guardar nota", exact=True).click()
            wait_count(page, "notes", 1)
            expect(page.locator(".note-preview")).to_have_text(payload)
            assert not page.locator(".note-preview img").count()
            assert page.evaluate("window.personalXss === undefined")
            checks.append("quick note writes literal text without executing HTML")

            page.get_by_role("button", name="Añadir a favoritas: Idea QA", exact=True).click()
            page.get_by_role("button", name="Favoritas", exact=True).click()
            expect(page.locator(".note-record")).to_have_count(1)
            page.get_by_role("searchbox", name="Buscar notas", exact=True).fill("no coincide")
            expect(page.locator(".note-record")).to_have_count(0)
            page.get_by_role("searchbox", name="Buscar notas", exact=True).fill("literal")
            expect(page.locator(".note-record")).to_have_count(1)
            page.get_by_role("searchbox", name="Buscar notas", exact=True).fill("")
            page.get_by_role("button", name="Editar nota: Idea QA", exact=True).click()
            form = page.get_by_role("form", name="Editar nota", exact=True)
            form.get_by_label("Título", exact=True).fill("Idea editada")
            form.get_by_role("button", name="Guardar nota", exact=True).click()
            wait_count(page, "notes", 1)
            assert state(page)["notes"][0]["favorite"] is True
            checks.append("note editing favorites and content search use persisted real notes")

            quick(page, "Crear tarea")
            form = page.get_by_role("form", name="Crear nota", exact=True)
            form.get_by_label("Título", exact=True).fill("Lista QA")
            form.get_by_label("Texto de tarea 1", exact=True).fill("Preparar bolso")
            form.get_by_role("button", name="Añadir tarea", exact=True).click()
            form.get_by_label("Texto de tarea 2", exact=True).fill("Llevar agua")
            form.get_by_role("button", name="Guardar nota", exact=True).click()
            wait_count(page, "notes", 2)
            page.get_by_role("button", name="Todas", exact=True).click()
            task = page.locator(".note-record").filter(has=page.get_by_role("button", name="Lista QA", exact=True))
            task.get_by_role("checkbox", name="Preparar bolso", exact=True).check()
            expect(task.locator(".note-task-count")).to_have_text("1 de 2 terminadas")
            page.reload()
            nav(page, "Notas")
            expect(page.get_by_role("checkbox", name="Preparar bolso", exact=True)).to_be_checked()
            page.get_by_role("button", name="Tareas", exact=True).click()
            expect(page.locator(".note-record")).to_have_count(1)
            page.get_by_role("button", name="Todas", exact=True).click()
            checks.append("quick task list and completion checkboxes survive reload and filters")

            page.get_by_role("button", name="Editar nota: Idea editada", exact=True).click()
            form = page.get_by_role("form", name="Editar nota", exact=True)
            form.get_by_label("Contenido", exact=True).fill("Borrador sin guardar")
            form.get_by_role("button", name="Cerrar editor de notas", exact=True).click()
            confirm(page, "Seguir escribiendo")
            expect(form).to_be_visible()
            form.get_by_role("button", name="Cerrar editor de notas", exact=True).click()
            confirm(page, "Descartar cambios")
            assert next(note for note in state(page)["notes"] if note["title"] == "Idea editada")["body"] == payload
            page.get_by_role("button", name="Eliminar nota: Idea editada", exact=True).click()
            confirm(page, "Eliminar nota")
            wait_count(page, "notes", 1)
            checks.append("unsaved note dismissal requires confirmation and deleting notes is persistent")

            nav(page, "Herramientas")
            tool = page.locator(".tools-calculator")
            tool.get_by_label("Cantidad", exact=True).fill("2000")
            tool.get_by_label("Porcentaje (%)", exact=True).fill("12,5")
            tool.get_by_role("button", name="Calcular", exact=True).click()
            expect(tool.locator("output")).to_contain_text("250")
            tool.get_by_role("button", name="Ahorro", exact=True).click()
            tool.get_by_label("Meta de ahorro", exact=True).fill("100000")
            tool.get_by_label("Ahorro actual", exact=True).fill("40000")
            tool.get_by_label("Aporte mensual", exact=True).fill("10000")
            tool.get_by_role("button", name="Calcular", exact=True).click()
            expect(tool.locator("output")).to_contain_text("6 meses")
            tool.get_by_label("Aporte mensual", exact=True).fill("0")
            tool.get_by_role("button", name="Calcular", exact=True).click()
            expect(tool.get_by_role("alert")).to_contain_text("mayor que cero")
            tool.get_by_role("button", name="Presupuesto", exact=True).click()
            tool.get_by_label("Ingresos mensuales", exact=True).fill("2000")
            tool.get_by_label("Gastos mensuales", exact=True).fill("2500")
            tool.get_by_role("button", name="Calcular", exact=True).click()
            expect(tool.locator("output")).to_contain_text("500")
            checks.append("percentage savings and budget calculators compute real results and reject zero contributions")

            backup = page.locator(".personal-tools .personal-backup")
            with page.expect_download() as download:
                backup.get_by_role("button", name="Respaldar Finanzas y Notas", exact=True).click()
            backup_path = ARTIFACTS / "personal-backup.json"
            download.value.save_as(backup_path)
            exported = json.loads(backup_path.read_text())
            assert exported["format"] == "bitacora-personal"
            assert exported["data"] == state(page)
            before = state(page)
            for _ in range(2):
                upload(backup, exported)
                backup.get_by_role("button", name="Combinar registros", exact=True).click()
                confirm(page, "Combinar")
                wait_count(page, "transactions", 2)
                wait_count(page, "notes", 1)
            assert state(page)["transactions"] == before["transactions"]
            assert state(page)["notes"] == before["notes"]
            checks.append("exported backup contains exact personal data and repeated merge is idempotent")

            before = state(page)
            upload(backup, exported)
            backup.get_by_role("button", name="Reemplazar registros", exact=True).click()
            confirm(page, "Cancelar")
            assert state(page) == before
            backup.get_by_role("button", name="Cancelar importación personal", exact=True).click()
            malformed = copy.deepcopy(exported)
            malformed["data"]["notes"][0]["updatedAt"] = 9007199254740991
            upload(backup, malformed)
            expect(backup.get_by_role("alert")).to_contain_text("no es válido")
            assert state(page) == before
            assert fit_bytes(page) == original_fit
            checks.append("replacement cancellation and malformed timestamps preserve personal and Fit records")

            for width in (320, 360, 412):
                page.set_viewport_size({"width": width, "height": 844})
                nav(page, "Finanzas")
                assert_bounds(page)
                nav(page, "Notas")
                assert_bounds(page)
                nav(page, "Herramientas")
                assert_bounds(page)
            page.set_viewport_size({"width": 360, "height": 844})
            nav(page, "Finanzas")
            page.wait_for_timeout(350)
            page.screenshot(path=str(ARTIFACTS / "finance-dark-360.png"), full_page=True)
            nav(page, "Notas")
            page.wait_for_timeout(350)
            page.screenshot(path=str(ARTIFACTS / "notes-dark-360.png"), full_page=True)
            checks.append("personal views fit 320 360 and 412 px without horizontal overflow")

            # Two genuine tabs share the app store. A stale event includes a record
            # lost by last-writer storage; the app must persist the union before reload.
            second = context.new_page()
            second.on("pageerror", lambda error: errors.append(str(error)))
            second.goto(URL)
            second.locator(".metric-orbit").wait_for()
            before = state(page)
            record = copy.deepcopy(before["transactions"][0])
            record.update({"id": "cross-tab-fixture", "description": "Concurrent QA", "amount": 321, "updatedAt": before["updatedAt"] + 1})
            incoming = copy.deepcopy(before)
            incoming["transactions"].append(record)
            incoming["updatedAt"] = record["updatedAt"]
            page.evaluate("([key,value]) => window.dispatchEvent(new StorageEvent('storage',{key,newValue:JSON.stringify(value),storageArea:localStorage}))", [PERSONAL, incoming])
            wait_count(page, "transactions", 3)
            second.wait_for_function("key => JSON.parse(localStorage.getItem(key)).transactions.some(t=>t.id==='cross-tab-fixture')", arg=PERSONAL)
            page.reload()
            wait_count(page, "transactions", 3)
            assert fit_bytes(page) == original_fit
            second.close()
            checks.append("cross-tab reconciliation persists the merged union before reload")

            # Corrupt data must remain untouched until explicit valid recovery.
            corrupt = browser.new_context(viewport={"width": 360, "height": 844}, locale="es-CL")
            corrupt.add_init_script("""(() => { if(!localStorage.getItem('corrupt-qa-seeded')) {
              localStorage.setItem(%s, %s); localStorage.setItem(%s, '{broken-json');
              localStorage.setItem('corrupt-qa-seeded','yes');
            } })()""" % (json.dumps(FIT), json.dumps(json.dumps(seed)), json.dumps(PERSONAL)))
            broken = corrupt.new_page()
            broken.on("pageerror", lambda error: errors.append(str(error)))
            broken.goto(URL)
            broken.locator(".metric-orbit").wait_for()
            nav(broken, "Finanzas")
            expect(broken.get_by_role("alert")).to_contain_text("No pudimos leer")
            assert broken.evaluate("key => localStorage.getItem(key)", PERSONAL) == "{broken-json"
            quick(broken, "Registrar ingreso")
            editor = broken.locator(".finance-view .personal-editor")
            editor.get_by_label("Monto (CLP)", exact=True).fill("999")
            editor.get_by_label("Categoría", exact=True).fill("No debe guardarse")
            editor.get_by_role("button", name="Guardar movimiento", exact=True).click()
            expect(editor).to_be_visible()
            assert broken.evaluate("key => localStorage.getItem(key)", PERSONAL) == "{broken-json"
            nav(broken, "Herramientas")
            backup = broken.locator(".personal-tools .personal-backup")
            upload(backup, exported)
            backup.get_by_role("button", name="Reemplazar registros", exact=True).click()
            confirm(broken, "Reemplazar")
            wait_count(broken, "transactions", 2)
            assert broken.evaluate("key => localStorage.getItem(key+'_recovery')", PERSONAL) == "{broken-json"
            corrupt.close()
            checks.append("corrupt saved data is blocked and explicit recovery preserves the unreadable original")

            assert not errors, errors
            result = {"status": "passed", "checks": checks, "screenshots": 2, "page_errors": errors}
            (ARTIFACTS / "results.json").write_text(json.dumps(result, indent=2, ensure_ascii=False))
            print(json.dumps(result, ensure_ascii=False))
            context.close()
        finally:
            browser.close()


if __name__ == "__main__":
    main()
