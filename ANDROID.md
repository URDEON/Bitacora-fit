# Bitácora Fit Pro en Android

El proyecto nativo está en `android/`. Conserva el identificador `com.bitacorafit.s20fe` para mantener la identidad y el almacenamiento de las instalaciones existentes; la interfaz se adapta a distintos teléfonos y tabletas. Nombre visible: **Bitácora Fit Pro**.

## Requisitos

- Node.js 22 o superior y npm.
- JDK **21** completo (`java` y `javac`) y `JAVA_HOME` apuntando al JDK.
- Android Studio con SDK Platform **36**, Build Tools **35.0.0** (el plugin Android de Gradle 8.13 los utiliza; también puede instalarse 36.0.0) y Platform Tools, o las herramientas de línea de comandos equivalentes.
- `ANDROID_HOME` apuntando al SDK, o `android/local.properties` con `sdk.dir=/ruta/al/sdk`.
- Android **7.0 / API 24** o superior para instalar.

La primera compilación descarga Gradle 8.14.3 y dependencias Android. La aplicación compilada funciona sin conexión.

## Compilar e instalar

Desde la carpeta del proyecto:

```sh
npm ci
npm run typecheck
npm test
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

En Windows utiliza `gradlew.bat assembleDebug`. El APK generado se encuentra en `android/app/build/outputs/apk/debug/app-debug.apk`. Puedes abrir el proyecto con `npx cap open android` y ejecutarlo desde Android Studio. Para una actualización, instala con el mismo identificador y la misma firma; haz una copia JSON antes de cambiar de firma o desinstalar.

La compilación de depuración usa la firma de pruebas de Android. Para publicar una versión de producción hace falta una clave de firma propia y un AAB/APK de release; no se incluye ninguna clave privada en este proyecto.

## Recursos y comportamiento nativo

- Iconos adaptativos y de launcher propios en las cinco densidades; splash con la marca y fondo oscuro.
- `scripts/generate-android-assets.mjs` regenera los PNG a partir de `public/app-icon.svg`.
- Notificaciones con icono monocromo `ic_stat_timer` y canal de descanso.
- Selector de archivos del sistema para importar. Las exportaciones utilizan archivos privados temporales y la hoja de compartir de Android.
- Persistencia local con IndexedDB y almacenamiento privado de Capacitor.
- El teclado solicita redimensionar la actividad (`adjustResize`); la interfaz admite desplazamiento.
- El botón Atrás cierra primero la guía visual, vuelve a Inicio o minimiza desde Inicio.
- El plugin local `ScreenAwake` mantiene encendida únicamente la actividad durante un cronómetro activo, si el usuario activa esta opción; no necesita servicios ni dependencias externas.

## Límites de temporizadores

El tiempo se calcula con marcas reales del reloj del dispositivo. Pausa, reanudación, cambio de pantalla y regreso a la aplicación recuperan el tiempo transcurrido; HIIT determina la ronda y fase actual aunque se hayan omitido múltiples refrescos visuales. Cambiar manualmente el reloj del sistema puede alterar la medición.

Android puede retrasar notificaciones según permisos, ahorro de batería, modo no molestar o las restricciones del fabricante. No hay garantía de alarma exacta con pantalla bloqueada. El sonido de cinco tonos de la interfaz se reproduce con la aplicación activa; en segundo plano la notificación usa el canal y los ajustes de sonido del sistema. En la web, una pestaña suspendida o cerrada no garantiza avisos. Estas limitaciones también aparecen en la pantalla de cronómetro.

Antes de distribuir, probar en dispositivos Android físicos: instalación, actualización sin pérdida de datos, teclado, botón Atrás, importar/exportar archivos, modo claro/oscuro, bloqueo de pantalla, suspensión y permisos de notificaciones. La compilación de un APK no sustituye estas pruebas.

## Verificación de esta entrega

Se generó un APK de depuración con `:app:assembleDebug` y resultado `BUILD SUCCESSFUL`. Se verificaron su firma APK v2, la integridad ZIP y la coincidencia byte a byte de los 237 recursos de `dist/` con el proyecto nativo y el APK. El informe completo y el SHA-256 están en `artifacts/android-final.txt`.

No se ejecutó en un teléfono ni en un emulador. El entorno carece de virtualización de CPU (`vmx`/`svm` y `/dev/kvm`); el intento de instalar una imagen AOSP ATD API30 también agotó el espacio temporal durante la extracción. El SDK limpió esos temporales. Estas limitaciones y el fallo del intento están documentados en los artefactos de prueba. La versión web sí fue comprobada en Chromium.
