"""Ejercicios propios, fotos persistentes y foco del diálogo con reloj activo."""
from playwright.sync_api import sync_playwright, expect
import os, json
from pathlib import Path
BASE_URL=os.environ.get('BITACORA_URL','http://localhost:5173')
KEY='bitacora_fit_s20fe_v5'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 context=b.new_context(viewport={'width':390,'height':844},locale='es-ES')
 page=context.new_page();errors=[];downloads=[];page.on('download',lambda event:downloads.append(event.suggested_filename));page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('dialog',lambda d:d.accept())
 page.goto(BASE_URL);page.get_by_role('button',name='Entrenar',exact=True).click()
 page.get_by_label('Nombre del ejercicio',exact=True).fill('Press personalizado comprobado')
 page.get_by_role('button',name='+ Guardar escrito',exact=False).click()
 page.wait_for_function("JSON.parse(localStorage.getItem('bitacora_fit_s20fe_v5')).customCatalog.Pecho.includes('Press personalizado comprobado')")
 page.get_by_label('Iniciar cronómetro de descanso automáticamente al guardar',exact=True).check()
 page.get_by_label('Descanso (segundos)',exact=True).fill('0')
 page.get_by_role('button',name='+ GUARDAR EJERCICIO',exact=True).click()
 page.wait_for_function("JSON.parse(localStorage.getItem('bitacora_fit_s20fe_v5')).workouts.length===1")
 assert not page.evaluate("JSON.parse(localStorage.getItem('bitacora_fit_s20fe_v5')).chrono.running"), 'Descanso cero no debe convertirse en90segundos.'
 page.get_by_role('button',name='Guía',exact=True).click()
 modal=page.get_by_role('dialog')
 modal.locator('input[type=file]').set_input_files('public/exercises/Barbell_Bench_Press_-_Medium_Grip-0.webp')
 page.wait_for_function("JSON.parse(localStorage.getItem('bitacora_fit_s20fe_v5')).customExercisePhotos['Press personalizado comprobado']?.length===1")
 expect(modal.get_by_role('button',name='Borrar foto',exact=True)).to_be_visible()
 assert modal.locator('img').first.evaluate('(img)=>img.complete && img.naturalWidth>0')
 page.keyboard.press('Escape');page.reload()
 page.get_by_role('button',name='Entrenar',exact=True).click()
 page.get_by_label('Buscar ejercicio o máquina',exact=True).fill('Press personalizado comprobado')
 page.locator('.exercise-select-area').filter(has_text='Press personalizado comprobado').click()
 page.get_by_role('button',name='Guía',exact=True).click()
 expect(page.get_by_role('dialog').get_by_role('button',name='Borrar foto',exact=True)).to_be_visible()
 page.get_by_role('dialog').get_by_role('button',name='Borrar foto',exact=True).click()
 page.wait_for_function("JSON.parse(localStorage.getItem('bitacora_fit_s20fe_v5')).customExercisePhotos['Press personalizado comprobado']?.length===0")
 page.keyboard.press('Escape')
 page.get_by_role('button',name='Inicio',exact=True).click()
 page.get_by_role('button',name='Descanso',exact=True).click()
 page.get_by_role('button',name='Entrenar',exact=True).click()
 page.get_by_role('button',name='Guía',exact=True).click()
 modal=page.get_by_role('dialog');button=modal.get_by_role('button').last
 button.focus();page.wait_for_timeout(700)
 assert button.evaluate('(el)=>document.activeElement===el'), 'El refresco del reloj no debe quitar el foco del botón.'
 page.keyboard.press('Escape');assert not errors,errors
 assert not downloads, f'Las fotos no deben generar descargas: {downloads}'
 print(json.dumps({'resultado':'PASS','comprobaciones':['ejercicio propio','foto guardar/reabrir/eliminar','foco estable con cronómetro activo'],'errores':errors},ensure_ascii=False))
 b.close()
