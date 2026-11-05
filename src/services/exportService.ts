import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { BitacoraDB, WorkoutEntry } from '../types';

function escapeXml(value: string | number | undefined | null): string {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer); let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i,i + 0x8000));
  return btoa(binary);
}
export async function saveAndDeliverFile(fileName: string, mimeType: string, content: ArrayBuffer | string, isText = false): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    try {
      const written = await Filesystem.writeFile({ path: `exports/${fileName}`, directory: Directory.Cache, recursive: true,
        data: typeof content === 'string' && isText ? content : arrayBufferToBase64(typeof content === 'string' ? new TextEncoder().encode(content).buffer : content),
        ...(isText ? { encoding: Encoding.UTF8 } : {}),
      });
      await Share.share({ title: fileName, url: written.uri, dialogTitle: 'Guardar o compartir archivo' });
      return `Archivo ${fileName} listo para guardar o compartir.`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/cancel/i.test(message)) return 'Compartir cancelado.';
      throw new Error(`No se pudo exportar en el teléfono: ${message}`);
    }
  }
  const url = URL.createObjectURL(new Blob([content],{type:mimeType}));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = fileName;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
  return `Archivo ${fileName} descargado.`;
}
export function getFilteredExportCollections(db: BitacoraDB, scope: 'all' | 'day', activeDate: string) {
  const filter = <T extends { date: string; time?: string }>(items: T[]) => items.filter(x=>scope === 'all' || x.date === activeDate).sort((a,b)=>`${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`));
  const workouts = filter(db.workouts);
  return {strength:workouts.filter(x=>x.mode !== 'cardio'),cardio:workouts.filter(x=>x.mode === 'cardio'),meals:filter(db.meals),waterLogs:filter(db.waterLogs),bodyMetrics:filter(db.bodyMetrics)};
}
export function workoutVolume(w: WorkoutEntry): number {
  if (w.mode !== 'strength') return 0;
  return w.setDetails?.length ? w.setDetails.reduce((s,x)=>s + x.reps*x.weight,0) : (w.sets || 0)*(w.reps || 0)*(w.weight || 0);
}
function setSummary(w: WorkoutEntry): string {
  return w.setDetails?.length ? w.setDetails.map((s,i)=>`${i+1}: ${s.reps} rep × ${s.weight} kg`).join('; ') : `${w.sets || 1} × ${w.mode === 'time' ? `${w.seconds || 0} s` : `${w.reps || 0} rep × ${w.weight || 0} kg`}`;
}
type ReportTable = { title: string; sheet: string; headers: string[]; rows: (string | number)[][] };
function reportTables(db: BitacoraDB, scope: 'all' | 'day', activeDate: string): ReportTable[] {
  const {strength,cardio,meals,waterLogs,bodyMetrics} = getFilteredExportCollections(db,scope,activeDate);
  const tables: ReportTable[] = [
    {title:'Fuerza y duración',sheet:'Fuerza',headers:['Fecha','Hora','Categoría','Ejercicio','Modalidad','Series y resultados','Descanso (s)','Volumen (kg)','Notas'],rows:strength.map(w=>[w.date,w.time || '',w.category,w.name,w.mode === 'time' ? 'Duración' : 'Fuerza',setSummary(w),w.restSeconds || 0,workoutVolume(w),w.notes || ''])},
    {title:'Cardio',sheet:'Cardio',headers:['Fecha','Hora','Actividad','Minutos','Distancia (km)','Intensidad','Notas'],rows:cardio.map(w=>[w.date,w.time || '',w.name,w.minutes || 0,w.distanceKm || 0,w.intensity || '',w.notes || ''])},
    {title:'Alimentación (valores estimados)',sheet:'Comidas',headers:['Fecha','Hora','Comida','Alimentos','Calorías (kcal)','Proteínas (g)','Carbohidratos (g)','Grasas (g)'],rows:meals.map(m=>[m.date,m.time,m.mealType,m.desc,m.calories,m.protein,m.carbs || 0,m.fat || 0])},
    {title:'Agua',sheet:'Agua',headers:['Fecha','Hora','Cantidad (ml)','Detalle'],rows:waterLogs.map(w=>[w.date,w.time,w.ml,w.label || ''])},
    {title:'Peso corporal',sheet:'Peso corporal',headers:['Fecha','Hora','Peso (kg)','Grasa (%)','Cintura (cm)','Notas'],rows:bodyMetrics.map(b=>[b.date,b.time,b.weightKg,b.bodyFatPct ?? '',b.waistCm ?? '',b.notes || ''])},
  ];
  if (tables.every(t=>t.rows.length === 0)) throw new Error('No hay registros en el período seleccionado para exportar.');
  return tables;
}
function reportName(scope: 'all' | 'day', date: string, ext: string) { return `Bitacora_Fit_Pro_${scope === 'day' ? date : 'Completo'}.${ext}`; }
export async function exportBackupJSON(db: BitacoraDB, dateLabel: string): Promise<string> {
  return saveAndDeliverFile(`Bitacora_Fit_Backup_${dateLabel}.json`,'application/json;charset=utf-8',JSON.stringify(db,null,2),true);
}
/** SpreadsheetML with numeric cells and inline strings; user text is never interpreted as a formula. */
export async function createExcelReport(db: BitacoraDB, scope: 'all' | 'day', date: string): Promise<ArrayBuffer> {
  const tables = reportTables(db,scope,date), ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const files: Record<string,string> = {};
  const columnName=(n:number)=>{let result='';for(n++;n>0;n=Math.floor((n-1)/26))result=String.fromCharCode(65+(n-1)%26)+result;return result;};
  for(const [index,table] of tables.entries()) {
    const rows=[table.headers,...table.rows];
    const cells=rows.map((row,r)=>`<row r="${r+1}">${row.map((v,c)=>`<c r="${columnName(c)}${r+1}" s="${r===0?1:0}"${typeof v==='number'?'':' t="inlineStr"'}>${typeof v==='number'?`<v>${v}</v>`:`<is><t xml:space="preserve">${escapeXml(v)}</t></is>`}</c>`).join('')}</row>`).join('');
    files[`xl/worksheets/sheet${index+1}.xml`]=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultColWidth="20"/><sheetData>${cells}</sheetData><autoFilter ref="A1:${columnName(table.headers.length-1)}${rows.length}"/></worksheet>`;
  }
  files['[Content_Types].xml']=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${tables.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
  files['_rels/.rels']='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  files['xl/workbook.xml']=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${tables.map((t,i)=>`<sheet name="${escapeXml(t.sheet)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`;
  files['xl/_rels/workbook.xml.rels']=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${tables.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  files['xl/styles.xml']=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFAB4123"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return zipFiles(files);
}
export async function exportExcelReport(db: BitacoraDB, scope: 'all' | 'day', date: string): Promise<string> {
  return saveAndDeliverFile(reportName(scope,date,'xlsx'),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',await createExcelReport(db,scope,date));
}
export async function createPDFReport(db: BitacoraDB, scope: 'all' | 'day', date: string): Promise<ArrayBuffer> {
  const tables = reportTables(db,scope,date);
  const [{jsPDF},{default:autoTable}] = await Promise.all([import('jspdf'),import('jspdf-autotable')]);
  const doc = new jsPDF({orientation:'landscape'});
  doc.setFontSize(16); doc.text('Bitácora Fit Pro',14,17); doc.setFontSize(10);
  doc.text(`Alcance: ${scope === 'day' ? date : 'Historial completo'}`,14,24);
  let y = 33;
  for(const table of tables.filter(t=>t.rows.length)) {
    if(y > 175) {doc.addPage();y=18;}
    doc.setFontSize(11); doc.text(table.title,14,y);
    autoTable(doc,{startY:y+3,head:[table.headers],body:table.rows,theme:'grid',styles:{fontSize:8,cellPadding:2,overflow:'linebreak'},headStyles:{fillColor:[171,65,35]}});
    y=((doc as unknown as {lastAutoTable?:{finalY:number}}).lastAutoTable?.finalY || y)+11;
  }
  const pages=doc.getNumberOfPages(); for(let i=1;i<=pages;i++) {doc.setPage(i);doc.setFontSize(8);doc.text(`${i} / ${pages}`,275,202);}
  return doc.output('arraybuffer');
}
export async function exportPDFReport(db: BitacoraDB, scope: 'all' | 'day', date: string): Promise<string> {
  return saveAndDeliverFile(reportName(scope,date,'pdf'),'application/pdf',await createPDFReport(db,scope,date));
}

/** ZIP with stored entries. OOXML does not require compression; no extra runtime dependency. */
export function zipFiles(files: Record<string,string>): ArrayBuffer {
  const enc = new TextEncoder(); const chunks: Uint8Array[]=[]; const central: Uint8Array[]=[]; let offset=0;
  const header=(length:number)=>{const bytes=new Uint8Array(length);return {bytes,view:new DataView(bytes.buffer)};};
  const crc32=(bytes:Uint8Array)=>{let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;};
  for(const [name,value] of Object.entries(files)) {
    const filename=enc.encode(name),data=enc.encode(value),crc=crc32(data),local=header(30+filename.length),dir=header(46+filename.length);
    local.view.setUint32(0,0x04034b50,true);local.view.setUint16(4,20,true);local.view.setUint16(6,0x800,true);local.view.setUint16(12,33,true);local.view.setUint32(14,crc,true);local.view.setUint32(18,data.length,true);local.view.setUint32(22,data.length,true);local.view.setUint16(26,filename.length,true);local.bytes.set(filename,30);
    dir.view.setUint32(0,0x02014b50,true);dir.view.setUint16(4,20,true);dir.view.setUint16(6,20,true);dir.view.setUint16(8,0x800,true);dir.view.setUint16(14,33,true);dir.view.setUint32(16,crc,true);dir.view.setUint32(20,data.length,true);dir.view.setUint32(24,data.length,true);dir.view.setUint16(28,filename.length,true);dir.view.setUint32(42,offset,true);dir.bytes.set(filename,46);
    chunks.push(local.bytes,data);central.push(dir.bytes);offset+=local.bytes.length+data.length;
  }
  const size=central.reduce((n,c)=>n+c.length,0),end=header(22);end.view.setUint32(0,0x06054b50,true);end.view.setUint16(8,central.length,true);end.view.setUint16(10,central.length,true);end.view.setUint32(12,size,true);end.view.setUint32(16,offset,true);
  const output=new Uint8Array(offset+size+end.bytes.length);let pos=0;for(const chunk of [...chunks,...central,end.bytes]) {output.set(chunk,pos);pos+=chunk.length;}return output.buffer;
}
export function createWordReport(db: BitacoraDB, scope: 'all' | 'day', date: string): ArrayBuffer {
  const tables=reportTables(db,scope,date);
  const paragraph=(text:string,bold=false)=>`<w:p><w:r>${bold?'<w:rPr><w:b/></w:rPr>':''}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
  const row=(values:(string|number)[],bold=false)=>`<w:tr>${values.map(v=>`<w:tc>${paragraph(String(v),bold)}</w:tc>`).join('')}</w:tr>`;
  const body=paragraph('Bitácora Fit Pro',true)+paragraph(`Alcance: ${scope==='day'?date:'Historial completo'}`)+tables.filter(t=>t.rows.length).map(t=>paragraph(t.title,true)+`<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr><w:tblGrid>${t.headers.map(()=>'<w:gridCol w:w="1500"/>').join('')}</w:tblGrid>${row(t.headers,true)}${t.rows.map(r=>row(r)).join('')}</w:tbl>`).join('');
  return zipFiles({
    '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml':`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr></w:body></w:document>`,
  });
}
export async function exportWordReport(db: BitacoraDB, scope: 'all' | 'day', date: string): Promise<string> {
  return saveAndDeliverFile(reportName(scope,date,'docx'),'application/vnd.openxmlformats-officedocument.wordprocessingml.document',createWordReport(db,scope,date));
}
