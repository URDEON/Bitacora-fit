import test from 'node:test';
import assert from 'node:assert/strict';
import {inflateRawSync} from 'node:zlib';
import {createEmptyDB} from '../src/services/storage';
import {createExcelReport,createPDFReport,createWordReport,workoutVolume,getFilteredExportCollections} from '../src/services/exportService';
function unzip(buffer:ArrayBuffer): Record<string,string> {
 const bytes=new Uint8Array(buffer),view=new DataView(buffer),decoder=new TextDecoder(),files:Record<string,string>={};
 assert.equal(view.getUint32(bytes.length-22,true),0x06054b50);
 let offset=view.getUint32(bytes.length-6,true);const total=view.getUint16(bytes.length-12,true);
 for(let i=0;i<total;i++) {
  assert.equal(view.getUint32(offset,true),0x02014b50);const size=view.getUint32(offset+20,true),nameLength=view.getUint16(offset+28,true),extraLength=view.getUint16(offset+30,true),commentLength=view.getUint16(offset+32,true),local=view.getUint32(offset+42,true);
  assert.equal(view.getUint32(local,true),0x04034b50);const name=decoder.decode(bytes.subarray(offset+46,offset+46+nameLength)),start=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true),data=bytes.subarray(start,start+size);
  files[name]=decoder.decode(view.getUint16(offset+10,true)===8?inflateRawSync(data):data);offset+=46+nameLength+extraLength+commentLength;
 }
 return files;
}
function sample() {
  const db=createEmptyDB();db.workouts=[{id:1,date:'2026-10-30',time:'19:20',category:'Pecho',name:'Press <seguro> & fuerza',mode:'strength',sets:2,reps:10,weight:20,setDetails:[{reps:10,weight:20},{reps:8,weight:30}],restSeconds:90,notes:'Texto & <script>alert(1)</script>'}];
  db.meals=[{id:2,date:'2026-10-30',time:'20:00',mealType:'Cena',desc:'Arroz con pollo',calories:500,protein:30,carbs:60,fat:12}];
  db.waterLogs=[{id:3,date:'2026-10-30',time:'20:15',ml:350,label:'Vaso'}];
  db.bodyMetrics=[{id:4,date:'2026-10-29',time:'08:00',weightKg:80,bodyFatPct:0,notes:'Pesaje'}];return db;
}
test('filtra por fecha seleccionada y calcula volumen de series diferentes',()=>{const db=sample();assert.equal(workoutVolume(db.workouts[0]),440);assert.equal(getFilteredExportCollections(db,'day','2026-10-30').bodyMetrics.length,0);});
test('Excel es un XLSX válido, conserva horas, nutrientes y volumen verdadero',async()=>{
 const output=await createExcelReport(sample(),'all','2026-10-30'),files=unzip(output);
 assert.equal(Object.keys(files).filter(p=>p.startsWith('xl/worksheets/')).length,5);
 assert.match(files['xl/workbook.xml'],/name="Fuerza"/);const strength=files['xl/worksheets/sheet1.xml'];
 assert.match(strength,/<v>440<\/v>/);assert.match(strength,/19:20/);assert.match(strength,/8 rep × 30 kg/);
 assert.match(files['xl/worksheets/sheet3.xml'],/<v>60<\/v>/);assert.match(files['xl/worksheets/sheet3.xml'],/<v>12<\/v>/);
 assert.doesNotMatch(strength,/<f>/);
});
test('PDF genera cabecera, páginas y fecha seleccionada auténticas',async()=>{
 const bytes=new Uint8Array(await createPDFReport(sample(),'day','2026-10-30'));const pdf=new TextDecoder().decode(bytes);
 assert.equal(pdf.slice(0,5),'%PDF-');assert.match(pdf,/2026-10-30/);assert.match(pdf,/%%EOF/);assert.ok(bytes.length>3000);
});
test('Word genera un contenedor DOCX OOXML real y escapa el texto editable',()=>{
 const buffer=createWordReport(sample(),'all','2026-10-30');const bytes=new Uint8Array(buffer);assert.deepEqual([...bytes.slice(0,4)],[80,75,3,4]);
 const files=unzip(buffer);const xml=files['word/document.xml'];assert.ok(xml);assert.match(xml,/<w:document/);assert.match(xml,/2026-10-30/);assert.match(xml,/&lt;script&gt;/);assert.doesNotMatch(xml,/<script>/);assert.match(xml,/440/);
});
test('los reportes vacíos explican por qué no se pueden exportar',async()=>{for(const fn of [createExcelReport,createPDFReport])await assert.rejects(fn(createEmptyDB(),'all','2026-10-30'),/No hay registros/);assert.throws(()=>createWordReport(createEmptyDB(),'all','2026-10-30'),/No hay registros/);});
