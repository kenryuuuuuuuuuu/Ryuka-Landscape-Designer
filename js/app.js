/* ============================================================
 Ryuka Landscape Designer v4.8.0
 - Base coordinates/numeric values are preserved from v2.2.
 - x=east, z=south, y=up. Units: meters.
 ============================================================ */

const DATA = window.DATA;

const STATE={mode:'real',doy:188,tod:720,northOff:0,playing:false,sunPath:true,context:true,measure:false,quality:['auto','high','low'].includes(localStorage.getItem('ryuka-render-quality'))?localStorage.getItem('ryuka-render-quality'):'auto',modelDetail:['auto','detailed','simple'].includes(localStorage.getItem('ryuka-model-detail'))?localStorage.getItem('ryuka-model-detail'):'auto',
 layers:{facilities:true,paths:true,guestBeds:true,herbs:true,rotations:true,trees:true,lawn:true,labels:true},
 guides:{labels:true,grid:false,boundary:true,crowns:false},season:'summer',growthYear:3,density:'standard',cropPattern:'A',showFlowers:true,showFruit:true,activePlan:'A'}

// ---------- utilities ----------
const $=id=>document.getElementById(id);
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function seeded(seed){let s=seed>>>0;return()=>((s=(s*1664525+1013904223)>>>0)/4294967296)}
function polyArea(p){let s=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];s+=a.x*b.z-b.x*a.z}return Math.abs(s)/2}
function validateFixedSiteData(){
 const errors=[],required=['site','edgeLengths','building','siteArea','takuchiArea','lat','lon','paths','rotations','trees','facilities','guestGarden','herbs','lawn','labels'];
 required.forEach(key=>{if(DATA?.[key]===undefined||DATA[key]===null)errors.push(`必須データ「${key}」がありません`)});
 if(DATA?.site?.length!==5)errors.push(`敷地点数が5点ではありません（${DATA?.site?.length??0}点）`);
 ['cx','cz','w','d'].forEach(key=>{if(!Number.isFinite(DATA?.building?.[key]))errors.push(`必須データ「building.${key}」がありません`)});
 if(DATA?.building?.w!==19.11||DATA?.building?.d!==7.28)errors.push('建物寸法が19.11 × 7.28mではありません');
 if(!Number.isFinite(DATA?.siteArea)||Math.abs(DATA.siteArea-988.87)>.05)errors.push(`固定敷地面積が約988.87㎡ではありません（${Number.isFinite(DATA?.siteArea)?DATA.siteArea.toFixed(2):'未設定'}㎡）`);
 const calculatedArea=DATA?.site?.length>=3?polyArea(DATA.site):NaN;
 if(!Number.isFinite(calculatedArea)||Math.abs(calculatedArea-988.87)>.05)errors.push(`敷地面積が約988.87㎡ではありません（${Number.isFinite(calculatedArea)?calculatedArea.toFixed(2):'計算不能'}㎡）`);
 if(Math.abs((DATA?.takuchiArea??NaN)-319)>.05)errors.push('宅地面積が約319㎡ではありません');
 if(!Array.isArray(DATA?.paths)||DATA.paths.length===0)errors.push('園路データが空です');
 if(!Array.isArray(DATA?.rotations)||DATA.rotations.length!==4)errors.push(`輪作区画が4区画ではありません（${DATA?.rotations?.length??0}区画）`);
 if(!Array.isArray(DATA?.trees)||DATA.trees.length===0)errors.push('果樹・植物データが空です');
 if(!Array.isArray(DATA?.labels)||DATA.labels.length===0)errors.push('ラベルデータが空です');
 if(!Object.isFrozen(DATA)||!Object.isFrozen(DATA?.site)||!Object.isFrozen(DATA?.building))errors.push('固定データがObject.freezeで保護されていません');
 if(errors.length){console.error('[Ryuka] 固定データ検証エラー',errors);const warning=document.createElement('div');warning.id='fixedDataWarning';warning.setAttribute('role','alert');warning.textContent=`固定データに異常があります：${errors.join('／')}`;Object.assign(warning.style,{position:'fixed',left:'12px',right:'12px',top:'72px',zIndex:'1000',padding:'12px 16px',borderRadius:'10px',background:'#a62828',color:'#fff',fontSize:'12px',boxShadow:'0 8px 30px rgba(0,0,0,.35)'});document.body.appendChild(warning)}
 return errors.length===0;
}
function isEffectivelyVisible(object){let current=object;while(current){if(current.visible===false)return false;current=current.parent}return true}
window.RYUKA_VISIBILITY_UTILS=Object.freeze({isEffectivelyVisible});
if(validateFixedSiteData()){
function clipPoly(poly,t,keepNorth){const out=[],inside=p=>keepNorth?p.z<=t:p.z>=t;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ia=inside(a),ib=inside(b);if(ia)out.push({...a});if(ia!==ib){const q=(t-a.z)/(b.z-a.z);out.push({x:a.x+(b.x-a.x)*q,z:t})}}return out}
function shapeFrom(poly){const s=new THREE.Shape();poly.forEach((p,i)=>i?s.lineTo(p.x,-p.z):s.moveTo(p.x,-p.z));return s}
function disposeObj(o){if(!o)return;o.traverse?.(c=>{c.geometry?.dispose?.();if(c.material){const ms=Array.isArray(c.material)?c.material:[c.material];ms.forEach(m=>{Object.values(m).forEach(v=>v&&v.isTexture&&v.dispose?.());m.dispose?.()})}})}
function fmtTime(m){return`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`}
const DAYS=[31,28,31,30,31,30,31,31,30,31,30,31];
function doyToMD(d){let m=0;while(d>DAYS[m]){d-=DAYS[m];m++}return`${m+1}/${d}`}
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),1800)}

// ---------- renderer / scene ----------
const container=$('scene');
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;if('physicallyCorrectLights'in renderer)renderer.physicallyCorrectLights=true;container.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0xa9c1c2,.0055);
const perspective=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.1,600);
const ortho=new THREE.OrthographicCamera(-30,30,30,-30,.1,600);let camera=perspective;

// camera controller
const cam={target:new THREE.Vector3(0,1,1),r:72,a:Math.PI*.76,p:.82,mode:'orbit'};
function applyCamera(){
 if(cam.mode==='walk'){camera=perspective;camera.position.copy(walk.pos);const dir=new THREE.Vector3(Math.sin(walk.yaw)*Math.cos(walk.pitch),Math.sin(walk.pitch),Math.cos(walk.yaw)*Math.cos(walk.pitch));camera.lookAt(walk.pos.clone().add(dir));return}
 if(camera===perspective){cam.p=clamp(cam.p,.035,1.52);cam.r=clamp(cam.r,4,220);camera.position.set(cam.target.x+cam.r*Math.sin(cam.p)*Math.sin(cam.a),cam.target.y+cam.r*Math.cos(cam.p),cam.target.z+cam.r*Math.sin(cam.p)*Math.cos(cam.a));camera.lookAt(cam.target)}
}
function setPerspective(){if(camera!==perspective){camera=perspective;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}}
function setTopCamera(){camera=ortho;const aspect=innerWidth/innerHeight,span=31;ortho.left=-span*aspect;ortho.right=span*aspect;ortho.top=span;ortho.bottom=-span;ortho.position.set(0,100,1);ortho.lookAt(0,0,0);ortho.updateProjectionMatrix()}
function flyTo(v){
 document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('on',b.dataset.view===v));
 if(v==='top'){setTopCamera();return}
 setPerspective();
 const presets={
  birdNE:{target:[0,1,1],r:72,a:Math.PI*.76,p:.82},birdSW:{target:[0,1,1],r:68,a:-Math.PI*.28,p:.86},south:{target:[1,2,0],r:62,a:Math.PI,p:1.18},
  guestWindow:{pos:[-4,1.3,-5.45],target:[-4.8,.9,4.0]},harvest:{pos:[-8,1.65,4.6],target:[1,1.1,5]},rotation:{pos:[7,1.65,6.0],target:[2,1.1,-2]},
  pergola:{pos:[-6.5,1.15,13.4],target:[1.5,2.0,-7]},yard:{pos:[17,1.65,-.2],target:[3,1.2,3]}
 };
 const q=presets[v]||presets.birdNE;
 if(q.pos){const px=q.pos[0],py=q.pos[1],pz=q.pos[2],tx=q.target[0],ty=q.target[1],tz=q.target[2];cam.target.set(tx,ty,tz);const dx=px-tx,dy=py-ty,dz=pz-tz;cam.r=Math.hypot(dx,dy,dz);cam.p=Math.acos(dy/cam.r);cam.a=Math.atan2(dx,dz)}else{cam.target.fromArray(q.target);cam.r=q.r;cam.a=q.a;cam.p=q.p}
 applyCamera();
}

