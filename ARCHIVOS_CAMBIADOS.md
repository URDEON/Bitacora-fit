# Archivos de la entrega

Comparación con `bitacora_fit_pro_original.zip`, usando sus rutas `project/`. Se compararon los bytes de los archivos, sin contar dependencias instaladas, compilaciones, cachés, evidencias de pruebas ni archivos `tsbuildinfo`. El proyecto Android se resume por grupos porque no existía en el original.

En la revisión de código y configuración se encontraron **40 archivos nuevos y 19 modificados**, incluidos este manifiesto y la documentación final de entrega. **No se eliminó ningún archivo fuente original**. Las imágenes originales y el HTML heredado se conservan; el HTML heredado no es el punto de entrada de la aplicación actual.

## Archivos nuevos

| Archivo | Propósito |
| --- | --- |
| `.nomedia` y `public/exercises/.nomedia` | Impiden indexar las imágenes del proyecto extraído sin ocultar medios fuera de su carpeta. |
| `tests/package_delivery_test.py` | Cinco verificaciones sobre el ZIP real y la protección de sus imágenes. |
| `GALERIA-5.0.1.md` | Diagnóstico por ruta confirmada, corrección y pruebas de privacidad de imágenes. |
| `INSTALAR-Y-FOTOS.txt` | Instrucciones para instalar sólo el APK y retirar copias externas del proyecto. |
| `README.md` | Ejecución web, uso, migración, pruebas y límites. |
| `ENTREGA.md` | Resultado, errores corregidos, pruebas reales y limitaciones. |
| `ARCHIVOS_CAMBIADOS.md` | Inventario comparado con el proyecto original. |
| `scripts/exportar-datos-v4.js` | Exportación local de datos desde la pestaña original v4, sin modificarlos. |
| `tests/browser_custom.py` | Ejercicios propios, fotos persistentes y estabilidad del foco con reloj activo. |
| `src/main.tsx` | Punto de entrada React, fuentes locales, recuperación de errores y registro de caché web. |
| `src/App.tsx` | Integra las vistas existentes, navegación, estado persistente, operaciones de registros, sesiones, mensajes, temas y comportamiento Android. |
| `src/components/HomeView.tsx` | Inicio con fecha, datos reales, objetivos, último entrenamiento y acciones rápidas. |
| `src/components/RoutineEditor.tsx` | Creación y edición de rutinas, orden y configuración de ejercicios. |
| `src/hooks/useChrono.ts` | Integra el temporizador persistido, alarmas, pausa, reanudación y ciclo de vida. |
| `src/services/chronoEngine.ts` | Cálculos temporales independientes de la frecuencia de refresco visual. |
| `src/services/dates.ts` | Fechas locales y textos de fecha compartidos. |
| `src/services/dbValidation.ts` | Validación de estructura y valores de los respaldos y datos persistidos. |
| `src/services/nutritionMath.ts` | Cálculos de porciones y validación nutricional. |
| `src/styles/training.css` | Diseño del editor de rutinas, sesiones y series individuales. |
| `src/vite-env.d.ts` | Tipos de Vite para el cliente. |
| `scripts/pack-delivery.py` | Empaqueta fuentes, compilación web y evidencias, comprueba el ZIP y genera SHA-256. |
| `scripts/build-offline.mjs` | Genera el trabajador de servicio y prepara los recursos locales para funcionar sin conexión. |
| `scripts/generate-android-assets.mjs` | Genera iconos y splash nativos a partir del recurso gráfico del proyecto. |
| `.gitignore` | Excluye dependencias, compilaciones, cachés, configuración local y claves de firma. |
| `ANDROID.md` | Requisitos y comandos de compilación e instalación, comportamiento nativo y límites comprobados. |
| `tests/run.mjs` | Ejecuta las pruebas TypeScript con `esbuild` y el ejecutor de Node. |
| `tests/chrono.test.ts` | Cuenta atrás, pausa, reanudación y recuperación de fases HIIT. |
| `tests/export.test.ts` | Fechas, volumen y estructura de documentos PDF, XLSX y DOCX. |
| `tests/nutrition.test.ts` | Porciones, unidades, nutrientes y valores inválidos. |
| `tests/storage.test.ts` | Migraciones, validación, persistencia, borrados, respaldos y combinación idempotente. |
| `tests/browser_core.py` | Respaldo, restauración, documentos, tema y persistencia desde la interfaz. |
| `tests/browser_training.py` | Ejercicios, series diferentes, favoritos, rutinas y sesiones reales. |
| `tests/browser_nutrition.py` | Alimentos, nutrientes, agua, pesajes y edición con fechas. |
| `tests/browser_sessions.py` | Consulta de sesiones finalizadas y resultados reales asociados. |
| `tests/browser_timer.py` | Acciones del cronómetro, recarga y temporizador HIIT. |
| `tests/browser_offline.py` | Funcionamiento sin red, recuperación de IndexedDB y recuperación desde un respaldo. |
| `tests/browser_responsive.py` | Pantallas principales en seis anchos y ambos temas. |
| `tests/browser_secondary.py` | Subpantallas, formularios, editor de rutinas y calendario. |
| `tests/browser_keyboard.py` | Teclado, foco del diálogo, calendario y movimiento reducido. |

