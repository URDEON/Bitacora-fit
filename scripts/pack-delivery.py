"""Empaqueta fuentes, web compilada y evidencias seleccionadas sin herramientas locales."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib

root = Path(__file__).resolve().parents[1]
output = root.parent / 'entrega'
output.mkdir(exist_ok=True)
archive = output / 'Bitacora-Fit-Pro-proyecto.zip'
excluded = {'node_modules', '.gradle', 'build', '.git', '.idea', '.test-build', '__pycache__'}
logs = {
    'test-5.0.1.log', 'build-5.0.1.log', 'photos-private-5.0.1.log', 'core-5.0.1.log', 'offline-5.0.1.log',
    'android-build-5.0.1.log', 'android-sync-5.0.1.log', 'images-private-5.0.1.json', 'package-private-5.0.1.log',
    'install-final.log', 'typecheck-final.log', 'test-final.log', 'build-final.log',
    'audit-all-final.json', 'core-final.log', 'custom-final.log', 'training-final.log',
    'nutrition-final.log', 'sessions-final.log', 'timer-final.log', 'offline-final.log',
    'android-final.txt', 'android-build-final.log', 'android-sync-final.log', 'android-unit-final.log',
    'inicio-final-claro.png', 'inicio-final-oscuro.png',
}

def include(path):
    relative = path.relative_to(root)
    if any(part in excluded for part in relative.parts): return False
    if path.name == 'local.properties' or path.suffix in {'.pyc', '.tsbuildinfo', '.jks', '.keystore'}: return False
    if relative.parts[0] == 'artifacts':
        return (len(relative.parts) == 2 and path.name in logs) or (len(relative.parts) == 3 and relative.parts[1] == 'QA' and (path.suffix == '.json' or path.name == 'README.md'))
    return True

files = sorted(path for path in root.rglob('*') if path.is_file() and include(path))
with ZipFile(archive, 'w', ZIP_DEFLATED, compresslevel=6) as bundle:
    # Create the marker before any image is extracted. Keep it inside our folder:
    # a marker at the archive root could hide unrelated media in Downloads.
    marker = root / '.nomedia'
    assert marker.is_file() and marker.stat().st_size == 0
    bundle.write(marker, 'Bitacora-Fit-Pro/.nomedia')
    for path in files:
        if path == marker: continue
        bundle.write(path, 'Bitacora-Fit-Pro/' + path.relative_to(root).as_posix())
with ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    assert bundle.namelist()[0] == 'Bitacora-Fit-Pro/.nomedia'
    assert '.nomedia' not in bundle.namelist()
    assert not any('node_modules/' in name or name.endswith('/local.properties') for name in bundle.namelist())
    for path in files:
        assert bundle.read('Bitacora-Fit-Pro/' + path.relative_to(root).as_posix()) == path.read_bytes()
checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
(archive.with_suffix('.zip.sha256')).write_text(checksum + '  ' + archive.name + '\n')
print(f'Proyecto: {len(files)} archivos, {archive.stat().st_size} bytes; ZIP y bytes verificados.\nSHA256 {checksum}')