// ---------- non-ground procedural textures ----------
function textureNoise(base,spots,seed=1,size=256){
 const c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d'),r=seeded(seed);x.fillStyle=base;x.fillRect(0,0,size,size);
 for(let i=0;i<spots;i++){const a=r()*.22+.03,rad=r()*3+0.4;x.fillStyle=`rgba(${r()<.5?255:0},${r()<.5?255:0},${r()<.5?255:0},${a})`;x.beginPath();x.arc(r()*size,r()*size,rad,0,Math.PI*2);x.fill()}
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(8,8);t.anisotropy=renderer.capabilities.getMaxAnisotropy();t.encoding=THREE.sRGBEncoding;return t
}
const TEX={wood:textureNoise('#76543a',1600,25)};
function matStd(color,map=null,rough=.85,metal=0){return new THREE.MeshStandardMaterial({color,map,roughness:rough,metalness:metal})}
const GROUND=createGroundMaterials(renderer);
const BUILDING=createBuildingMaterials(renderer);
const PLANTS=createPlantMaterials();
const ENVIRONMENT_MATERIALS=createEnvironmentMaterials();
const MATS={
 surrounding:GROUND.surrounding,takuchi:GROUND.takuchi,field:GROUND.field,path:GROUND.path,
 soil:GROUND.rotationSoil,green:matStd(0x6e934d,null,.9),clover:GROUND.clover,wood:matStd(0x76543a,TEX.wood,.82),
 wall:BUILDING.wall,roof:BUILDING.roof,glass:BUILDING.glass,
 planTak:GROUND.planTak,planField:GROUND.planField,planLine:new THREE.LineBasicMaterial({color:0xf6efe2})
};
const sharedMaterials=new Set(),sharedTextures=new Set(),sharedGeometries=new Set();
function collectSharedResources(value,seen=new Set()){
 if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);
 if(value.isBufferGeometry){sharedGeometries.add(value);return}
 if(value.isMaterial){sharedMaterials.add(value);Object.values(value).forEach(v=>v?.isTexture&&sharedTextures.add(v));return}
 if(value.isTexture){sharedTextures.add(value);return}
 Object.values(value).forEach(v=>collectSharedResources(v,seen));
}
collectSharedResources(GROUND);collectSharedResources(BUILDING);collectSharedResources(PLANTS);collectSharedResources(PLANT_GEOMETRIES);collectSharedResources(ENVIRONMENT_MATERIALS);collectSharedResources(ENVIRONMENT_GEOMETRIES);collectSharedResources(OBJECT_MATERIALS);collectSharedResources(OBJECT_GEOMETRIES);collectSharedResources(MATS);
const ASSET_MANAGER=createAssetManager(ASSET_CATALOG);
function registerAssetSharedResources(){const resources=ASSET_MANAGER.getSharedResources();resources.geometries.forEach(value=>sharedGeometries.add(value));resources.materials.forEach(value=>sharedMaterials.add(value));resources.textures.forEach(value=>sharedTextures.add(value))}
function resolveAssetVariant(){return STATE.modelDetail==='detailed'?'high':effectiveQuality()}
function shouldUseDetailedAsset(){return STATE.mode==='real'&&STATE.modelDetail!=='simple'}
function createAssetOrFallback(id,options,fallback,info){
 const variant=resolveAssetVariant(),asset=shouldUseDetailedAsset()?ASSET_MANAGER.createInstance(id,{...options,variant}):null;
 const item=ASSET_CATALOG.find(entry=>entry.id===id),display=asset?'詳細3Dモデル':'簡易モデル',root=asset||fallback();
 root.userData.assetId=id;root.userData.variant=asset?variant:'procedural';
 return tag(root,{...info,meta:[...(info.meta||[]),['表示方式',display],['variant',asset?variant.toUpperCase():'PROCEDURAL'],['寸法',`${options.targetSize.x.toFixed(2)} × ${options.targetSize.z.toFixed(2)}m`],['座標',`x ${options.position.x.toFixed(2)} / z ${options.position.z.toFixed(2)}`],['アセットID',id],['ライセンス',item.license]]})
}
let assetRebuildTimer=0,lastEffectiveAssetVariant=null;
function scheduleAssetBackedRebuild(){clearTimeout(assetRebuildTimer);assetRebuildTimer=setTimeout(()=>{registerAssetSharedResources();buildObjects();buildLabels();updateResourceMetrics()},80)}
function syncAssetVariant(schedule=true){const next=shouldUseDetailedAsset()?resolveAssetVariant():'procedural';if(schedule&&lastEffectiveAssetVariant!==null&&next!==lastEffectiveAssetVariant)scheduleAssetBackedRebuild();lastEffectiveAssetVariant=next}
function updateAssetStatus(status){
 const el=$('assetStatus');if(!el)return;const fallback=STATE.mode==='plan'||STATE.modelDetail==='simple'||status.failed>0;
 el.textContent=status.failed?`3Dアセット 一部失敗（準備完了 ${status.ready} / ${status.total}）`:STATE.mode==='plan'||STATE.modelDetail==='simple'?`3Dアセット 簡易表示中（準備完了 ${status.ready} / ${status.total}）`:status.loading?`3Dアセット 読み込み中 ${status.ready} / ${status.total}`:status.ready===status.total?`3Dアセット 準備完了 ${status.ready} / ${status.total}`:`3Dアセット 読み込み前 ${status.ready} / ${status.total}`;
 document.body.dataset.assetReady=String(status.ready);document.body.dataset.assetFailed=String(status.failed);document.body.dataset.assetFallback=String(fallback)
}
let lastAppliedAssetSignature='';ASSET_MANAGER.onStatusChange(status=>{registerAssetSharedResources();updateAssetStatus(status);const signature=`${status.ready}:${status.failed}`;if(status.loading===0&&status.ready+status.failed===status.total&&signature!==lastAppliedAssetSignature){lastAppliedAssetSignature=signature;if(shouldUseDetailedAsset())scheduleAssetBackedRebuild()}});

// ---------- sky, lights, context ----------
const ENVIRONMENT=createEnvironmentModel({scene,renderer,materials:ENVIRONMENT_MATERIALS,groundMaterial:MATS.surrounding,asphaltMaterial:GROUND.asphalt,data:DATA});
const contextGroup=ENVIRONMENT.context,sky=ENVIRONMENT.sky,sun=ENVIRONMENT.keyLight,hemi=ENVIRONMENT.hemi,ambient=ENVIRONMENT.ambient;
function effectiveQuality(){if(STATE.quality!=='auto')return STATE.quality;return innerWidth<=600||/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)?'low':'high'}
function applyQuality(showToast=false){const q=effectiveQuality(),cap=q==='high'?1.85:1.25;renderer.setPixelRatio(Math.min(devicePixelRatio||1,cap));renderer.setSize(innerWidth,innerHeight);ENVIRONMENT.setQuality(q);document.querySelectorAll('button[data-quality]').forEach(b=>b.classList.toggle('on',b.dataset.quality===STATE.quality));document.body.dataset.quality=q;document.body.dataset.qualityChangeCount=String(ENVIRONMENT.root.userData.qualityChangeCount||0);document.body.dataset.shadowMapDisposeCount=String(ENVIRONMENT.root.userData.shadowMapDisposeCount||0);document.body.dataset.shadowMapSize=String(ENVIRONMENT.keyLight.shadow.mapSize.x);document.body.dataset.mountainSeamMax=String(Math.max(...ENVIRONMENT.mountainGeometries.map(g=>g.userData.seamDistance)));syncAssetVariant();if(showToast)toast(STATE.quality==='auto'?'自動画質に変更':STATE.quality==='high'?'高画質に変更':'省電力画質に変更')}
applyQuality();

