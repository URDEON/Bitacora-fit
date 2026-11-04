"""Flujo real de entrenamiento. Requiere Vite en http://localhost:5173 y Playwright Python.
Ejecutar: python tests/browser_training.py
Usa un contexto efímero; no altera los datos del navegador del usuario.
"""
import json
import os
import re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE_URL = os.environ.get('BITACORA_URL', 'http://localhost:5173')
KEY = 'bitacora_fit_s20fe_v5'
ARTIFACTS = Path('artifacts')
ARTIFACTS.mkdir(exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 390, 'height': 844}, locale='es-ES')
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('dialog', lambda dialog: dialog.accept())
    page.goto(BASE_URL)
    page.get_by_role('button', name='Entrenar', exact=True).click()
    def db():
        return page.evaluate(f"JSON.parse(localStorage.getItem('{KEY}'))")
    def wait_db(expression):
        page.wait_for_function(f"() => {{const db=JSON.parse(localStorage.getItem('{KEY}')); return db && ({expression});}}")
    def save():
        page.get_by_role('button', name='Guardar ejercicio', exact=True).click()
    def show_catalog():
        search = page.get_by_label('Buscar ejercicio o máquina', exact=True)
        if not search.is_visible():
            page.get_by_role('button', name=re.compile(r'^Mostrar catálogo')).click()
    def select(name):
        show_catalog()
        search = page.get_by_label('Buscar ejercicio o máquina', exact=True)
        search.fill(name)
        page.locator('.exercise-select-area').filter(has_text=name).first.click()
    today = page.get_by_label('Fecha de los registros', exact=True).input_value()

    print('phase: selection', flush=True)
    # Selecting across categories must replace category and modality together.
    select('Bicicleta estática')
    expect(page.get_by_label('Nombre del ejercicio', exact=True)).to_have_value('Bicicleta estática')
    page.get_by_label('Minutos de cardio', exact=True).fill('22')
    page.get_by_role('button', name='Guardar cardio / bici', exact=True).click()
    wait_db("db.workouts.length === 1")
    assert db()['workouts'][0]['category'] == 'Cardio y Bici'
    assert db()['workouts'][0]['mode'] == 'cardio'

    select('Press de banca plano con barra')
    page.get_by_label('Series de fuerza', exact=True).fill('2')
    page.get_by_label('Registrar peso y repeticiones por serie', exact=True).check()
    page.get_by_label('Repeticiones serie 1', exact=True).fill('8')
    page.get_by_label('Peso en kg serie 1', exact=True).fill('40')
    page.get_by_label('Repeticiones serie 2', exact=True).fill('6')
    page.get_by_label('Peso en kg serie 2', exact=True).fill('45')
    page.get_by_label('Notas del ejercicio', exact=True).fill('Registro verificado con series diferentes')
    page.get_by_label('Hora del registro', exact=True).fill('09:45')
    page.get_by_label('Descanso (segundos)', exact=True).fill('75')
    save()
    wait_db("db.workouts.length === 2")
    strength = next(w for w in db()['workouts'] if w['mode'] == 'strength')
    assert strength['category'] == 'Pecho'
    assert strength['setDetails'] == [{'reps': 8, 'weight': 40}, {'reps': 6, 'weight': 45}]
    assert strength['restSeconds'] == 75 and strength['time'] == '09:45'

    print('phase: validation and favorite', flush=True)
    # Invalid numbers show an error and do not write a modified record.
    page.get_by_label('Repeticiones serie 2', exact=True).fill('-3')
    save()
    expect(page.get_by_text('Serie 2, repeticiones:', exact=False)).to_be_visible()
    assert len(db()['workouts']) == 2
    page.get_by_label('Repeticiones serie 2', exact=True).fill('6')
    show_catalog()
    page.get_by_role('button', name='Agregar a favoritos: Press de banca plano con barra', exact=True).click()
    wait_db("db.favoriteExercises.includes('Press de banca plano con barra')")
    page.get_by_role('button', name='Favoritos', exact=True).click()
    assert page.locator('.exercise-select-area').count() == 1
    page.get_by_role('button', name='Todos', exact=True).click()

    print('phase: edit date', flush=True)
    # Edit date and time without losing per-series data.
    record = page.locator('.ticket-row').filter(has_text='Registro verificado con series diferentes')
    record.get_by_title('Editar registro', exact=True).click()
    page.get_by_label('Fecha del registro', exact=True).fill('2026-10-12')
    page.get_by_label('Hora del registro', exact=True).fill('07:30')
    page.get_by_role('button', name='Guardar cambios del ejercicio', exact=True).click()
    wait_db("db.workouts.some(w => w.mode === 'strength' && w.date === '2026-10-12' && w.time === '07:30')")
    assert next(w for w in db()['workouts'] if w['mode'] == 'strength')['setDetails'] == strength['setDetails']

    print('phase: routines', flush=True)
    # Routine create, reorder, edit, duplicate and delete.
    page.get_by_role('button', name='RUTINAS GUARDADAS', exact=False).click()
    page.get_by_role('button', name='Crear rutina desde cero', exact=False).click()
    editor = page.locator('.routine-editor')
    editor.get_by_label('Nombre', exact=True).fill('Prueba E2E torso')
    editor.get_by_label('Agregar ejercicios del catálogo', exact=True).fill('Press de banca plano')
    editor.get_by_role('button', name='Press de banca plano con barra', exact=True).click()
    first = editor.locator('fieldset').nth(0)
    first.get_by_label('Series', exact=True).fill('2')
    first.get_by_label('Repeticiones', exact=True).fill('9')
    first.get_by_label('Peso (kg)', exact=True).fill('30')
    first.get_by_label('Descanso (s)', exact=True).fill('60')
    editor.get_by_label('Agregar ejercicios del catálogo', exact=True).fill('Bicicleta estática')
    editor.get_by_role('button', name='Bicicleta estática', exact=True).click()
    editor.get_by_role('button', name='Subir Bicicleta estática', exact=True).click()
    editor.get_by_role('button', name='Guardar rutina', exact=True).click()
    wait_db("db.routines.some(r => r.title === 'Prueba E2E torso')")
    routine = next(r for r in db()['routines'] if r['title'] == 'Prueba E2E torso')
    assert routine['exercises'][0]['name'] == 'Bicicleta estática'
    page.get_by_role('button', name='Editar rutina Prueba E2E torso', exact=True).click()
    editor.get_by_label('Descripción opcional', exact=True).fill('Plantilla editada y comprobada')
    editor.get_by_role('button', name='Guardar rutina', exact=True).click()
    wait_db("db.routines.some(r => r.subtitle === 'Plantilla editada y comprobada')")
    page.get_by_role('button', name='Duplicar rutina Prueba E2E torso', exact=True).click()
    wait_db("db.routines.some(r => r.title === 'Prueba E2E torso (copia)')")
    copy = page.locator('.ticket-row').filter(has=page.get_by_text('Prueba E2E torso (copia)', exact=True))
    copy.get_by_title('Eliminar rutina', exact=True).click()
    wait_db("!db.routines.some(r => r.title === 'Prueba E2E torso (copia)')")

    print('phase: session', flush=True)
    # Starting a template creates no completed workout. Only explicit records count.
    count_before = len(db()['workouts'])
    card = page.locator('.ticket-row').filter(has=page.get_by_text('Prueba E2E torso', exact=True))
    card.get_by_role('button', name='INICIAR SESIÓN', exact=False).click()
    wait_db("db.activeSession !== null")
    assert len(db()['workouts']) == count_before
    page.locator('.session-item').first.get_by_role('button', name='Registrar', exact=True).click()
    page.get_by_label('Minutos de cardio', exact=True).fill('12')
    page.get_by_role('button', name='Guardar cardio / bici', exact=True).click()
    wait_db(f"db.workouts.length === {count_before + 1}")
    active_id = db()['activeSession']['id']
    recorded = db()['workouts'][-1]
    assert recorded['sessionId'] == active_id and recorded['sessionExerciseIndex'] == 0
    page.reload()
    page.get_by_role('button', name='Entrenar', exact=True).click()
    expect(page.get_by_role('region', name='Sesión en curso')).to_be_visible()
    assert db()['activeSession']['id'] == active_id
    page.get_by_role('button', name='Finalizar sesión', exact=True).click()
    wait_db("db.activeSession === null && db.workoutSessions.length === 1")
    assert db()['workoutSessions'][0]['completedIds'] == [recorded['id']]

    print('phase: responsive and modal', flush=True)
    # Local images, narrow screens, accessible fields and modal lifecycle.
    for width in [320, 360, 390, 412, 768, 1280]:
        page.set_viewport_size({'width': width, 'height': 900})
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), f'Overflow at {width}'
        select('Press de banca plano con barra')
        numeric_width = page.get_by_label('Series de fuerza', exact=True).evaluate('(input) => input.offsetWidth')
        assert numeric_width >= 40, f'Numeric input hidden at {width}: {numeric_width}'
        targets = page.locator('.number-stepper .step-circle:visible').evaluate_all('(buttons) => buttons.map(button => ({width:button.offsetWidth,height:button.offsetHeight}))')
        assert all(target['width'] >= 44 and target['height'] >= 44 for target in targets), f'Small target at {width}: {targets}'
    page.set_viewport_size({'width': 390, 'height': 844})
    page.get_by_role('button', name='Ver 2 fotos y mapa muscular', exact=True).click()
    expect(page.get_by_role('dialog')).to_be_visible()
    assert page.get_by_role('dialog').locator('img').first.evaluate('(image) => image.complete && image.naturalWidth > 0')
    page.keyboard.press('Escape')
    expect(page.get_by_role('dialog')).to_have_count(0)
    page.screenshot(path=str(ARTIFACTS / 'training-tested-390.png'), full_page=True)
    assert not errors, errors
    summary = {'status': 'passed', 'workouts': len(db()['workouts']), 'routines': len(db()['routines']), 'sessions': len(db()['workoutSessions']), 'widths': [320, 360, 390, 412, 768, 1280], 'page_errors': errors}
    (ARTIFACTS / 'training-results.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
    print(json.dumps(summary, ensure_ascii=False))
    browser.close()
