"""Respaldo, informes, tema y persistencia desde la interfaz; contexto efímero sin datos de usuario."""
from playwright.sync_api import sync_playwright, expect
from pathlib import Path
import json, os, zipfile, xml.etree.ElementTree as ET
BASE_URL=os.environ.get('BITACORA_URL','http://localhost:5173')
ARTIFACTS=Path('artifacts/core'); ARTIFACTS.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':390,'height':844},locale='es-ES',accept_downloads=True)
    page=context.new_page(); errors=[]; dialogs=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('console',lambda msg:errors.append(msg.text) if msg.type=='error' else None)
    page.goto(BASE_URL)
    page.get_by_role('heading',name='Cada día cuenta.').wait_for()
    page.get_by_role('button',name='Agua +250 ml',exact=True).click()
    page.wait_for_function("JSON.parse(localStorage.getItem('bitacora_fit_s20fe_v5')).waterLogs.length===1")
    page.get_by_role('button',name='Activar modo oscuro').click()
    expect(page.locator('body')).to_have_class('dark-mode')
    page.reload();expect(page.locator('body')).to_have_class('dark-mode')
    page.get_by_role('button',name='Ajustes y copias de seguridad').click()
    with page.expect_download() as download:
        page.get_by_role('button',name='CREAR RESPALDO (.JSON)',exact=True).click()
    backup=ARTIFACTS/'respaldo.json'; download.value.save_as(backup)
    original=json.loads(backup.read_text());assert len(original['waterLogs'])==1
    upload=page.locator('input[type=file][accept=".json,application/json"]')
    for _ in range(2):
        upload.set_input_files(backup)
        page.get_by_role('button',name='COMBINAR DATOS',exact=True).click()
        page.wait_for_timeout(100)
    assert page.evaluate("JSON.parse(localStorage.getItem('bitacora_fit_s20fe_v5')).waterLogs.length")==1
    invalid=ARTIFACTS/'invalido.json';invalid.write_text('{"waterLogs":[null]}')
    page.once('dialog',lambda d:(dialogs.append(d.message),d.accept()))
    with page.expect_event('dialog'):
        upload.set_input_files(invalid)
    assert dialogs and 'inválido' in dialogs[-1]
    assert page.evaluate("JSON.parse(localStorage.getItem('bitacora_fit_s20fe_v5')).waterLogs.length")==1
    empty={**original,'waterLogs':[]};empty_path=ARTIFACTS/'vacio.json';empty_path.write_text(json.dumps(empty))
    upload.set_input_files(empty_path)
    page.once('dialog',lambda d:d.dismiss())
    page.get_by_role('button',name='REEMPLAZAR TODO',exact=True).click()
    assert page.evaluate("JSON.parse(localStorage.getItem('bitacora_fit_s20fe_v5')).waterLogs.length")==1
    page.once('dialog',lambda d:d.accept())
    page.get_by_role('button',name='REEMPLAZAR TODO',exact=True).click()
    page.reload();page.get_by_role('heading',name='Cada día cuenta.').wait_for()
    assert page.evaluate("JSON.parse(localStorage.getItem('bitacora_fit_s20fe_v5')).waterLogs.length")==0
    page.get_by_role('button',name='Ajustes y copias de seguridad').click()
    page.locator('input[type=file][accept=".json,application/json"]').set_input_files(backup)
    page.get_by_role('button',name='COMBINAR DATOS',exact=True).click()
    for label,ext in [('EXPORTAR EN EXCEL','xlsx'),('EXPORTAR EN PDF','pdf'),('EXPORTAR EN WORD','docx')]:
        button=page.get_by_role('button',name=label,exact=False)
        with page.expect_download() as download: button.click()
        path=ARTIFACTS/f'informe.{ext}'; download.value.save_as(path)
        if ext=='pdf': assert path.read_bytes().startswith(b'%PDF-')
        else:
            with zipfile.ZipFile(path) as z:
                assert z.testzip() is None
                for name in z.namelist():
                    if name.endswith('.xml') or name.endswith('.rels'): ET.fromstring(z.read(name))
    import openpyxl
    workbook=openpyxl.load_workbook(ARTIFACTS/'informe.xlsx',data_only=True)
    assert workbook['Agua']['C2'].value==250
    page.get_by_role('button',name='Inicio',exact=True).click()
    page.get_by_role('button',name='Activar modo claro').click()
    expect(page.locator('body')).not_to_have_class('dark-mode')
    page.get_by_role('button',name='Alimentación',exact=True).click()
    page.evaluate("""() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'bitacora_fit_v5_undo_snapshot') throw new DOMException('Sin espacio para copia', 'QuotaExceededError'); return original.call(this, key, value); }; }""")
    page.once('dialog',lambda dialog:dialog.accept())
    page.get_by_role('button',name='Eliminar toma',exact=True).click()
    page.get_by_role('button',name='Entrenar',exact=True).click()
    page.get_by_label('Buscar ejercicio o máquina',exact=True).fill('Press de banca plano con barra')
    page.get_by_role('button',name='Agregar a favoritos: Press de banca plano con barra',exact=True).click()
    page.get_by_role('button',name='Deshacer',exact=True).click()
    page.wait_for_function("JSON.parse(localStorage.getItem('bitacora_fit_s20fe_v5')).waterLogs.length===1")
    assert page.evaluate("JSON.parse(localStorage.getItem('bitacora_fit_s20fe_v5')).favoriteExercises.includes('Press de banca plano con barra')"), 'Deshacer no debe borrar favoritos añadidos después.'
    assert not errors, errors
    print(json.dumps({'resultado':'PASS','comprobaciones':['agua y persistencia','tema y recarga','respaldo JSON','merge idempotente','importación inválida','cancelar reemplazo','reemplazo vacío sin resurrección','restaurar','XLSX openpyxl','PDF','DOCX XML','deshacer conserva cambios posteriores','borrado confirmado con copia sin espacio'],'errores':errors},ensure_ascii=False))
    browser.close()