// ---------- core groups ----------
const ROOT=new THREE.Group();scene.add(ROOT);
const groups={site:new THREE.Group(),building:new THREE.Group(),facilities:new THREE.Group(),paths:new THREE.Group(),guestBeds:new THREE.Group(),herbs:new THREE.Group(),rotations:new THREE.Group(),trees:new THREE.Group(),lawn:new THREE.Group(),objects:new THREE.Group(),labels:new THREE.Group(),guides:new THREE.Group(),crowns:new THREE.Group()};Object.values(groups).forEach(g=>ROOT.add(g));
const selectable=[];
let resolvedPlants=DATA.trees.map((tree,index)=>({...tree,designId:`base-tree-${index}`,sourceType:'base',species:tree.name,basePosition:{x:tree.x,z:tree.z},currentPosition:{x:tree.x,z:tree.z},rotation:0}));
const plantObjects=new Map();
const BASE_OBJECTS=createBaseObjects(DATA);
let resolvedObjects=BASE_OBJECTS.map(object=>({...object,basePosition:{x:object.x,z:object.z},currentPosition:{x:object.x,z:object.z}}));
const objectObjects=new Map();
let plantEditor=null,objectEditor=null;
function tag(obj,info){obj.userData.info=info;selectable.push(obj);return obj}
function clearRebuildGroup(group){
 const members=new Set(),geometries=new Set(),materials=new Set();
 group.traverse(object=>{members.add(object);if(object.geometry)geometries.add(object.geometry);if(object.material){const list=Array.isArray(object.material)?object.material:[object.material];list.forEach(material=>materials.add(material))}});
 for(let i=selectable.length-1;i>=0;i--)if(members.has(selectable[i]))selectable.splice(i,1);
 geometries.forEach(geometry=>{if(!sharedGeometries.has(geometry))geometry.dispose?.()});
 materials.forEach(material=>{if(!sharedMaterials.has(material)){Object.values(material).forEach(value=>{if(value?.isTexture&&!sharedTextures.has(value))value.dispose?.()});material.dispose?.()}});
 group.clear();
}
function updateResourceMetrics(){requestAnimationFrame(()=>requestAnimationFrame(()=>{let lightCount=0;scene.traverse(object=>{if(object.isLight)lightCount++});const baseDrift=resolvedObjects.filter(item=>item.sourceType==='base').reduce((max,item)=>Math.max(max,Math.hypot(item.x-item.basePosition.x,item.z-item.basePosition.z)),0);document.body.dataset.selectableCount=String(selectable.length);document.body.dataset.geometryCount=String(renderer.info.memory.geometries);document.body.dataset.textureCount=String(renderer.info.memory.textures);document.body.dataset.lightCount=String(lightCount);document.body.dataset.objectCount=String(resolvedObjects.length);document.body.dataset.baseObjectDriftMax=String(baseDrift)}))}
function meshShape(poly,mat,y=.01){const m=new THREE.Mesh(new THREE.ShapeGeometry(shapeFrom(poly)),mat);m.rotation.x=-Math.PI/2;m.position.y=y;m.receiveShadow=true;return m}
function box(w,h,d,mat,x,z,y=h/2){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return m}
function cyl(rt,rb,h,mat,x,z,y=h/2,seg=12){const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return m}
function soilRidge(w,d,mat,x,z){const m=new THREE.Mesh(new THREE.CylinderGeometry(w*.48,w*.5,d-.6,8,1,false),mat);m.rotation.x=Math.PI/2;m.position.set(x,.16,z);m.scale.z=.72;m.castShadow=true;m.receiveShadow=true;return m}
function spriteText(text,{scale=2.2,color='#f3ecde',bg='rgba(14,21,23,.72)'}={}){const c=document.createElement('canvas'),x=c.getContext('2d');x.font='600 54px -apple-system,"Hiragino Sans",sans-serif';const w=Math.ceil(x.measureText(text).width)+30;c.width=w;c.height=82;const y=c.getContext('2d');if(bg){y.fillStyle=bg;y.roundRect?.(0,0,c.width,c.height,12);y.fill?.();if(!y.roundRect){y.fillRect(0,0,c.width,c.height)}}y.font='600 54px -apple-system,"Hiragino Sans",sans-serif';y.textBaseline='middle';y.fillStyle=color;y.fillText(text,15,c.height/2);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:false,transparent:true}));s.scale.set(scale*c.width/c.height,scale,1);return s}

// ---------- site / split ----------
const zMin=Math.min(...DATA.site.map(p=>p.z)),zMax=Math.max(...DATA.site.map(p=>p.z));function northAreaAt(t){return polyArea(clipPoly(DATA.site,t,true))}
let splitDefault=(()=>{let lo=zMin,hi=zMax;for(let i=0;i<70;i++){const m=(lo+hi)/2;northAreaAt(m)<DATA.takuchiArea?lo=m:hi=m}return(lo+hi)/2})();let splitT=splitDefault,siteMeshes=[];
function buildSite(){clearRebuildGroup(groups.site);siteMeshes=[];const n=clipPoly(DATA.site,splitT,true),s=clipPoly(DATA.site,splitT,false);const mn=meshShape(n,STATE.mode==='real'?GROUND.takuchi:GROUND.planTak,.002),ms=meshShape(s,STATE.mode==='real'?GROUND.field:GROUND.planField,.003);groups.site.add(mn,ms);siteMeshes.push(mn,ms);tag(mn,{title:'北側宅地',body:'建物・進入路・作業ヤードを含む宅地想定エリア。',meta:[['面積',northAreaAt(splitT).toFixed(1)+'㎡'],['基準','登記値319㎡']]});tag(ms,{title:'南側の畑',body:'収穫体験、輪作、果樹、ハーブ、広場、パーゴラをまとめたランドスケープエリア。',meta:[['面積',(polyArea(DATA.site)-northAreaAt(splitT)).toFixed(1)+'㎡']]});
 $('northArea').textContent=northAreaAt(splitT).toFixed(1)+'㎡';$('fieldArea').textContent=(polyArea(DATA.site)-northAreaAt(splitT)).toFixed(1)+'㎡';buildBoundary()}
let boundaryObjects=[];
function buildBoundary(){boundaryObjects.forEach(o=>{groups.guides.remove(o);disposeObj(o)});boundaryObjects=[];const pts=DATA.site.map(p=>new THREE.Vector3(p.x,.08,p.z));pts.push(pts[0].clone());const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:STATE.mode==='real'?0xf2eadc:0xffffff,transparent:true,opacity:.92}));groups.guides.add(line);boundaryObjects.push(line);const n=clipPoly(DATA.site,splitT,true),xs=n.filter(p=>Math.abs(p.z-splitT)<1e-5).map(p=>p.x);if(xs.length>1){const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(Math.min(...xs),.1,splitT),new THREE.Vector3(Math.max(...xs),.1,splitT)]),l=new THREE.Line(g,new THREE.LineDashedMaterial({color:0xffffff,dashSize:.8,gapSize:.55,transparent:true,opacity:.82}));l.computeLineDistances();groups.guides.add(l);boundaryObjects.push(l)}groups.guides.visible=STATE.guides.boundary}

// ---------- building ----------
function buildBuilding(){clearRebuildGroup(groups.building);groups.building.add(createBuildingModel({data:DATA.building,materials:BUILDING,mode:STATE.mode,tag}))}

// ---------- paths / facilities ----------
function buildPaths(){clearRebuildGroup(groups.paths);const material=STATE.mode==='real'?GROUND.path:GROUND.planPath;DATA.paths.forEach((p,i)=>{const m=meshShape(p,material,.045);groups.paths.add(tag(m,{title:'園路・作業動線',body:'建物、井戸、輪作区画、広場をつなぐ通路。元HTMLの四つのポリゴン座標を保持しています。',meta:[['区間',String(i+1)]]}))})}
function buildFacilities(){clearRebuildGroup(groups.facilities);const F=DATA.facilities,yard=meshShape(F.yard,STATE.mode==='real'?GROUND.yardGravel:GROUND.planGravel,.05);groups.facilities.add(tag(yard,{title:'作業ヤード',body:'道具収納、資材仮置き、畑作業の起点となる砕石エリア。',meta:[['位置','東側・建物南東']] }))}

// ---------- planting helpers ----------
function addPlantCluster(parent,x,z,color=0x648b46,scale=.22,seed=1){const r=seeded(seed),g=new THREE.Group();for(let i=0;i<5;i++){const leaf=new THREE.Mesh(new THREE.SphereGeometry(scale*(.6+r()*.55),7,5),matStd(color));leaf.scale.y=.65;leaf.position.set((r()-.5)*scale*2,.12+r()*.12,(r()-.5)*scale*2);leaf.castShadow=true;g.add(leaf)}g.position.set(x,0,z);parent.add(g);return g}
function raisedBed(parent,x,z,w,d,seed=1,green=0x668e48,info=null){const details=info||{title:'レイズドベッド',body:'土と植栽は従来のプロシージャル表現を維持し、木枠だけを3Dアセット化しています。',meta:[]},frame=createAssetOrFallback('raised-bed-frame',{targetSize:{x:w,y:.42,z:d},position:{x,y:0,z}},()=>box(w,.38,d,MATS.wood,x,z,.19),details),soil=box(w-.16,.08,d-.16,STATE.mode==='real'?GROUND.guestSoil:GROUND.planSoil,x,z,.42);parent.add(frame,soil);const r=seeded(seed),cols=Math.max(2,Math.floor(w/.42)),rows=Math.max(2,Math.floor(d/.42));for(let ix=0;ix<cols;ix++)for(let iz=0;iz<rows;iz++){if(r()<.18)continue;addPlantCluster(parent,x-w/2+.28+ix*(w-.56)/(cols-1),z-d/2+.25+iz*(d-.5)/(rows-1),green,.14,seed+ix*31+iz)}return frame}
function buildGuestBeds(){clearRebuildGroup(groups.guestBeds)}
function buildHerbs(){clearRebuildGroup(groups.herbs);const H=DATA.herbs,ground=meshShape(H.ground,STATE.mode==='real'?GROUND.guestSoil:GROUND.planSoil,.035);groups.herbs.add(tag(ground,{title:'ハーブの帯',body:'民泊から西側の中景をつくる宿根草中心の帯状植栽。ラベンダー、ローズマリー等を想定。',meta:[['範囲','西側境界沿い']]}));H.clusters.forEach((p,i)=>{for(let k=0;k<7;k++){const a=k/7*Math.PI*2,r=.2+(.08*(k%2));addPlantCluster(groups.herbs,p.x+Math.sin(a)*r,p.z+Math.cos(a)*r,0x776f9c,.11,300+i*20+k)}});addPlantCluster(groups.herbs,H.accent.x,H.accent.z,0x4f7648,.38,350)}
function buildLawn(){clearRebuildGroup(groups.lawn);const L=DATA.lawn,lawnMaterial=STATE.mode==='real'?GROUND.clover:GROUND.planClover,a=meshShape(L.west,lawnMaterial,.04),b=meshShape(L.east,lawnMaterial,.04);groups.lawn.add(tag(a,{title:'クローバー広場',body:'畑の中に余白と滞在場所をつくる低草地。パーゴラへの動線と果樹景観をつなぎます。',meta:[['位置','南側中央〜西']]}),b)}

