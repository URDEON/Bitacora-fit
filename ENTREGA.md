# Entrega de Bitácora Fit Pro 5.0.1

Revisión y pruebas realizadas el 3 de noviembre de 2026 sobre el ZIP original compartido. Se conservó la arquitectura React, TypeScript, Vite y Capacitor, las siete vistas originales, los ejercicios y los recursos locales. El proyecto se reparó e integró directamente; no se sustituyó por una demostración.

## Resultado entregado

Proyecto fuente completo, compilación web `dist/`, proyecto nativo `android/`, pruebas reproducibles, instrucciones y APK de depuración. La aplicación inicia con registros vacíos y estadísticas calculadas a partir de lo que guarde el usuario.

El APK verificado está en la entrega separada como `Bitacora-Fit-Pro-5.0.1-debug.apk`. Paquete `com.bitacorafit.s20fe`, versión 5.0.1, código 50001, Android mínimo API 24, objetivo/compilación API 36. Firma APK v2 e integridad ZIP comprobadas. Los 238 archivos web empaquetados coinciden byte a byte con `dist/`, incluido el Service Worker corregido.

SHA-256 del APK:

```
cc6298016d9a02b84e5073c0c1b4e043b5279eefedb34163a19d5b41f6614509
```

## Actualización 5.0.1: imágenes privadas

La ruta confirmada `Download/project/public/exercises` pertenece al proyecto extraído en almacenamiento compartido. El APK mantiene sus fotos en assets internos; no necesita esas copias externas. El usuario reportó 1447 elementos visibles en la galería, cifra que no se pudo contar directamente en el dispositivo.

Se añadieron `.nomedia` a la carpeta del proyecto y a las imágenes, protección al extraer el ZIP, exclusión del marcador del precache, inclusión del marcador en assets nativos y un FileProvider limitado a reportes en `cache/exports/`. Se mantiene el mismo paquete y certificado de depuración para permitir la actualización sin desinstalar. La guía de limpieza está en `INSTALAR-Y-FOTOS.txt`; la actualización no elimina imágenes antiguas ni originales personales.

## Errores corregidos

- Faltaban `main.tsx`, `App.tsx` y el proyecto Android. Se creó la entrada y se integraron vistas, navegación, acciones y persistencia.
- `MuscleMapSVG` importaba `MuscleZone` desde un módulo que no lo exportaba. Se corrigió el tipo.
- La selección por búsqueda podía conservar la categoría anterior. Ahora nombre, categoría y modalidad se actualizan juntos.
- Iniciar una rutina convertía las cargas sugeridas en ejercicios completados. Ahora inicia una sesión pendiente y solo registra los resultados confirmados por el usuario.
- La fuerza solo admitía series uniformes. Se añadieron resultados individuales, descansos y comparación histórica.
- Editar comida, agua o peso cambiaba su fecha/hora. Ahora se conservan y permiten corregirse explícitamente.
- Había conversiones silenciosas de números inválidos, macros incompletos y títulos «Hoy» con fechas antiguas. Se añadieron validación visible y etiquetas coherentes con la fecha.
- El almacenamiento podía recuperar una copia antigua con más registros y resucitar borrados; también ocultaba todos los fallos. Se selecciona por fecha de actualización, se serializan escrituras y se informa el fallo total.
- Deshacer podía restaurar campos ajenos a la operación. Ahora revierte los campos afectados conservando, por ejemplo, favoritos añadidos después. El descanso automático respeta cero y no se inicia por un registro de cardio.
- La importación aceptaba estructuras sin validar y la combinación podía sobrescribir IDs. Se validan registros, fechas, números y claves peligrosas; las colisiones se remapean manteniendo sesiones y resultados.
- Word era HTML con extensión `.doc`. Ahora se genera DOCX OOXML real; Excel también usa OOXML válido y PDF incluye datos/fechas/series reales.
- Se actualizaron las dependencias vulnerables de PDF, se eliminó la dependencia `xlsx` y la herramienta de assets redundante, se actualizó `sharp` y se corrigieron dependencias transitivas de desarrollo.
- La prueba real sin internet encontró una diferencia de encabezados `Vary` que impedía recuperar módulos desde la caché. El Service Worker fue corregido y la recarga sin red volvió a comprobarse.

## Interfaz y funciones integradas

Navegación Inicio, Entrenar, Alimentación y Progreso; cronómetro y Ajustes en la cabecera. Panel de datos auténticos, estados vacíos, objetivos editables, tema claro/oscuro, fuentes locales, contraste mejorado, zoom habilitado, foco visible y movimiento reducido. Diseño revisado a 320, 360, 390, 412, 768 y 1280 px, con acciones táctiles de al menos 44 × 44 px en los estados revisados.

Catálogo e instrucciones, favoritos, ejercicios propios y fotos locales/personales; registro de fuerza, cardio y duración; rutinas editables, duplicación, orden, sesiones persistentes e historial. Comidas y todos los macros, gramos/unidades, alimentos propios, comidas frecuentes, agua y objetivos. Peso con fecha/hora, gráficas reales, volumen por series, cargas, calendario y resúmenes móviles de 7/30 días.

