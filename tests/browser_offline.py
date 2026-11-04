"""Prueba sobre npm run preview: caché sin conexión, IndexedDB y recuperación de JSON."""
from playwright.sync_api import sync_playwright, expect
import os, json
from pathlib import Path
BASE_URL=os.environ.get('BITACORA_URL','http://localhost:4173')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 context=b.new_context(viewport={'width':360,'height':800},locale='es-ES',accept_downloads=True)
 page=context.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE_URL);page.get_by_role('heading',name='Cada día cuenta.').wait_for()
 page.evaluate('navigator.serviceWorker.ready')
 page.reload();page.get_by_role('heading',name='Cada día cuenta.').wait_for()
 page.get_by_role('button',name='Agua +250 ml',exact=True).click()
 expect(page.get_by_role('status').filter(has_text='Guardado en el dispositivo')).to_be_visible()
 page.evaluate("localStorage.removeItem('bitacora_fit_s20fe_v5')")
 page.reload();page.get_by_role('heading',name='Cada día cuenta.').wait_for()
 page.get_by_role('button',name='Alimentación',exact=True).click()
 expect(page.locator('.ticket-row.water')).to_have_count(1)
 context.set_offline(True)
 page.reload();page.get_by_role('heading',name='Cada día cuenta.').wait_for()
 page.get_by_role('button',name='Agua +250 ml',exact=True).click()
 page.get_by_role('button',name='Entrenar',exact=True).click()
 page.locator('.ex-card-thumb').first.wait_for()
 assert page.locator('.ex-card-thumb').first.evaluate('(img)=>img.complete && img.naturalWidth>0')
 page.get_by_role('button',name='Ajustes y copias de seguridad').click()
 with page.expect_download() as dl:page.get_by_role('button',name='EXPORTAR EN PDF',exact=False).click()
 assert dl.value.suggested_filename.endswith('.pdf')
 assert not errors,errors
 context.close()
 recovery=b.new_context(locale='es-ES');page=recovery.new_page()
 page.goto(BASE_URL);page.get_by_role('heading',name='Cada día cuenta.').wait_for()
 page.evaluate("localStorage.setItem('bitacora_fit_s20fe_v5','{invalid')")
 page.reload();expect(page.get_by_role('heading',name='No se pudieron cargar los datos')).to_be_visible()
 assert page.evaluate("localStorage.getItem('bitacora_fit_s20fe_v5')")=='{invalid'
 page.on('dialog',lambda d:d.accept())
 page.locator('input[type=file]').set_input_files('artifacts/core/respaldo.json')
 page.get_by_role('heading',name='Cada día cuenta.').wait_for()
 page.get_by_role('button',name='Alimentación',exact=True).click()
 expect(page.locator('.ticket-row.water')).to_have_count(1)
 print(json.dumps({'resultado':'PASS','comprobaciones':['recuperación IndexedDB','recarga sin red','guardar sin red','imagen local sin red','PDF sin red','error lectura conserva original','restauración desde recuperación'],'errores':errors},ensure_ascii=False))
 b.close()