// ---------- labels / grid ----------
const objectFixedLabels=new Set(['浅井戸・洗い場','パーゴラテラス']);
function buildLabels(){plantObjects.forEach(entry=>{entry.label=null});objectObjects.forEach(entry=>{entry.label=null});clearRebuildGroup(groups.labels);const showObjectLabels=!!objectEditor?.isEditing()||STATE.guides.labels||STATE.mode==='plan';DATA.labels.forEach(l=>{if(objectFixedLabels.has(l[0]))return;const s=spriteText(l[0],{scale:l[3]});s.position.set(l[1],2.7,l[2]);groups.labels.add(s)});resolvedPlants.forEach(t=>{const s=spriteText(t.name,{scale:1.35,color:'#dcecc7'});s.position.set(t.x,(t.bush?1.6:t.h+t.r+1),t.z);s.userData.designId=t.designId;groups.labels.add(s);const entry=plantObjects.get(t.designId);if(entry)entry.label=s});if(showObjectLabels)resolvedObjects.forEach(item=>{const entry=objectObjects.get(item.designId);if(!entry?.group.visible)return;const s=spriteText(item.label,{scale:1.15,color:'#f1dfba'});s.position.set(item.x,item.height+1,item.z);s.userData.designId=item.designId;groups.labels.add(s);entry.label=s});groups.labels.visible=STATE.guides.labels||STATE.mode==='plan'||!!objectEditor?.isEditing()}
const gridGroup=new THREE.Group();groups.guides.add(gridGroup);
function buildGrid(){gridGroup.clear();const x0=Math.floor(Math.min(...DATA.site.map(p=>p.x))/5)*5,x1=Math.ceil(Math.max(...DATA.site.map(p=>p.x))/5)*5,z0=Math.floor(zMin/5)*5,z1=Math.ceil(zMax/5)*5,pts=[];for(let x=x0;x<=x1;x+=5)pts.push(new THREE.Vector3(x,.07,z0),new THREE.Vector3(x,.07,z1));for(let z=z0;z<=z1;z+=5)pts.push(new THREE.Vector3(x0,.07,z),new THREE.Vector3(x1,.07,z));gridGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x8ec1ca,transparent:true,opacity:.34})));gridGroup.visible=STATE.guides.grid}

// ---------- compass / sun path ----------
const compass=new THREE.Group();ROOT.add(compass);['北','東','南','西'].forEach((t,i)=>{const a=i*Math.PI/2,s=spriteText(t,{scale:i===0?1.9:1.45,color:i===0?'#ff9b63':'#b7c3c0',bg:null});s.position.set(34*Math.sin(a),1.6,-34*Math.cos(a));compass.add(s)});const arr=new THREE.Mesh(new THREE.ConeGeometry(.75,2.5,4),new THREE.MeshBasicMaterial({color:0xe97c42}));arr.position.set(0,.22,-31);arr.rotation.x=-Math.PI/2;compass.add(arr);
let sunPathObj=null;
function sunAltAz(doy,minutes){const rad=Math.PI/180,decl=23.45*rad*Math.sin(2*Math.PI*(284+doy)/365),B=2*Math.PI*(doy-81)/365,eot=9.87*Math.sin(2*B)-7.53*Math.cos(B)-1.5*Math.sin(B),solar=minutes+4*(DATA.lon-135)+eot,H=(solar/60-12)*15*rad,lat=DATA.lat*rad,sinAlt=Math.sin(lat)*Math.sin(decl)+Math.cos(lat)*Math.cos(decl)*Math.cos(H),alt=Math.asin(sinAlt);let cosAz=(Math.sin(decl)-sinAlt*Math.sin(lat))/(Math.cos(alt)*Math.cos(lat));cosAz=clamp(cosAz,-1,1);let az=Math.acos(cosAz);if(H>0)az=2*Math.PI-az;return{alt,az}}
function sunTimes(doy){let rise=null,set=null,prev=sunAltAz(doy,0).alt;for(let m=5;m<=1439;m+=5){const a=sunAltAz(doy,m).alt;if(prev<=0&&a>0)rise=m;if(prev>0&&a<=0)set=m;prev=a}return{rise,set}}
function buildSunPath(){if(sunPathObj){scene.remove(sunPathObj);disposeObj(sunPathObj);sunPathObj=null}if(!STATE.sunPath)return;const pts=[],off=STATE.northOff*Math.PI/180;for(let m=240;m<=1220;m+=10){const q=sunAltAz(STATE.doy,m);if(q.alt<=0)continue;const p=q.az+off,R=52;pts.push(new THREE.Vector3(R*Math.sin(p)*Math.cos(q.alt),R*Math.sin(q.alt),-R*Math.cos(p)*Math.cos(q.alt)))}sunPathObj=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xffc66e,transparent:true,opacity:.48}));scene.add(sunPathObj)}
function updateSun(){const q=sunAltAz(STATE.doy,STATE.tod),off=STATE.northOff*Math.PI/180,p=q.az+off;ENVIRONMENT.update({altitude:q.alt,azimuth:p,mode:STATE.mode,exposure:+$('exposure').value/100});document.body.dataset.environmentPeriod=ENVIRONMENT.root.userData.period;
 const st=sunTimes(STATE.doy),md=doyToMD(STATE.doy),tm=fmtTime(STATE.tod);$('timeHeadline').textContent=`${md} ${tm}`;$('timeHeadline').dataset.value=tm;$('timelineOut').textContent=tm;$('todOut').textContent=tm;$('doyOut').textContent=md;$('altRead').textContent=(q.alt*180/Math.PI).toFixed(1)+'°';$('riseRead').textContent=st.rise?fmtTime(st.rise):'--';$('setRead').textContent=st.set?fmtTime(st.set):'--';$('tod').value=$('timelineRange').value=STATE.tod;$('doy').value=STATE.doy}

// ---------- mode styling ----------
function setMode(mode){STATE.mode=mode;syncAssetVariant(false);updateAssetStatus(ASSET_MANAGER.getStatus());document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('on',b.dataset.mode===mode));$('insMeta').lastElementChild.textContent=mode==='real'?'リアル':'設計図';
 if(mode==='real'){renderer.toneMapping=THREE.ACESFilmicToneMapping;scene.fog.density=.0055;contextGroup.visible=STATE.context;groups.labels.visible=STATE.guides.labels;groups.guides.visible=STATE.guides.boundary||STATE.guides.grid;sky.visible=true}else{renderer.toneMapping=THREE.NoToneMapping;scene.fog.density=.002;contextGroup.visible=false;groups.labels.visible=true;groups.guides.visible=true;sky.visible=true}
 buildSite();buildBuilding();buildPaths();buildFacilities();buildGuestBeds();buildHerbs();buildRotations();buildTrees();buildLawn();buildObjects();buildLabels();updateResourceMetrics();toast(mode==='real'?'リアル表示に切替':'設計図表示に切替')}

// ---------- build all ----------

