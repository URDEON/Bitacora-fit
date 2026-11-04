# Bitácora Fit Pro

Bitácora de entrenamiento, alimentación y progreso que guarda los datos en el dispositivo. Aplicación React + TypeScript, instalable como PWA y empaquetada para Android con Capacitor.

## Desarrollo

Requiere Node.js 22 o posterior. Desde la raíz del repositorio:

```sh
npm ci
npm run dev -- --host 0.0.0.0
```

No requiere claves de API ni servicios externos para el flujo principal. Las fotografías y las fuentes se incluyen en la aplicación. Cada tarea en la nube ya está aislada: usa el checkout existente; no necesitas crear un worktree.

## Entrenamiento guiado

En **Entrenar**, elige un ejercicio de fuerza o tiempo, configura las series y el descanso y pulsa **Iniciar entrenamiento guiado**:

1. **Preparación:** 10 segundos para colocarte.
2. **Haga el ejercicio:** el reloj muestra el tiempo transcurrido. La serie solo termina al pulsar **Terminé la serie**, también en ejercicios por tiempo.
3. **Descanso:** comienza después de confirmar la serie. Al llegar a cero comienza la siguiente serie. Se puede omitir; un descanso configurado en cero pasa directamente a la siguiente serie.
4. La última confirmación termina el entrenamiento y guarda un único registro con todas las series. No hay descanso después de la última.

El panel permanece disponible al cambiar de apartado y conserva el entrenamiento al recargar la app. Se puede pausar, reanudar o cancelar. Cancelar o reemplazar un entrenamiento sin terminar descarta sus series, con confirmación previa. El reloj utiliza marcas de tiempo y se actualiza al volver a primer plano; nunca da por hecha una serie porque haya pasado tiempo.

**Guardar ejercicio** sigue disponible para registrar entrenamientos manualmente. El reloj del apartado **Cronómetro** conserva sus modos independientes de descanso, cronómetro e intervalos HIIT.

## Validación y compilación

```sh
npm test
npm run typecheck
npm run build
```

La compilación genera `dist/` y su caché para uso sin conexión. Para comprobar los flujos de entrenamiento en Chromium, con el servidor de desarrollo activo y Python Playwright instalado:

```sh
python tests/browser_guided.py
```

## Android

Requiere JDK 21 y Android SDK 36. Con el SDK configurado:

```sh
npm run build
npm run cap:sync
cd android
./gradlew assembleDebug
```

En Linux, si el ZIP original perdió el permiso de ejecución: `chmod +x android/gradlew`. El APK de depuración se genera en `android/app/build/outputs/apk/debug/`. Para distribuir una actualización sobre una instalación existente hay que conservar la misma clave de firma. Las instrucciones históricas de la entrega original se conservan en `ANDROID.md` y `ENTREGA.md`.

## Cambios de la versión 5.0.2

- Ciclo guiado de preparación, ejercicio confirmado y descanso entre series.
- Controles de series revisados y protección de los datos al editar su cantidad.
- Dirección visual de bitácora deportiva: composición editorial, bordes rectos, divisores y tipografía con jerarquía.
- Pruebas de regresión para el ciclo completo y sus casos límite.