Cronómetro, descanso e HIIT calculados con marcas del reloj; pausa/reanudación, vueltas, sonidos, recuperación tras suspensión y pantalla activa nativa opcional. La interfaz informa los límites de alarmas del sistema.

## Resultados reales de pruebas

| Verificación | Resultado |
| --- | --- |
| Instalación de dependencias | Correcta, lockfile actualizado |
| `npm run typecheck` | Sin errores |
| `npm run build` | Correcto; 236 recursos preparados para caché web |
| `npm test` | **24 aprobadas, 0 fallos** |
| Auditoría npm completa, incluidas dependencias de desarrollo | **0 vulnerabilidades conocidas** al revisar |
| Entrenamiento en navegador | Selección cruzada de categoría, series distintas, validación, favoritos, edición, CRUD de rutinas, sesión sin resultados ficticios, recarga y finalización: correcto |
| Ejercicios y fotos propias | Guardar ejercicio, añadir foto local, reabrir y borrar foto; foco estable del diálogo con cronómetro activo: correcto |
| Nutrición y peso en navegador | Guardar, editar fecha/hora/macros, calcular 200 g de pollo = 330 kcal / 62 g proteína, frecuentes, validación, gráficas, recarga y borrado: correcto |
| Sesiones archivadas | Duración, conteos por resultados auténticos, series, sesión vacía y navegación a fecha: correcto |
| Respaldo/restauración | Descargar JSON, importar, combinar dos veces sin duplicar, rechazar archivo inválido, cancelar reemplazo, reemplazar por vacío y reabrir sin resucitar registros; borrado confirmado sin espacio para copia y Deshacer conservando favoritos posteriores: correcto |
| Informes descargados | XLSX abierto con openpyxl; DOCX con estructura ZIP/XML y apertura independiente python-docx; PDF con firma, páginas y fecha comprobadas |
| Almacenamiento secundario | Borrar únicamente localStorage y recuperar el registro desde IndexedDB: correcto |
| Sin conexión en producción | Recargar, guardar agua, mostrar imagen local y exportar PDF sin red: correcto |
| Lectura dañada | Se conserva el JSON original y se permite restaurar desde la pantalla de recuperación |
| Cronómetro en navegador | Cuenta atrás, pausa/reanudación, recarga en marcha, HIIT y valores inválidos: correcto |
| Revisión responsive | **144 estados**, ambos temas, sin desbordamiento de página, botones revisados menores de 44 px, nombres ausentes, imágenes fallidas ni errores JavaScript |
| Teclado y accesibilidad específica | **10/10**: foco/modal/Escape, movimiento reducido y calendario desplazable/selección |
| Prueba unitaria nativa generada | `testDebugUnitTest`: 1 aprobada (plantilla 2 + 2 = 4; no valida funciones Android). Instrumentación no ejecutada |
| Compilación Android | `assembleDebug`: **BUILD SUCCESSFUL**; firma, CRC y coincidencia de recursos verificadas |

Los informes y registros reproducibles están en `artifacts/`; los casos automáticos en `tests/`. Los datos empleados por las pruebas viven en contextos temporales, fuera de los registros iniciales entregados.

## Ejecución e instalación

Las instrucciones completas están en [README.md](README.md) y [ANDROID.md](ANDROID.md). Para web: `npm ci`, `npm run dev`. Para Android, con JDK 21 y SDK 36 configurados: `npm run build`, `npx cap sync android`, `cd android`, `./gradlew assembleDebug`; instala mediante `adb install -r app/build/outputs/apk/debug/app-debug.apk`.

## Limitaciones pendientes

1. El APK está compilado y firmado para depuración. **No se ejecutó en dispositivo físico ni emulador**: el entorno carece de virtualización y el intento de instalar una imagen de emulación agotó el espacio temporal. Faltan pruebas de instalación/actualización y del comportamiento nativo real de teclado, botón Atrás, archivos, permisos y suspensión.
2. Una publicación en tienda requiere clave de firma propia y versión release/AAB. No se entrega ni se inventa una firma de producción.
3. Las alarmas exactas y cada aviso HIIT en segundo plano dependen de Android; la web suspendida/cerrada tampoco garantiza avisos. Los tiempos se recuperan al volver. Cambiar manualmente el reloj puede alterar el cálculo.
4. Algunos ejercicios originales no tienen foto específica adecuada. Se conserva el catálogo y se muestra ausencia o referencia identificada; el usuario puede añadir una foto propia. Se conservaron las 210 imágenes originales.
5. Los valores nutricionales, objetivos calculados y 1RM son estimaciones. No hay sincronización en la nube. Los datos de otro origen web/HTML se trasladan con JSON; desinstalar o borrar datos requiere recuperar un respaldo externo.

Estas limitaciones impiden afirmar que hubo validación de producción en Android físico. La entrega incluye el código funcional verificado en navegador y el APK de depuración realmente generado.