// ---------- v4.6.0 growth, seasons, walk-through and design storage ----------
const PLAN_DEFAULTS={A:{season:'summer',growthYear:3,density:'standard',cropPattern:'A',showFlowers:true,showFruit:true},B:{season:'autumn',growthYear:5,density:'lush',cropPattern:'B',showFlowers:true,showFruit:true}};
const DESIGN=createDesignState({baseTrees:DATA.trees,baseObjects:BASE_OBJECTS,defaults:PLAN_DEFAULTS,storageKey:'ryuka-v4-plans'});
let plans=DESIGN.plans;DESIGN.setActivePlan(STATE.activePlan);
const walk={pos:new THREE.Vector3(-4,1.65,-4.8),yaw:Math.PI,pitch:0,keys:{},drag:null,joystick:{x:0,y:0,pointerId:null}};
const SEASON_COLORS={spring:[0x78a95c,0x94bb68],summer:[0x4f873f,0x6b9d4f],autumn:[0x9a7a3f,0xb46d35],winter:[0x6e7659,0x78806c]};
const CROP_NAMES={A:['果菜類','葉物・根菜','つる物','緑肥・休耕'],B:['豆類','果菜類','葉物・香味','根菜類']};
function densityFactor(){return STATE.density==='low'?.62:STATE.density==='lush'?1.38:1}
function buildTrees(){
 plantEditor?.beforeRebuild();
 clearRebuildGroup(groups.trees);clearRebuildGroup(groups.crowns);
 plantObjects.clear();resolvedPlants=DESIGN.resolve(STATE.activePlan);
 resolvedPlants.forEach((t,i)=>{
  const model=createPlantModel(t,i,{season:STATE.season,growthYear:STATE.growthYear,showFlowers:STATE.showFlowers,showFruit:STATE.showFruit,mode:STATE.mode},PLANTS,tag);
  model.rotation.y=t.rotation||0;Object.assign(model.userData,{designId:t.designId,sourceType:t.sourceType,species:t.name,basePosition:t.basePosition,currentPosition:{x:t.x,z:t.z}});
  model.userData.info={title:t.name,body:`${isEvergreenSpecies(t.name)?'常緑樹':'落葉樹'}・${t.sourceType==='base'?'既存植栽':'追加植栽'}・${STATE.season}・${STATE.growthYear}年後`,meta:[['現在座標',`x ${t.x.toFixed(2)} / z ${t.z.toFixed(2)}`],['元座標',t.basePosition?`x ${t.basePosition.x.toFixed(2)} / z ${t.basePosition.z.toFixed(2)}`:'追加時配置'],['移動距離',t.basePosition?Math.hypot(t.x-t.basePosition.x,t.z-t.basePosition.z).toFixed(2)+'m':'—'],['基準樹高',`${t.h}m`],['基準樹冠半径',`${t.r}m`],['性質',isEvergreenSpecies(t.name)?'常緑':'落葉']]};
  groups.trees.add(model);
  const rr=t.r*(.75+STATE.growthYear*.075),ring=new THREE.Mesh(new THREE.RingGeometry(rr*.97,rr,48),new THREE.MeshBasicMaterial({color:isEvergreenSpecies(t.name)?0x4f8b61:0x9ac277,transparent:true,opacity:.55,side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2;ring.position.set(t.x,.13,t.z);ring.userData.designId=t.designId;groups.crowns.add(ring);plantObjects.set(t.designId,{group:model,crown:ring,plant:t})
 });
 const crownsVisible=STATE.guides.crowns||STATE.mode==='plan';groups.crowns.visible=crownsVisible;document.querySelector('[data-guide="crowns"]')?.classList.toggle('on',crownsVisible)
 plantEditor?.afterRebuild();
}
function buildObjects(){
 objectEditor?.beforeRebuild();clearRebuildGroup(groups.objects);objectObjects.clear();resolvedObjects=DESIGN.resolveObjects(STATE.activePlan);
 const variant=resolveAssetVariant();
 resolvedObjects.forEach(item=>{
  const root=createObjectModel(item,{mode:STATE.mode,modelDetail:STATE.modelDetail,variant,assetManager:ASSET_MANAGER,wood:MATS.wood,roof:MATS.roof,soil:STATE.mode==='real'?GROUND.guestSoil:GROUND.planSoil,gravel:STATE.mode==='real'?GROUND.pergolaGravel:GROUND.planGravel});
  const info={title:item.label,body:`${item.sourceType==='base'?'既存設備':'追加設備'}。固定データは変更せず、プラン別の配置差分として管理します。`,meta:[['中心',`x ${item.x.toFixed(2)} / z ${item.z.toFixed(2)}`],['寸法',`${item.width.toFixed(2)} × ${item.depth.toFixed(2)}m`],['回転',`${Math.round((item.rotation||0)*180/Math.PI)}°`]]};
  tag(root,info);root.visible=STATE.layers[item.layer||'facilities']!==false;groups.objects.add(root);objectObjects.set(item.designId,{group:root,label:null,item});
 });
 objectEditor?.afterRebuild();
}
function buildRotations(){clearRebuildGroup(groups.rotations);const density=densityFactor(),names=CROP_NAMES[STATE.cropPattern],soilMaterial=STATE.mode==='real'?GROUND.rotationSoil:GROUND.planSoil,ridgeMaterial=STATE.mode==='real'?GROUND.ridgeSoil:GROUND.planSoil;DATA.rotations.forEach((b,bi)=>{const patch=meshShape([{x:b.cx-b.w/2,z:b.cz-b.d/2},{x:b.cx+b.w/2,z:b.cz-b.d/2},{x:b.cx+b.w/2,z:b.cz+b.d/2},{x:b.cx-b.w/2,z:b.cz+b.d/2}],soilMaterial,.037);groups.rotations.add(tag(patch,{title:b.name+'｜'+names[bi],body:'季節・密度・輪作案を切り替えて完成景観を比較する区画。座標と区画寸法は固定です。',meta:[['作付',names[bi]],['寸法',`${b.w} × ${b.d}m`]]}));const n=Math.round(b.w/1.5);for(let i=0;i<n;i++){const x=b.cx-b.w/2+.75+i*(b.w-1.5)/(Math.max(1,n-1));groups.rotations.add(soilRidge(.75,b.d,ridgeMaterial,x,b.cz));const rows=Math.max(2,Math.round((b.d-.8)/(.75/density)));for(let j=0;j<rows;j++){const z=b.cz-(b.d-.8)/2+j*(b.d-.8)/Math.max(1,rows-1);if(STATE.season!=='winter'||bi===3)addPlantCluster(groups.rotations,x,z,SEASON_COLORS[STATE.season][bi%2],.12+.055*density,740+bi*200+i*30+j)}}})}
function applyGrowthUI(){
 document.querySelectorAll('[data-season]').forEach(b=>b.classList.toggle('on',b.dataset.season===STATE.season));document.querySelectorAll('[data-density]').forEach(b=>b.classList.toggle('on',b.dataset.density===STATE.density));document.querySelectorAll('[data-crop]').forEach(b=>b.classList.toggle('on',b.dataset.crop===STATE.cropPattern));
 $('growthYear').value=STATE.growthYear;$('growthYearOut').textContent=STATE.growthYear===0?'植え付け時':STATE.growthYear+'年後';$('flowerBtn').classList.toggle('on',STATE.showFlowers);$('fruitBtn').classList.toggle('on',STATE.showFruit);
 const n=CROP_NAMES[STATE.cropPattern];['A','B','C','D'].forEach((k,i)=>$('crop'+k+'Read').textContent=n[i]);$('planABtn').classList.toggle('on',STATE.activePlan==='A');$('planBBtn').classList.toggle('on',STATE.activePlan==='B');
 $('compareBadge').textContent=`PLAN ${STATE.activePlan}｜${{spring:'春',summer:'夏',autumn:'秋',winter:'冬'}[STATE.season]}・${STATE.growthYear}年後・${{low:'省管理',standard:'標準',lush:'豊かな景観'}[STATE.density]}`;
}
function rebuildPlantLayout(){buildTrees();buildLabels();applyGrowthUI();updateResourceMetrics()}
function rebuildObjectLayout(){buildObjects();buildLabels();updateResourceMetrics()}
function rebuildGrowth(){buildTrees();buildRotations();buildGuestBeds();buildHerbs();buildLawn();buildObjects();buildLabels();applyGrowthUI();updateResourceMetrics()}
function savePlan(silent=false){DESIGN.updatePlanSettings(STATE.activePlan,{season:STATE.season,growthYear:STATE.growthYear,density:STATE.density,cropPattern:STATE.cropPattern,showFlowers:STATE.showFlowers,showFruit:STATE.showFruit});plans=DESIGN.plans;if(!silent)toast(`プラン${STATE.activePlan}を保存しました`)}
function readPlan(k,skipSave=false){if(!skipSave)savePlan(true);plantEditor?.deselect();objectEditor?.deselect();STATE.activePlan=k;DESIGN.setActivePlan(k);plans=DESIGN.plans;Object.assign(STATE,plans[k]);rebuildGrowth()}
function resetJoystickInput(){walk.joystick.x=walk.joystick.y=0;walk.joystick.pointerId=null;$('joystickKnob').style.transform='translate(0,0)'}
function resetWalkInput(){walk.keys={};walk.drag=null;resetJoystickInput()}
function setPanelOpen(open){const isOpen=!!open;$('panel').classList.toggle('open',isOpen);document.body.classList.toggle('panel-open',isOpen);if(isOpen)resetWalkInput()}
function startWalk(){if(plantEditor?.isEditing()||objectEditor?.isEditing()){toast('編集モードを終了してから歩行してください');return}setPanelOpen(false);resetWalkInput();setPerspective();cam.mode='walk';walk.pos.set(-4,1.65,-4.8);walk.yaw=Math.PI;walk.pitch=0;document.body.classList.add('walking');$('walkHelp').style.display='block';$('walkBtn').classList.add('on');toast('一人称歩行を開始')}
function stopWalk(){resetWalkInput();cam.mode='orbit';document.body.classList.remove('walking');$('walkHelp').style.display='none';$('walkBtn').classList.remove('on');flyTo('birdNE')}
function preparePlantEditing(){
 if(objectEditor?.isEditing())objectEditor.end();
 if(STATE.measure){STATE.measure=false;$('measureBtn').classList.remove('on');$('measureTip').style.display='none';clearMeasure()}
 if(cam.mode==='walk')stopWalk();
 resetWalkInput();
 return true
}
function prepareObjectEditing(){
 if(plantEditor?.isEditing())plantEditor.end();
 if(STATE.measure){STATE.measure=false;$('measureBtn').classList.remove('on');$('measureTip').style.display='none';clearMeasure()}
 if(cam.mode==='walk')stopWalk();
 resetWalkInput();
 return true
}
function updateWalk(dt){if(cam.mode!=='walk')return;const speed=dt*.006,front=new THREE.Vector3(Math.sin(walk.yaw),0,Math.cos(walk.yaw)),right=new THREE.Vector3(front.z,0,-front.x),forward=(walk.keys.KeyW?1:0)-(walk.keys.KeyS?1:0)-walk.joystick.y,side=(walk.keys.KeyD?1:0)-(walk.keys.KeyA?1:0)-walk.joystick.x,len=Math.hypot(forward,side)||1;walk.pos.addScaledVector(front,speed*forward/Math.max(1,len));walk.pos.addScaledVector(right,speed*side/Math.max(1,len));walk.pos.x=clamp(walk.pos.x,-24,25);walk.pos.z=clamp(walk.pos.z,-18,21);walk.pos.y=1.65}
document.querySelectorAll('[data-season]').forEach(b=>b.onclick=()=>{STATE.season=b.dataset.season;rebuildGrowth()});document.querySelectorAll('[data-density]').forEach(b=>b.onclick=()=>{STATE.density=b.dataset.density;rebuildGrowth()});document.querySelectorAll('[data-crop]').forEach(b=>b.onclick=()=>{STATE.cropPattern=b.dataset.crop;rebuildGrowth()});
$('growthYear').oninput=e=>{STATE.growthYear=+e.target.value;rebuildGrowth()};$('flowerBtn').onclick=()=>{STATE.showFlowers=!STATE.showFlowers;rebuildGrowth()};$('fruitBtn').onclick=()=>{STATE.showFruit=!STATE.showFruit;rebuildGrowth()};$('walkBtn').onclick=startWalk;$('walkExitBtn').onclick=$('mobileWalkExit').onclick=stopWalk;
$('planABtn').onclick=()=>readPlan('A');$('planBBtn').onclick=()=>readPlan('B');$('savePlanBtn').onclick=()=>savePlan();$('resetPlanBtn').onclick=()=>{if(!confirm('A・B両方のプランを初期化しますか？'))return;DESIGN.replacePlans(PLAN_DEFAULTS);plans=DESIGN.plans;readPlan(STATE.activePlan,true);toast('全プランを初期化しました')};
$('importBtn').onclick=()=>$('importFile').click();
addEventListener('keydown',e=>{walk.keys[e.code]=true;if(e.code==='Escape'&&cam.mode==='walk')stopWalk()});addEventListener('keyup',e=>walk.keys[e.code]=false);
renderer.domElement.addEventListener('pointerdown',e=>{if(cam.mode==='walk'&&!$('panel').classList.contains('open'))walk.drag={x:e.clientX,y:e.clientY}});addEventListener('pointermove',e=>{if(cam.mode==='walk'&&walk.drag){walk.yaw-=(e.clientX-walk.drag.x)*.005;walk.pitch=clamp(walk.pitch-(e.clientY-walk.drag.y)*.004,-.75,.75);walk.drag={x:e.clientX,y:e.clientY}}});addEventListener('pointerup',()=>walk.drag=null);addEventListener('pointercancel',()=>walk.drag=null);
const joystick=$('joystick'),joystickKnob=$('joystickKnob');
function updateJoystick(e){const r=joystick.getBoundingClientRect(),radius=r.width/2,dx=e.clientX-(r.left+radius),dy=e.clientY-(r.top+radius),distance=Math.hypot(dx,dy),scale=distance>radius?radius/distance:1,nx=dx*scale/radius,ny=dy*scale/radius,dead=.12;walk.joystick.x=Math.abs(nx)<dead?0:nx;walk.joystick.y=Math.abs(ny)<dead?0:ny;joystickKnob.style.transform=`translate(${nx*radius*.55}px,${ny*radius*.55}px)`}
joystick.addEventListener('pointerdown',e=>{if(cam.mode!=='walk'||$('panel').classList.contains('open'))return;walk.joystick.pointerId=e.pointerId;joystick.setPointerCapture(e.pointerId);updateJoystick(e);e.preventDefault()});joystick.addEventListener('pointermove',e=>{if(e.pointerId===walk.joystick.pointerId){updateJoystick(e);e.preventDefault()}});function releaseJoystick(e){if(e.pointerId===walk.joystick.pointerId)resetJoystickInput()}joystick.addEventListener('pointerup',releaseJoystick);joystick.addEventListener('pointercancel',releaseJoystick);
applyGrowthUI();

function showPlantEditorInfo(plant,current){$('insTitle').textContent=plant.name;$('insBody').textContent=`${plant.sourceType==='base'?'既存植栽':'追加植栽'}・${isEvergreenSpecies(plant.name)?'常緑樹':'落葉樹'}・${STATE.season}・${STATE.growthYear}年後`;$('insMeta').innerHTML='';[['現在座標',`x ${current.x.toFixed(2)} / z ${current.z.toFixed(2)}`],['元座標',plant.basePosition?`x ${plant.basePosition.x.toFixed(2)} / z ${plant.basePosition.z.toFixed(2)}`:'—'],['移動距離',plant.basePosition?Math.hypot(current.x-plant.basePosition.x,current.z-plant.basePosition.z).toFixed(2)+'m':'—'],['基準樹高',plant.h+'m'],['基準樹冠半径',plant.r+'m']].forEach(a=>$('insMeta').insertAdjacentHTML('beforeend',`<span>${a[0]}</span><span>${a[1]}</span>`));$('inspector').classList.remove('hidden')}
plantEditor=createPlantEditor({THREE,scene,renderer,data:DATA,designState:DESIGN,getCamera:()=>camera,getObjects:()=>plantObjects,rebuild:rebuildPlantLayout,toast,showInfo:showPlantEditorInfo,beforeBegin:preparePlantEditing,getViewCenter:()=>({x:cam.target.x,z:cam.target.z})});
function showObjectEditorInfo(item,current,rotation,status){$('insTitle').textContent=item.label;$('insBody').textContent=`${item.sourceType==='base'?'既存設備':'追加設備'}。プラン${STATE.activePlan}の差分配置です。`;$('insMeta').innerHTML='';[['現在座標',`x ${current.x.toFixed(2)} / z ${current.z.toFixed(2)}`],['元座標',item.basePosition?`x ${item.basePosition.x.toFixed(2)} / z ${item.basePosition.z.toFixed(2)}`:'—'],['寸法',`${item.width.toFixed(2)} × ${item.depth.toFixed(2)}m`],['回転',`${Math.round(rotation*180/Math.PI)}°`],['配置状態',status?.state||'valid']].forEach(a=>$('insMeta').insertAdjacentHTML('beforeend',`<span>${a[0]}</span><span>${a[1]}</span>`));$('inspector').classList.remove('hidden')}
objectEditor=createObjectEditor({THREE,scene,renderer,data:DATA,designState:DESIGN,getCamera:()=>camera,getObjects:()=>objectObjects,getPlants:()=>resolvedPlants,rebuild:rebuildObjectLayout,toast,showInfo:showObjectEditorInfo,beforeBegin:prepareObjectEditing,onBegin:buildLabels,onEnd:buildLabels,onVisibilityChange:buildLabels,getViewCenter:()=>({x:cam.target.x,z:cam.target.z})});
function addPlantSpecies(name){if(plantEditor.begin())plantEditor.addSpecies(name)}
window.RYUKA_DESIGN_API=Object.freeze({
 status:()=>({plan:STATE.activePlan,mode:STATE.mode,plants:resolvedPlants.map(p=>({id:p.designId,name:p.name,x:p.x,z:p.z,sourceType:p.sourceType})),selectable:selectable.length,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,lights:document.body.dataset.lightCount||'',editing:plantEditor.isEditing(),assets:{mode:STATE.modelDetail,effectiveVariant:shouldUseDetailedAsset()?resolveAssetVariant():'procedural',...ASSET_MANAGER.getStatus()}}),
 begin:()=>plantEditor.begin(),end:()=>plantEditor.end(),add:addPlantSpecies,select:id=>plantEditor.select(id),move:(dx,dz)=>plantEditor.move(dx,dz),undo:()=>plantEditor.undo(),redo:()=>plantEditor.redo(),switchPlan:key=>readPlan(key),setMode,setSeason:season=>{if(['spring','summer','autumn','winter'].includes(season)){STATE.season=season;rebuildGrowth()}},setGrowthYear:year=>{STATE.growthYear=clamp(Number(year)||0,0,10);rebuildGrowth()}
});
window.RYUKA_OBJECT_API=Object.freeze({
 status:()=>({plan:STATE.activePlan,mode:STATE.mode,editing:objectEditor.isEditing(),objects:resolvedObjects.map(item=>({id:item.designId,type:item.type,label:item.label,x:item.x,z:item.z,rotation:item.rotation||0,sourceType:item.sourceType})),selectable:selectable.length,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures}),
 begin:()=>objectEditor.begin(),end:()=>objectEditor.end(),add:type=>objectEditor.addType(type),select:id=>objectEditor.select(id),move:(dx,dz)=>objectEditor.move(dx,dz),rotate:degrees=>objectEditor.rotate(Number(degrees)*Math.PI/180),duplicate:()=>objectEditor.duplicate(),remove:()=>objectEditor.remove(),resetSelected:()=>objectEditor.resetSelected(),reset:()=>objectEditor.resetSelected(),resetPlan:()=>objectEditor.resetPlan(),list:()=>resolvedObjects.map(item=>{const entry=objectObjects.get(item.designId);return{id:item.designId,type:item.type,label:item.label,layer:item.layer,x:item.x,z:item.z,rotation:item.rotation||0,sourceType:item.sourceType,width:item.width,depth:item.depth,height:item.height,visible:entry?.group.visible!==false,labelVisible:groups.labels.visible&&entry?.label?.parent===groups.labels}}),undo:()=>objectEditor.undo(),redo:()=>objectEditor.redo(),switchPlan:key=>readPlan(key),setMode
});
$('objectEditToggle').onclick=()=>{if(objectEditor.isEditing())objectEditor.end();else objectEditor.begin()};
$('objectUndoBtn').onclick=()=>objectEditor.undo();$('objectRedoBtn').onclick=()=>objectEditor.redo();$('objectSnap').onchange=e=>objectEditor.setSnap(e.target.value);$('objectResetSelectedBtn').onclick=()=>objectEditor.resetSelected();$('objectDuplicateBtn').onclick=()=>objectEditor.duplicate();$('objectDeleteBtn').onclick=()=>objectEditor.remove();$('objectPlanResetBtn').onclick=()=>objectEditor.resetPlan();
OBJECT_CATALOG.forEach(profile=>{const card=document.createElement('div');card.className='plant-card';card.innerHTML=`<strong>${profile.label}</strong><span>${profile.width.toFixed(2)} × ${profile.depth.toFixed(2)}m<br>高さ ${profile.height.toFixed(2)}m</span><button class="action" type="button">追加</button>`;card.querySelector('button').onclick=()=>objectEditor.addType(profile.type);$('objectCatalog').appendChild(card)});
document.querySelectorAll('[data-object-action]').forEach(button=>button.onclick=()=>{const action=button.dataset.objectAction;if(action==='left')objectEditor.move(-1,0);if(action==='right')objectEditor.move(1,0);if(action==='up')objectEditor.move(0,-1);if(action==='down')objectEditor.move(0,1);if(action==='rotate-left')objectEditor.rotate(-Math.PI/12);if(action==='rotate-right')objectEditor.rotate(Math.PI/12);if(action==='reset')objectEditor.resetSelected();if(action==='duplicate')objectEditor.duplicate();if(action==='delete')objectEditor.remove()});
$('exportBtn').onclick=()=>{savePlan(true);const blob=new Blob([JSON.stringify({version:'4.8.0',quality:STATE.quality,modelDetail:STATE.modelDetail,plans:DESIGN.plans},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='ryuka-landscape-plans.json';a.click();URL.revokeObjectURL(a.href)};
$('importFile').onchange=event=>{const file=event.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const payload=JSON.parse(reader.result);DESIGN.replacePlans(payload.plans||payload);const removedPlants=DESIGN.cleanInvalid((plant,x,z)=>plantEditor.isValid(plant,x,z));const removedObjects=DESIGN.cleanInvalidObjects((item,x,z,rotation,planKey,context)=>objectEditor.isValid(item,x,z,rotation,context));plans=DESIGN.plans;if(payload.quality&&['auto','high','low'].includes(payload.quality)){STATE.quality=payload.quality;localStorage.setItem('ryuka-render-quality',STATE.quality);applyQuality();updateSun()}if(payload.modelDetail&&['auto','detailed','simple'].includes(payload.modelDetail)){STATE.modelDetail=payload.modelDetail;localStorage.setItem('ryuka-model-detail',STATE.modelDetail);document.querySelectorAll('[data-model-detail]').forEach(button=>button.classList.toggle('on',button.dataset.modelDetail===STATE.modelDetail));syncAssetVariant();updateAssetStatus(ASSET_MANAGER.getStatus())}readPlan('A',true);const removed=removedPlants+removedObjects;toast(removed?`設定を読み込み、不正な配置${removed}件を除外しました`:'設定を読み込みました')}catch(error){console.error('[Ryuka] 設定読込エラー',error);toast('設定ファイルを読み込めません')}};reader.readAsText(file)};
$('plantEditToggle').onclick=()=>{if(plantEditor.isEditing())plantEditor.end();else plantEditor.begin()};
$('plantUndoBtn').onclick=()=>plantEditor.undo();$('plantRedoBtn').onclick=()=>plantEditor.redo();$('plantSnap').onchange=e=>plantEditor.setSnap(e.target.value);$('plantResetSelectedBtn').onclick=()=>plantEditor.resetSelected();$('plantDuplicateBtn').onclick=()=>plantEditor.duplicate();$('plantDeleteBtn').onclick=()=>plantEditor.remove();$('plantPlanResetBtn').onclick=()=>plantEditor.resetPlan();
PLANT_CATALOG.forEach(profile=>{const card=document.createElement('div');card.className='plant-card';card.innerHTML=`<strong>${profile.name}</strong><span>${profile.evergreen?'常緑':'落葉'}・樹高 ${profile.h}m<br>樹冠 ${profile.r}m・間隔 ${profile.spacing}m</span><button class="action" type="button">追加</button>`;card.querySelector('button').onclick=()=>addPlantSpecies(profile.name);$('plantCatalog').appendChild(card)});
document.querySelectorAll('[data-plant-action]').forEach(button=>button.onclick=()=>{const action=button.dataset.plantAction;if(action==='left')plantEditor.move(-1,0);if(action==='right')plantEditor.move(1,0);if(action==='up')plantEditor.move(0,-1);if(action==='down')plantEditor.move(0,1);if(action==='rotate-left')plantEditor.rotate(-Math.PI/12);if(action==='rotate-right')plantEditor.rotate(Math.PI/12);if(action==='reset')plantEditor.resetSelected();if(action==='duplicate')plantEditor.duplicate();if(action==='delete')plantEditor.remove()});

buildSite();buildBuilding();buildPaths();buildFacilities();buildGuestBeds();buildHerbs();buildRotations();buildTrees();buildLawn();buildObjects();buildLabels();buildGrid();buildSunPath();updateSun();
updateResourceMetrics();
ASSET_MANAGER.preloadAll().then(()=>updateResourceMetrics());
window.RYUKA_ASSET_API=Object.freeze({
 status:()=>({mode:STATE.modelDetail,effectiveVariant:shouldUseDetailedAsset()?resolveAssetVariant():'procedural',...ASSET_MANAGER.getStatus()}),
 preloadAll:()=>ASSET_MANAGER.preloadAll(),retryFailed:()=>ASSET_MANAGER.retryFailed(),list:()=>ASSET_CATALOG.map(entry=>({id:entry.id,label:entry.label,variants:entry.variants,license:entry.license}))
});

// ---------- UI / layers ----------
const layerDefs=[['facilities','施設・作業ヤード','#9aa3ab'],['paths','園路・動線','#d8cfb4'],['guestBeds','収穫ガーデン','#6f934d'],['herbs','ハーブ帯','#8176a6'],['rotations','輪作区画','#7b5c39'],['trees','果樹','#4e7a3a'],['lawn','広場・パーゴラ','#86a860']];
layerDefs.forEach(d=>{const b=document.createElement('button');b.className='layer-btn on';b.dataset.layer=d[0];b.innerHTML=`<span class="layer-row"><span class="layer-dot" style="background:${d[2]}"></span><span class="layer-label">${d[1]}</span><span class="switch"></span></span>`;$('layerList').appendChild(b);b.onclick=()=>{STATE.layers[d[0]]=!STATE.layers[d[0]];groups[d[0]].visible=STATE.layers[d[0]];objectObjects.forEach(entry=>{if((entry.item.layer||'facilities')===d[0])entry.group.visible=STATE.layers[d[0]]});objectEditor?.handleLayerVisibility(d[0],STATE.layers[d[0]]);b.classList.toggle('on',STATE.layers[d[0]])}});
document.querySelectorAll('.panel-tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.panel-tabs button').forEach(x=>x.classList.toggle('on',x===b));document.querySelectorAll('.panel-page').forEach(x=>x.classList.toggle('on',x.dataset.page===b.dataset.page))});
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{setMode(b.dataset.mode);updateSun()});document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>flyTo(b.dataset.view));
document.querySelectorAll('button[data-quality]').forEach(b=>b.onclick=()=>{STATE.quality=b.dataset.quality;localStorage.setItem('ryuka-render-quality',STATE.quality);applyQuality(true);updateSun();updateResourceMetrics()});
document.querySelectorAll('[data-model-detail]').forEach(b=>{b.classList.toggle('on',b.dataset.modelDetail===STATE.modelDetail);b.onclick=()=>{if(STATE.modelDetail===b.dataset.modelDetail)return;STATE.modelDetail=b.dataset.modelDetail;localStorage.setItem('ryuka-model-detail',STATE.modelDetail);document.querySelectorAll('[data-model-detail]').forEach(x=>x.classList.toggle('on',x===b));syncAssetVariant();updateAssetStatus(ASSET_MANAGER.getStatus());toast(STATE.modelDetail==='auto'?'3Dモデルを自動選択':STATE.modelDetail==='detailed'?'詳細3Dモデルを使用':'簡易モデルを使用')}});
document.querySelectorAll('[data-guide]').forEach(b=>b.onclick=()=>{const k=b.dataset.guide;if(k==='crowns'&&STATE.mode==='plan'){groups.crowns.visible=true;b.classList.add('on');return}STATE.guides[k]=!STATE.guides[k];b.classList.toggle('on',STATE.guides[k]);if(k==='labels')buildLabels();if(k==='grid')gridGroup.visible=STATE.guides.grid;if(k==='boundary')boundaryObjects.forEach(x=>x.visible=STATE.guides.boundary);if(k==='crowns')groups.crowns.visible=STATE.guides.crowns});
$('fov').oninput=e=>{perspective.fov=+e.target.value;perspective.updateProjectionMatrix();$('fovOut').textContent=e.target.value+'°'};$('resetView').onclick=()=>flyTo('birdNE');
$('doy').oninput=e=>{STATE.doy=+e.target.value;updateSun();buildSunPath()};$('tod').oninput=e=>{STATE.tod=+e.target.value;updateSun()};$('timelineRange').oninput=e=>{STATE.tod=+e.target.value;updateSun()};
function togglePlay(){STATE.playing=!STATE.playing;$('playBtn').classList.toggle('on',STATE.playing);$('playBtn').textContent=STATE.playing?'⏸ 停止':'▶ 1日を再生';$('timelinePlay').textContent=STATE.playing?'Ⅱ':'▶'}$('playBtn').onclick=$('timelinePlay').onclick=togglePlay;
$('sunPathBtn').onclick=()=>{STATE.sunPath=!STATE.sunPath;$('sunPathBtn').classList.toggle('on',STATE.sunPath);buildSunPath()};
$('exposure').oninput=e=>{$('exposureOut').textContent=(e.target.value/100).toFixed(2);updateSun()};$('shadowSoft').oninput=e=>{$('shadowOut').textContent=e.target.value+'%';renderer.shadowMap.type=+e.target.value>45?THREE.PCFSoftShadowMap:THREE.PCFShadowMap};
$('contextBtn').onclick=()=>{STATE.context=!STATE.context;$('contextBtn').classList.toggle('on',STATE.context);ENVIRONMENT.setContextVisible(STATE.context,STATE.mode)};
$('northOff').oninput=e=>{STATE.northOff=+e.target.value;$('northOut').textContent=STATE.northOff+'°';compass.rotation.y=-STATE.northOff*Math.PI/180;updateSun();buildSunPath()};
$('splitPos').oninput=e=>{const f=+e.target.value/1000;splitT=zMin+1+(zMax-zMin-2)*f;$('splitOut').textContent=`${splitT-splitDefault>=0?'+':''}${(splitT-splitDefault).toFixed(1)}m`;buildSite()};
$('panelBtn').onclick=$('mobileHandle').onclick=()=>setPanelOpen(!$('panel').classList.contains('open'));
$('fullBtn').onclick=()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen?.();else document.exitFullscreen?.()};
$('shotBtn').onclick=()=>{renderer.render(scene,camera);const a=document.createElement('a');a.download=`ryuka-landscape-${doyToMD(STATE.doy).replace('/','-')}-${fmtTime(STATE.tod).replace(':','')}.png`;a.href=renderer.domElement.toDataURL('image/png');a.click();toast('現在の視点をPNGで保存しました')};

