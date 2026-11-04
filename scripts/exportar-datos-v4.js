/* Ejecutar en la consola del navegador EN LA PESTAÑA ORIGINAL de Bitácora Fit v4.
   Solo lee la copia existente y descarga un JSON; no modifica ni borra datos. */
(() => {
  const original = localStorage.getItem('bitacora_fit_s20fe_v4');
  if (!original) throw new Error('No hay datos v4 en esta pestaña/origen. Abre el archivo original que utilizabas.');
  const data = JSON.parse(original);
  if (!data || !Array.isArray(data.workouts) || !Array.isArray(data.meals)) {
    throw new Error('El contenido no tiene el formato de Bitácora Fit v4. Conserva el original para revisarlo.');
  }
  const url = URL.createObjectURL(new Blob([original], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Bitacora-Fit-respaldo-v4.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
})();
