(() => {
'use strict';
const $ = id => document.getElementById(id);
let data, selected, filtered = [], toastTimer;
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g, '').toLocaleLowerCase('sq');
const sectionFor = prayer => data.sections.find(section => section.id === prayer.section);
const titleFor = prayer => `${sectionFor(prayer)?.label || prayer.section} · ${prayer.number ?? prayer.id}`;
function element(tag, className, text) {
 const node = document.createElement(tag);
 if (className) node.className = className;
 if (text !== undefined) node.textContent = text;
 return node;
}
function originalText(parent, value, { arabic = false, bold = false } = {}) {
 const paragraph = element('p', arabic ? 'arabic-text' : '');
 paragraph.lang = arabic ? 'ar' : 'sq';
 if (arabic) paragraph.dir = 'rtl';
 if (!value) { paragraph.textContent = '—'; paragraph.classList.remove('arabic-text'); paragraph.classList.add('absent'); paragraph.lang = 'sq'; paragraph.dir = 'ltr'; }
 else if (bold) {
  String(value).split(/(\*\*[^]*?\*\*)/g).forEach(part => {
   if (part.startsWith('**') && part.endsWith('**')) paragraph.append(element('strong', '', part.slice(2,-2)));
   else paragraph.append(document.createTextNode(part));
  });
 } else paragraph.textContent = value;
 parent.append(paragraph);
}
function renderPart(prayer, index, count) {
 const part = element('section', 'part');
 part.dataset.prayerId = prayer.id;
 if (count > 1) part.append(element('h3', 'part-heading', `Pjesa ${index + 1} · ${titleFor(prayer)}`));
 const arabic = element('div', 'arabic-card');
 arabic.append(element('span', 'field-label', 'Arabisht')); originalText(arabic, prayer.arabic, {arabic:true}); part.append(arabic);
 const translations = element('div', 'translations');
 [['Transliterimi','transliteration'],['Shqip','albanian']].forEach(([label, key]) => {
  const field = element('div', 'text-field'); field.dataset.field = key;
  field.append(element('span', 'field-label', label));
  if (key === 'albanian' && !prayer.albanian && /\*\*[^]*?\*\*/.test(prayer.transliteration || '')) {
   field.append(element('p', 'embedded-note', 'Shqipja është me shkronja të trasha te transliterimi.'));
  } else originalText(field, prayer[key], {bold:key === 'transliteration'});
  translations.append(field);
 }); part.append(translations);
 const reference = element('div', 'reference'); reference.append(element('span', 'field-label', 'Burimi')); originalText(reference, prayer.reference); part.append(reference);
 return part;
}
function visibleList() {
 const query = normalize($('search').value.trim());
 const category = $('category').value;
 filtered = data.prayers.filter(prayer => (!category || prayer.section === category) && (!query || normalize([prayer.id, prayer.number, sectionFor(prayer)?.label, prayer.arabic, prayer.transliteration, prayer.albanian, prayer.reference].join(' ')).includes(query)));
 $('result-count').textContent = `${filtered.length} nga ${data.prayers.length} lutje`;
 $('prayer-list').replaceChildren(...filtered.map(prayer => {
  const link = element('a', 'prayer-link'); link.href = `?dua=${encodeURIComponent(prayer.id)}`; link.dataset.id = prayer.id;
  if (prayer.id === selected?.id) link.setAttribute('aria-current','page');
  link.append(element('span', 'prayer-number', String(prayer.number ?? data.prayers.indexOf(prayer)+1).padStart(2,'0')), element('span','',titleFor(prayer)));
  link.addEventListener('click', event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); select(prayer.id, true); });
  return link;
 }));
 $('prayer-picker').replaceChildren(...filtered.map(prayer => { const option = element('option', '', titleFor(prayer)); option.value = prayer.id; option.selected = prayer.id === selected?.id; return option; }));
 $('prayer-picker').disabled = filtered.length === 0;
 if (filtered.length && !filtered.some(prayer => prayer.id === selected?.id)) { const placeholder = element('option', '', 'Zgjidh lutjen'); placeholder.value = ''; placeholder.disabled = true; placeholder.selected = true; $('prayer-picker').prepend(placeholder); }
 $('empty-state').hidden = filtered.length > 0;
 $('prayer').hidden = filtered.length === 0;
 updateNavigation();
}
function updateNavigation() {
 const index = filtered.findIndex(prayer => prayer.id === selected?.id);
 $('previous').disabled = index <= 0; $('next').disabled = index < 0 || index >= filtered.length - 1;
 $('position').textContent = index >= 0 ? `${index + 1} / ${filtered.length}` : '';
}
function select(id, push = false) {
 selected = data.prayers.find(prayer => prayer.id === id) || data.prayers[0];
 if (!selected) return;
 if (push) { const url = new URL(location.href); url.searchParams.set('dua',selected.id); history.pushState({},'',url); }
 $('prayer-title').textContent = titleFor(selected); $('section-label').textContent = sectionFor(selected)?.label || selected.section;
 document.title = `${titleFor(selected)} · Dhikër`;
 const ids = selected.compositionIds?.length ? selected.compositionIds : [selected.id];
 const parts = ids.map(partId => data.prayers.find(prayer => prayer.id === partId)).filter(Boolean);
 $('parts').replaceChildren(...parts.map((part,index) => renderPart(part,index,parts.length)));
 $('prayer').hidden = false;
 visibleList();
 document.dispatchEvent(new CustomEvent('dhikr:prayerchange',{detail:{prayer:selected,parts,content:data}}));
}
function toast(message) { $('toast').textContent=message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2500); }
$('prayer-picker').addEventListener('change',()=>select($('prayer-picker').value,true));
$('search').addEventListener('input',visibleList); $('category').addEventListener('change',visibleList);
$('previous').addEventListener('click',()=>{ const index=filtered.findIndex(prayer=>prayer.id===selected.id); if(index>0) select(filtered[index-1].id,true); });
$('next').addEventListener('click',()=>{ const index=filtered.findIndex(prayer=>prayer.id===selected.id); if(index>=0 && index<filtered.length-1) select(filtered[index+1].id,true); });
$('print').addEventListener('click',()=>window.print());
$('copy-link').addEventListener('click',async()=>{const url=new URL(location.href);url.searchParams.set('dua',selected.id);try{await navigator.clipboard.writeText(url.href);toast('Lidhja u kopjua.');}catch{toast('Kopjoni lidhjen nga shiriti i adresës.');}});
window.addEventListener('popstate',()=>{if(data)select(new URL(location.href).searchParams.get('dua'));});
window.DhikrReviewUI = {getContent:()=>data, getSelected:()=>selected, selectPrayer:id=>select(id,true), notify:toast};
fetch('./content.json').then(response=>{if(!response.ok)throw new Error('content');return response.json();}).then(content=>{
 data=content;
 data.sections.forEach(section=>{const option=element('option','',`${section.label} (${section.count})`);option.value=section.id;$('category').append(option);});
 const meta=data.meta;
 $('book-attribution').textContent=[meta.title,meta.author,meta.translator && `Përktheu: ${meta.translator}`].filter(Boolean).join(' · ');
 $('load-status').hidden=true;
 select(new URL(location.href).searchParams.get('dua'));
 document.dispatchEvent(new CustomEvent('dhikr:ready',{detail:{content:data,prayer:selected}}));
}).catch(error=>{console.error(error);$('load-status').textContent='Përmbajtja nuk mund të ngarkohej. Ju lutemi rifreskoni faqen.';});
})();
