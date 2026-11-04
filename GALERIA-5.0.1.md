# Bitácora Fit Pro 5.0.1 — imágenes fuera de la galería

## Diagnóstico

El usuario reportó 1447 elementos visibles en la galería y confirmó la ruta `Almacenamiento interno/download/project/public/exercises`. Esa ruta es la carpeta del código fuente extraído en Descargas, en almacenamiento compartido. Android puede indexar sus imágenes, incluidas las copias de compilación. El APK instalado contiene sus recursos dentro del paquete y no depende de esa carpeta externa.

No se inspeccionó ni se contó directamente el contenido del teléfono. La cifra de 1447 es la indicada por el usuario; no se atribuye cada elemento a la aplicación sin comprobar su ruta.

## Corrección

- Se mantiene el catálogo con 210 fotos internas en `assets/public/exercises/` y las fotos añadidas como datos privados de la aplicación.
- Se añaden `.nomedia` vacío a la carpeta del proyecto y a `public/exercises/`.
- El ZIP escribe primero `Bitacora-Fit-Pro/.nomedia`, antes de extraer imágenes. No escribe un marcador en la raíz de Descargas que pueda ocultar fotos ajenas.
- Vite y Capacitor conservan el marcador de la carpeta de imágenes; el empaquetado Android permite incluirlo en los assets. El precache web omite el marcador para conservar la instalación sin conexión.
- Los reportes se generan en caché interna `exports/` y el FileProvider solo permite compartir esa carpeta; se elimina el acceso general a rutas externas.
- La versión sube a 5.0.1/código50001 con el mismo paquete y certificado de firma, sin migrar ni borrar registros.
- `INSTALAR-Y-FOTOS.txt` explica cómo instalar sólo el APK y retirar las fuentes externas que ya no se necesitan.

## Validación real

- TypeScript y build de producción: correctos.
- Pruebas de cálculos, almacenamiento y exportaciones: 24 aprobadas.
- ZIP real: 5 pruebas de marcador inicial, confinamiento, protección de imágenes, integridad y rutas sin duplicados.
- APK: CRC y firma válidos, certificado igual a 5.0.0,238archivos dist/APK idénticos y210fotos de catálogo internas. `.nomedia` presente dentro de la carpeta de ejercicios.
- Manifest del APK: sin permisos de lectura/escritura de almacenamiento, imágenes ni administración general de archivos.
- FileProvider compilado: sólo `cache/exports/`, sin `external-path`.
- Navegador: abrir imágenes y añadir/reabrir/eliminar foto propia sin eventos de descarga; respaldo/restauración y PDF/XLSX/DOCX correctos.
- Sin conexión: recarga, imagen local, registro y PDF correctos tras excluir `.nomedia` del precache.

Los informes están en `artifacts/*5.0.1*` y las pruebas en `tests/package_delivery_test.py` y `tests/browser_custom.py`. No se ejecutó esta versión en el teléfono del usuario ni en emulador.

## Copias que ya existen en Descargas

Actualizar el APK no elimina la carpeta del proyecto que ya se extrajo. Si `Download/project` sólo contiene esas fuentes, se puede eliminar desde Mis archivos para retirar sus imágenes externas y recuperar ese espacio; hay que conservar cualquier archivo personal que se haya guardado allí. El APK instalado y sus registros privados no dependen de las fuentes descargadas.

`.nomedia` evita indexación, pero no elimina imágenes ni libera espacio por sí mismo. Al importar una fotografía personal, la aplicación conserva una copia privada y no borra su original de la galería.