// ---------- measuring / picking ----------
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0),measurePts=[];let measureLine=null,measureMarks=[];
function clearMeasure(){if(measureLine){scene.remove(measureLine);disposeObj(measureLine);measureLine=null}measureMarks.forEach(m=>{scene.remove(m);disposeObj(m)});measureMarks=[];measurePts.length=0;$('measureTip').textContent='地面を2点クリックしてください'}
$('clearMeasureBtn').onclick=clearMeasure;$('measureBtn').onclick=()=>{if(plantEditor?.isEditing()||objectEditor?.isEditing()){toast('編集モードを終了してから計測してください');return}STATE.measure=!STATE.measure;$('measureBtn').classList.toggle('on',STATE.measure);$('measureTip').style.display=STATE.measure?'block':'none';clearMeasure()};
function screenRay(x,y){pointer.set(x/innerWidth*2-1,-y/innerHeight*2+1);raycaster.setFromCamera(pointer,camera)}
function measureAt(x,y){screenRay(x,y);const hit=new THREE.Vector3();if(!raycaster.ray.intersectPlane(groundPlane,hit))return;if(measurePts.length>=2)clearMeasure();measurePts.push(hit.clone());const m=new THREE.Mesh(new THREE.SphereGeometry(.28,12,10),new THREE.MeshBasicMaterial({color:0xe5793c}));m.position.copy(hit).setY(.28);scene.add(m);measureMarks.push(m);if(measurePts.length===2){const a=measurePts[0],b=measurePts[1];measureLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints([a.clone().setY(.3),b.clone().setY(.3)]),new THREE.LineBasicMaterial({color:0xe5793c}));scene.add(measureLine);$('measureTip').textContent=`距離 ${a.distanceTo(b).toFixed(2)}m`}else $('measureTip').textContent='2点目をクリックしてください'}
function selectAt(x,y){if(plantEditor?.isEditing()||objectEditor?.isEditing())return;screenRay(x,y);let hits=raycaster.intersectObjects(selectable,true);let obj=hits.find(h=>{if(!isEffectivelyVisible(h.object))return false;let o=h.object;while(o&&!o.userData.info)o=o.parent;h.infoObj=o;return!!o})?.infoObj;if(!obj)return;const info=obj.userData.info;$('insTitle').textContent=info.title;$('insBody').textContent=info.body;$('insMeta').innerHTML='';(info.meta||[]).forEach(a=>{$('insMeta').insertAdjacentHTML('beforeend',`<span>${a[0]}</span><span>${a[1]}</span>`)});$('inspector').classList.remove('hidden')}

