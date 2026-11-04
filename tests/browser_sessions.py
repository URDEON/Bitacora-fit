"""Comprueba sesiones archivadas con fixture aislada; los datos no salen del contexto de prueba."""
from playwright.sync_api import sync_playwright, expect
import os
import re

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 390, 'height': 844}, timezone_id='UTC')
    page = context.new_page()
    page_errors = []
    page.on('pageerror', lambda error: page_errors.append(str(error)))
    page.goto(os.environ.get('BITACORA_URL', 'http://localhost:5173'))
    page.get_by_role('button', name='Progreso', exact=True).wait_for()
    page.get_by_role('button', name='Agua +250 ml', exact=True).click()
    page.wait_for_function("localStorage.getItem('bitacora_fit_s20fe_v5') !== null")
    page.evaluate('''() => {
      const key = 'bitacora_fit_s20fe_v5';
      const db = JSON.parse(localStorage.getItem(key));
      db.waterLogs = [];
      db.meals = [];
      db.bodyMetrics = [];
      const strength = { name: 'Press de prueba', category: 'Pecho', mode: 'strength', sets: 2, reps: 5, weight: 20, setDetails: [{reps: 5, weight: 20}, {reps: 8, weight: 25}] };
      const cardio = { name: 'Caminata de prueba', category: 'Cardio y Bici', mode: 'cardio', minutes: 12, distanceKm: 2 };
      db.workoutSessions = [
        { id: 'session-test', title: 'Tren superior comprobado', startedAt: '2026-10-30T13:00:00.000Z', finishedAt: '2026-10-30T13:32:45.000Z', exercises: [strength, cardio, strength], completedIds: [101, 102, 999] },
        { id: 'session-empty', title: 'Sesión sin resultados', startedAt: '2026-10-29T10:00:00.000Z', finishedAt: '2026-10-29T10:00:30.000Z', exercises: [strength], completedIds: [777] }
      ];
      db.workouts = [{...strength, id:101, sessionId:'session-test', date:'2026-10-30', time:'13:10'}, {...cardio, id:102, sessionId:'session-test', date:'2026-10-30', time:'13:20'}, {...strength, id:103, date:'2026-10-30', time:'15:00'}];
      db.updatedAt = Date.now() + 1000;
      localStorage.setItem(key, JSON.stringify(db));
    }''')
    page.reload()
    page.get_by_role('button', name='Progreso', exact=True).click()
    page.get_by_role('button', name=re.compile(r'^Historial')).click()
    session = page.get_by_role('article', name='Sesión Tren superior comprobado', exact=True)
    expect(session).to_contain_text('30 de octubre de 2026')
    expect(session).to_contain_text('32 min 45 s')
    expect(session).to_contain_text('2 resultados guardados')
    expect(session).to_contain_text('3 ejercicios planificados')
    session.get_by_text('Consultar ejercicios registrados', exact=True).click()
    expect(session).to_contain_text('serie 1: 5 rep × 20 kg; serie 2: 8 rep × 25 kg')
    expect(session).to_contain_text('Caminata de prueba: 12 min · 2 km')
    empty_session = page.get_by_role('article', name='Sesión Sesión sin resultados', exact=True)
    expect(empty_session).to_contain_text('0 resultados guardados')
    expect(empty_session).to_contain_text('No se guardaron resultados en esta sesión.')
    expect(empty_session.get_by_role('button')).to_have_count(0)
    session.get_by_role('button', name='Ver resultados del 30 de octubre de 2026', exact=True).click()
    expect(page.get_by_label('Fecha de los registros')).to_have_value('2026-10-30')
    expect(page.get_by_role('heading', name='Entrenar', exact=True)).to_be_visible()
    page.get_by_role('button', name='Progreso', exact=True).click()
    page.get_by_role('button', name=re.compile(r'Consistencia')).click()
    expect(page.get_by_text('ÚLTIMOS 7 DÍAS HASTA 2026-10-30', exact=True)).to_be_visible()
    expect(page.get_by_text('RESUMEN DE 30 DÍAS HASTA 2026-10-30', exact=True)).to_be_visible()
    assert not page_errors, page_errors
    print('PASS: sesiones archivadas, duración, resultados reales por sessionId, series diferentes, sesión vacía, navegación a fecha y periodos móviles; sin errores JS.')
    context.close()
    browser.close()
