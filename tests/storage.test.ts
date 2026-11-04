import test from 'node:test';
import assert from 'node:assert/strict';
import {createEmptyDB, normalizeDB, parseBackupJSON, mergeDatabases, selectLatestSnapshot, persistDB, initializePersistentStorage, saveUndoSnapshot, loadUndoSnapshot} from '../src/services/storage';

const workout = {id:1,date:'2026-11-02',time:'12:30',category:'Pecho',name:'Press',mode:'strength' as const,sets:2,reps:10,weight:25,setDetails:[{reps:10,weight:20},{reps:8,weight:25}]};
function sample() {const db=createEmptyDB(); db.workouts=[structuredClone(workout)];db.updatedAt=100;return db;}
function mockLocalStorage(throws=false) {const memory=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>memory.get(key)??null,setItem:(key:string,value:string)=>{if(throws)throw new Error('Quota exceeded');memory.set(key,value);}}});return memory;}

test('migra v4 y preserva rutinas vacías, series y sesión activa en un respaldo completo',()=>{
  const legacy=normalizeDB({workouts:[workout],meals:[],waterLogs:[],customCatalog:{Pecho:['Mi ejercicio']}});
  assert.equal(legacy.workouts[0].name,'Press');assert.equal(legacy.version,5);assert.equal(legacy.favoriteExercises.length,0);
  const db=sample();db.routines=[];db.favoriteExercises=['Press'];db.activeSession={id:'s1',title:'Mi sesión',startedAt:'2026-11-02T12:00:00Z',exercises:[workout],completedIds:[1]};
  const restored=parseBackupJSON(JSON.stringify(db));assert.deepEqual(restored,db);assert.equal(restored.routines.length,0);
});
test('rechaza valores negativos, null, fechas imposibles, modos y estructuras inválidas',()=>{
  for(const mutation of [
    (db:any)=>db.workouts.push(null),(db:any)=>db.workouts[0].weight=-1,(db:any)=>db.workouts[0].date='2026-02-30',
    (db:any)=>db.workouts[0].mode='invalid',(db:any)=>db.workouts[0].setDetails[0].reps=0,
    (db:any)=>db.meals.push({id:2,date:'2026-11-02',time:'24:00',desc:'Pan',mealType:'Cena',calories:100,protein:5}),
    (db:any)=>db.waterLogs.push({id:3,date:'2026-11-02',time:'13:00',ml:-50,label:'Agua'}),
    (db:any)=>db.customCatalog.Pecho='cadena',(db:any)=>db.goals.waterMl=0,
  ]) {const db=sample();mutation(db);assert.throws(()=>parseBackupJSON(JSON.stringify(db)));}
  assert.throws(()=>parseBackupJSON('{"workouts":[],"__proto__":{"polluted":true}}'));
  assert.throws(()=>parseBackupJSON('[]'));assert.throws(()=>parseBackupJSON('{'));
});
test('no admite identificadores duplicados ni versiones futuras desconocidas',()=>{
  const db=sample();db.workouts.push({...workout});assert.throws(()=>parseBackupJSON(JSON.stringify(db)),/identificadores/);
  db.workouts.pop();db.version=100;assert.throws(()=>parseBackupJSON(JSON.stringify(db)));
});
test('combinar dos veces es idempotente y conserva ambos registros en colisión sin cambiar metas',()=>{
  const current=sample(),incoming=sample();incoming.workouts[0].weight=30;incoming.goals.calories=3000;
  const merged=mergeDatabases(current,incoming);assert.equal(merged.workouts.length,2);assert.equal(new Set(merged.workouts.map(w=>w.id)).size,2);
  assert.equal(merged.goals.calories,current.goals.calories);assert.equal(mergeDatabases(merged,incoming).workouts.length,2);
});
test('la copia más reciente vacía conserva una eliminación y no resucita registros antiguos',()=>{
  const old=sample(),cleared=createEmptyDB();cleared.updatedAt=200;
  assert.equal(selectLatestSnapshot([old,cleared]).workouts.length,0);
  assert.equal(selectLatestSnapshot([cleared,old]).updatedAt,200);
});
test('guardar, reabrir, editar, borrar y deshacer persiste sin mutar snapshots anteriores',async()=>{
  mockLocalStorage();const db=sample();const saved=await persistDB(db);assert.ok(saved.updatedAt>100);
  db.workouts[0].name='Mutación posterior';assert.equal((await initializePersistentStorage()).workouts[0].name,'Press');
  saveUndoSnapshot(saved);const empty={...saved,workouts:[]};await persistDB(empty);assert.equal((await initializePersistentStorage()).workouts.length,0);
  assert.equal(loadUndoSnapshot()?.workouts[0].name,'Press');
});
test('el guardado informa fallo cuando ningún almacenamiento acepta la escritura',async()=>{
  mockLocalStorage(true);assert.equal(saveUndoSnapshot(sample()),false);await assert.rejects(persistDB(sample()),/No se pudieron guardar/);
  mockLocalStorage();await persistDB(sample());
});
test('importar sesiones con colisión conserva las referencias y no duplica la segunda importación',()=>{
 const current=sample(),incoming=sample();
 current.workouts[0].sessionId='sesion';incoming.workouts[0].sessionId='sesion';incoming.workouts[0].weight=50;
 const session={id:'sesion',title:'Actual',startedAt:'2026-11-02T12:00:00Z',finishedAt:'2026-11-02T13:00:00Z',exercises:[{name:'Press',category:'Pecho',mode:'strength' as const}],completedIds:[1]};
 current.workoutSessions=[session];incoming.workoutSessions=[{...session,title:'Importada'}];
 const merged=mergeDatabases(current,incoming);assert.equal(merged.workoutSessions.length,2);
 const imported=merged.workoutSessions.find(s=>s.title==='Importada')!;const recorded=merged.workouts.find(w=>w.weight===50)!;
 assert.equal(recorded.sessionId,imported.id);assert.deepEqual(imported.completedIds,[recorded.id]);
 const again=mergeDatabases(merged,incoming);assert.equal(again.workoutSessions.length,2);assert.equal(again.workouts.length,2);
});
test('rechaza temporizadores imposibles y registros incompletos sin alterar valores',()=>{
 for(const change of [(db:any)=>db.chrono.hiitWorkSec=0,(db:any)=>db.chrono.hiitRestSec=0,(db:any)=>db.chrono.hiitTotalRounds=1.5,(db:any)=>db.chrono.running=true,(db:any)=>{delete db.workouts[0].setDetails;delete db.workouts[0].reps;},(db:any)=>{db.workouts[0].mode='time';delete db.workouts[0].seconds;}]) {
  const db=sample();change(db);assert.throws(()=>parseBackupJSON(JSON.stringify(db)));
 }
});
test('combinar preserva dos tomas reales iguales con identificadores distintos',()=>{
 const current=sample(),incoming=sample();const water={id:10,date:'2026-11-02',time:'12:00',ml:250,label:'Vaso'};
 current.waterLogs=[water];incoming.waterLogs=[{...water,id:11}];
 const merged=mergeDatabases(current,incoming);assert.equal(merged.waterLogs.length,2);
 assert.equal(mergeDatabases(merged,incoming).waterLogs.length,2);
});