// custom orbit controls
let drag=null,pinch=null,moved=false;const el=renderer.domElement;
el.addEventListener('mousedown',e=>{if(plantEditor?.isEditing())return;drag={x:e.clientX,y:e.clientY,btn:e.button,shift:e.shiftKey};moved=false});addEventListener('mousemove',e=>{if(!drag||camera===ortho||plantEditor?.isEditing())return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>3)moved=true;if(drag.btn===2||drag.shift)panCam(dx,dy);else{cam.a-=dx*.006;cam.p-=dy*.006}drag.x=e.clientX;drag.y=e.clientY});addEventListener('mouseup',e=>{if(drag&&!moved){STATE.measure?measureAt(e.clientX,e.clientY):selectAt(e.clientX,e.clientY)}drag=null});el.addEventListener('contextmenu',e=>e.preventDefault());el.addEventListener('wheel',e=>{e.preventDefault();if(camera===ortho){const s=1+Math.sign(e.deltaY)*.08;ortho.left*=s;ortho.right*=s;ortho.top*=s;ortho.bottom*=s;ortho.updateProjectionMatrix()}else cam.r*=1+Math.sign(e.deltaY)*.09},{passive:false});
el.addEventListener('touchstart',e=>{if(plantEditor?.isEditing())return;if(e.touches.length===1){drag={x:e.touches[0].clientX,y:e.touches[0].clientY};moved=false}else if(e.touches.length===2){drag=null;const[a,b]=e.touches;pinch={d:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY),cx:(a.clientX+b.clientX)/2,cy:(a.clientY+b.clientY)/2}}},{passive:true});el.addEventListener('touchmove',e=>{if(camera===ortho||plantEditor?.isEditing())return;if(e.touches.length===1&&drag){const t=e.touches[0],dx=t.clientX-drag.x,dy=t.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>4)moved=true;cam.a-=dx*.007;cam.p-=dy*.007;drag.x=t.clientX;drag.y=t.clientY}else if(e.touches.length===2&&pinch){const[a,b]=e.touches,d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);cam.r*=pinch.d/d;const cx=(a.clientX+b.clientX)/2,cy=(a.clientY+b.clientY)/2;panCam(cx-pinch.cx,cy-pinch.cy);pinch={d,cx,cy}}e.preventDefault()},{passive:false});el.addEventListener('touchend',e=>{if(e.touches.length===0){if(drag&&!moved&&e.changedTouches.length){const t=e.changedTouches[0];STATE.measure?measureAt(t.clientX,t.clientY):selectAt(t.clientX,t.clientY)}drag=null;pinch=null}});
function panCam(dx,dy){const k=cam.r*.0016,right=new THREE.Vector3().setFromSphericalCoords(1,Math.PI/2,cam.a-Math.PI/2),fwd=new THREE.Vector3().setFromSphericalCoords(1,Math.PI/2,cam.a);cam.target.addScaledVector(right,dx*k).addScaledVector(fwd,dy*k)}

// ---------- render loop ----------
addEventListener('resize',()=>{perspective.aspect=innerWidth/innerHeight;perspective.updateProjectionMatrix();if(camera===ortho)setTopCamera();applyQuality();updateSun()});
let last=0,lastFrame=0;function loop(t){requestAnimationFrame(loop);const dt=Math.min(50,t-lastFrame);lastFrame=t;if(STATE.playing&&t-last>55){last=t;STATE.tod+=5;if(STATE.tod>1170)STATE.tod=300;updateSun()}updateWalk(dt);applyCamera();renderer.render(scene,camera)}
flyTo('birdNE');loop(0);
}
