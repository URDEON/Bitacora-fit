from playwright.sync_api import sync_playwright, expect
import json
import os
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':320,'height':740})
    page=context.new_page()
    errors=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(os.environ.get('BITACORA_URL', 'http://127.0.0.1:5173'))
    page.get_by_role('button', name='Cronómetro y descanso').click()
    page.get_by_label('Minutos iniciales', exact=True).fill('0')
    page.get_by_label('Minutos iniciales', exact=True).blur()
    page.get_by_label('Segundos iniciales', exact=True).fill('2')
    page.get_by_label('Segundos iniciales', exact=True).blur()
    page.get_by_role('button',name='Aplicar duración',exact=True).click()
    page.get_by_role('button',name='INICIAR',exact=True).click()
    expect(page.get_by_role('button',name='PAUSAR',exact=True)).to_be_visible()
    page.wait_for_timeout(2500)
    expect(page.get_by_text('Descanso terminado. Listo para repetir.',exact=True).first).to_be_visible()
    expect(page.get_by_role('timer')).to_have_text('00:02.0')
    page.get_by_role('button',name='LIBRE Cardio / Vueltas').click()
    page.get_by_role('button',name='INICIAR',exact=True).click()
    page.wait_for_timeout(1250)
    page.reload()
    page.get_by_role('button', name='Cronómetro y descanso').click()
    expect(page.get_by_role('button',name='PAUSAR',exact=True)).to_be_visible()
    elapsed=page.get_by_role('timer').inner_text()
    assert elapsed != '00:00.0'
    page.get_by_role('button',name='PAUSAR',exact=True).click()
    page.get_by_role('button',name='HIIT / TABATA Rondas auto').click()
    page.get_by_label('Trabajo (s)',exact=True).fill('-5')
    page.get_by_label('Trabajo (s)',exact=True).blur()
    expect(page.get_by_text('Introduce un entero de 1 a 3600.',exact=True)).to_be_visible()
    page.get_by_label('Trabajo (s)',exact=True).fill('1')
    page.get_by_label('Trabajo (s)',exact=True).blur()
    page.get_by_label('Descanso (s)',exact=True).fill('1')
    page.get_by_label('Descanso (s)',exact=True).blur()
    page.get_by_label('Rondas',exact=True).fill('2')
    page.get_by_label('Rondas',exact=True).blur()
    page.get_by_role('button',name='INICIAR',exact=True).click()
    page.wait_for_timeout(3400)
    expect(page.get_by_text('Sesión HIIT terminada.',exact=True).first).to_be_visible()
    for width in [320,360,390,412,768,1280]:
        page.set_viewport_size({'width':width,'height':900})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'overflow {width}'
    print(json.dumps({'timer':'pass','reload_running_stopwatch':elapsed,'HIIT':'pass','invalid_input':'pass','responsive':[320,360,390,412,768,1280],'page_errors':errors},ensure_ascii=False))
    assert not errors
    browser.close()