## Archivos originales modificados

| Archivo | Cambio principal |
| --- | --- |
| `index.html` | Entrada funcional, nombre de la aplicación y zoom permitido. |
| `package.json` | Comandos de comprobación, pruebas, compilación web y Android; dependencias revisadas. |
| `package-lock.json` | Instalación reproducible con las dependencias de la entrega. |
| `capacitor.config.ts` | Configuración Android, nombre, recursos de notificación y áreas seguras. |
| `public/manifest.webmanifest` | Identidad de Bitácora Fit Pro y configuración web instalable. |
| `src/components/ExercisesView.tsx` | Selección coherente, validación, series individuales, edición, favoritos, rutinas y sesiones. |
| `src/components/ExerciseVisualModal.tsx` | Diálogo accesible, teclado, fotografías propias y eliminación confirmada. |
| `src/components/MuscleMapSVG.tsx` | Corrección de importación de `MuscleZone`. |
| `src/components/ChronoView.tsx` | Controles funcionales, tiempos validados y límites de segundo plano explicados. |
| `src/components/MealsWaterView.tsx` | Nutrientes completos, cantidades, frecuentes, agua, objetivos y edición de fecha/hora. |
| `src/components/ProgressHistoryView.tsx` | Pesajes editables, gráficos auténticos, volumen por serie, calendario y sesiones anteriores. |
| `src/components/BackupExportView.tsx` | Validación de importaciones, confirmación de reemplazo, copia previa y objetivos editables. |
| `src/data/defaultRoutines.ts` | Plantillas conservadas y textos de presentación en español. |
| `src/data/exercises.ts` | Catálogo conservado y corrección de referencias visuales que mostraban otros ejercicios. |
| `src/services/audioAndNotifications.ts` | Integración de alarmas y pantalla activa con límites reales de la plataforma. |
| `src/services/exportService.ts` | Documentos válidos, datos y fechas correctos, series detalladas y generación OOXML sin la antigua dependencia `xlsx`. |
| `src/services/storage.ts` | Escrituras ordenadas, instantáneas completas, recuperación por fecha, migración y combinación sin pérdida de referencias. |
| `src/styles/app.css` | Diseño adaptable, temas, contraste, controles táctiles, foco, formularios y áreas seguras. |
| `src/types.ts` | Tipos para series diferentes, favoritos, comidas frecuentes y sesiones. |

## Proyecto Android nuevo

- `android/settings.gradle`, archivos Gradle y wrapper: plataforma nativa y compilación reproducible.
- `android/app/build.gradle`: identificador `com.bitacorafit.s20fe`, versión 5.0.1 y requisitos Android.
- `android/app/src/main/AndroidManifest.xml`: actividad, teclado, permisos y configuración de la aplicación.
- `android/app/src/main/java/com/bitacorafit/s20fe/MainActivity.java`: actividad de Capacitor e integración del plugin local.
- `android/app/src/main/java/com/bitacorafit/s20fe/ScreenAwakePlugin.java`: mantiene encendida la actividad cuando el usuario lo solicita durante un temporizador.
- `android/app/src/main/res/`: iconos, splash, temas, colores e icono monocromo de notificaciones.
- `android/app/src/androidTest/`: identificador esperado corregido para futuras pruebas instrumentadas; no se ejecutaron en este entorno.
- Archivos generados de Capacitor y `android/app/src/main/assets/`: configuración y recursos web sincronizados.

`android/local.properties` contiene una ruta del SDK propia de la máquina de compilación y no debe incluirse en el paquete portable. Las carpetas de compilación y las herramientas Android instaladas en el entorno tampoco forman parte del código entregable.

## Revisión de secretos

Se revisaron 72 archivos de texto de código, configuración, pruebas y documentación, excluyendo dependencias y salidas generadas. No se encontraron patrones de claves privadas, credenciales de proveedores ni secretos asignados. Tampoco se encontraron archivos de firma `.jks`, `.keystore`, `.pem` o `.p12` en el código revisado. Esta revisión no añade claves de publicación; el APK de depuración utiliza la firma de pruebas de Android.

Los resultados ejecutados, comandos y limitaciones se detallan en la documentación principal y en los informes de pruebas de la entrega.
