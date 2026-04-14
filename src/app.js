const { invoke } = window.__TAURI__.core;

// ═══════════════════════════════════════════════════════
//  GERMAN MONTH NAMES (for email template resolution)
// ═══════════════════════════════════════════════════════
const GERMAN_MONTHS = ['Jänner','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

// ═══════════════════════════════════════════════════════
//  STATE & INITIALIZATION
// ═══════════════════════════════════════════════════════
let sender = {};
let recipients = [];
let serviceTemplates = [];
let receiptRows = [];
let recipientHistory = {}; 
let recurringInvoices = [];
let emailTemplate = { subject: "Rechnung {Nummer} - {Monat}", body: "Hallo {Name},\n\nanbei erhältst du die Rechnung Nr. {Nummer} für den Monat {Monat}.\n\nViele Grüße,\nDein Team" };
let sysSettings = {};
let appRegistry = [];
let activeProfile = 'Standard';

async function loadFromBackend() {
  // Run migration on first launch
  try { await invoke('run_migration'); } catch(e) {}

  try {
    sysSettings = await invoke('get_settings');
  } catch(e) {
    console.warn('No settings yet, starting fresh:', e);
    sysSettings = {};
  }
  
  sender = sysSettings.sender || { name:'', street:'', city:'', tel:'', email:'', uid:'', steuer:'', bank:'', kontoinhaber:'', iban:'', bic:'' };
  recipients = sysSettings.recipients || [];
  serviceTemplates = sysSettings.templates || [];
  receiptRows = sysSettings.drafts || [];
  recipientHistory = sysSettings.history || {};
  recurringInvoices = sysSettings.recurring || [];
  if(sysSettings.emailTemplate) emailTemplate = sysSettings.emailTemplate;

  if(sysSettings.theme === 'dark') toggleTheme(true);

  // Load registry
  try {
    appRegistry = await invoke('get_registry');
  } catch(e) {
    appRegistry = [];
  }
  
  // Show storage path
  try {
    const storagePath = await invoke('get_storage_path');
    document.getElementById('sys-storage-path').value = storagePath;
  } catch(e) {}

  // Load profile info
  try {
    activeProfile = await invoke('get_active_profile');
  } catch(e) {}
}

async function fullSave() {
  const strip = (arr) => arr.map(item => {
    const obj = {...item};
    delete obj._deleting;
    delete obj._deleteTimer;
    delete obj._countdown;
    delete obj._countdownInterval;
    return obj;
  });
  sysSettings.sender = sender;
  sysSettings.recipients = strip(recipients);
  sysSettings.templates = strip(serviceTemplates);
  sysSettings.drafts = receiptRows;
  sysSettings.history = recipientHistory;
  sysSettings.emailTemplate = emailTemplate;
  sysSettings.recurring = strip(recurringInvoices);
  try {
    await invoke('save_settings', { settings: sysSettings });
  } catch(e) {
    console.error('Save failed:', e);
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  await loadFromBackend();

  if(sysSettings.startNum) document.getElementById('inp-start-num').value = sysSettings.startNum;
  if(sysSettings.month) document.getElementById('sel-month').value = sysSettings.month;
  
  if(sysSettings.year) document.getElementById('inp-year').value = sysSettings.year;
  else document.getElementById('inp-year').value = new Date().getFullYear();
  
  if(!sysSettings.month) document.getElementById('sel-month').selectedIndex = new Date().getMonth();
  
  if(sysSettings.date) document.getElementById('inp-date').value = sysSettings.date;
  else document.getElementById('inp-date').value = getSmartDate();

  loadSenderFields();
  renderRecipients();
  renderTemplates();
  renderReceiptRows();
  renderRecurring();
  renderArchive();
  loadProfiles();
});

async function pickStorageFolder() {
  const f = await invoke('pick_folder');
  if(f) {
    await invoke('set_storage_path', { path: f });
    document.getElementById('sys-storage-path').value = f;
    // Reload everything from new location
    await loadFromBackend();
    loadSenderFields();
    renderRecipients();
    renderTemplates();
    renderReceiptRows();
    renderRecurring();
    renderArchive();
    loadProfiles();
  }
}

function saveSettings() {
  sysSettings.startNum = document.getElementById('inp-start-num').value;
  sysSettings.month = document.getElementById('sel-month').value;
  sysSettings.year = document.getElementById('inp-year').value;
  sysSettings.date = document.getElementById('inp-date').value;
  fullSave();
}

function getSmartDate() {
  const now = new Date();
  let target = now.getDate() <= 15 ? new Date(now.getFullYear(), now.getMonth(), 0) : new Date(now.getFullYear(), now.getMonth() + 1, 0); 
  if (target.getDay() === 0) target.setDate(target.getDate() - 1);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════════
//  SETTINGS MENU
// ═══════════════════════════════════════════════════════
function toggleSettingsMenu() {
  const dd = document.getElementById('settings-dropdown');
  dd.style.display = dd.style.display === 'none' ? 'flex' : 'none';
}
function closeSettingsMenu() {
  document.getElementById('settings-dropdown').style.display = 'none';
}
// Close settings menu when clicking outside
document.addEventListener('click', (e) => {
  const dd = document.getElementById('settings-dropdown');
  if(dd && dd.style.display !== 'none') {
    const headerActions = e.target.closest('.header-actions');
    if(!headerActions) dd.style.display = 'none';
  }
});

// ═══════════════════════════════════════════════════════
//  THEME / DARK MODE
// ═══════════════════════════════════════════════════════
function toggleTheme(forceDark = false) {
  const isDark = forceDark || document.body.getAttribute('data-theme') !== 'dark';
  if(isDark) {
    document.body.setAttribute('data-theme', 'dark');
    document.getElementById('theme-btn').innerText = '☀️ Light Mode';
    sysSettings.theme = 'dark';
  } else {
    document.body.removeAttribute('data-theme');
    document.getElementById('theme-btn').innerText = '🌙 Dark Mode';
    sysSettings.theme = 'light';
  }
  fullSave();
}

// ═══════════════════════════════════════════════════════
//  PROFILES
// ═══════════════════════════════════════════════════════
async function loadProfiles() {
  try {
    const profiles = await invoke('get_profiles');
    const sel = document.getElementById('profile-select');
    sel.innerHTML = profiles.map(p => `<option value="${esc(p)}" ${p===activeProfile?'selected':''}>${esc(p)}</option>`).join('');
  } catch(e) {
    console.warn('Could not load profiles:', e);
  }
}

async function handleProfileSwitch(name) {
  try {
    await invoke('switch_profile', { profileName: name });
    activeProfile = name;
    // Reload all data from new profile
    await loadFromBackend();
    loadSenderFields();
    renderRecipients();
    renderTemplates();
    renderReceiptRows();
    renderRecurring();
    renderArchive();

    // Re-apply settings fields
    if(sysSettings.startNum) document.getElementById('inp-start-num').value = sysSettings.startNum;
    if(sysSettings.month) document.getElementById('sel-month').value = sysSettings.month;
    if(sysSettings.year) document.getElementById('inp-year').value = sysSettings.year;
    else document.getElementById('inp-year').value = new Date().getFullYear();
    if(sysSettings.date) document.getElementById('inp-date').value = sysSettings.date;
    else document.getElementById('inp-date').value = getSmartDate();
  } catch(e) {
    alert('Fehler beim Profilwechsel: ' + e);
  }
}

function showProfileManager() {
  document.getElementById('profile-modal').style.display = 'flex';
  renderProfileList();
}
function closeProfileManager() {
  document.getElementById('profile-modal').style.display = 'none';
}

async function renderProfileList() {
  try {
    const profiles = await invoke('get_profiles');
    const list = document.getElementById('profile-list');
    list.innerHTML = profiles.map(p => `
      <div class="profile-item ${p===activeProfile?'active':''}">
        <span class="profile-name">${esc(p)}</span>
        ${p===activeProfile ? '<span class="badge badge-accent">Aktiv</span>' : `<button class="btn btn-sm" onclick="handleProfileSwitch('${esc(p)}');renderProfileList()">Wechseln</button>`}
        <button class="btn btn-sm btn-icon" onclick="renameExistingProfile('${esc(p)}')">✏️</button>
        ${p!==activeProfile ? `<button class="btn btn-sm btn-danger btn-icon" onclick="deleteExistingProfile('${esc(p)}')">×</button>` : ''}
      </div>
    `).join('');
  } catch(e) {}
}

async function createNewProfile() {
  const name = document.getElementById('new-profile-name').value.trim();
  if(!name) return;
  try {
    await invoke('create_profile', { profileName: name });
    document.getElementById('new-profile-name').value = '';
    await loadProfiles();
    renderProfileList();
  } catch(e) {
    alert('Fehler: ' + e);
  }
}

async function renameExistingProfile(oldName) {
  const newName = prompt(`Neuer Name für Profil "${oldName}":`, oldName);
  if(!newName || newName.trim() === '' || newName === oldName) return;
  try {
    await invoke('rename_profile', { oldName: oldName, newName: newName.trim() });
    
    // If we renamed the active profile, update the local variable
    if (activeProfile === oldName) {
      activeProfile = newName.trim();
    }
    
    await loadProfiles();
    renderProfileList();
  } catch(e) {
    alert('Fehler beim Umbenennen: ' + e);
  }
}

async function deleteExistingProfile(name) {
  if(!confirm(`Profil "${name}" wirklich löschen? Alle Daten gehen verloren!`)) return;
  try {
    await invoke('delete_profile', { profileName: name });
    await loadProfiles();
    renderProfileList();
  } catch(e) {
    alert('Fehler: ' + e);
  }
}

// ═══════════════════════════════════════════════════════
//  SENDER & EMAIL TEMPLATE
// ═══════════════════════════════════════════════════════
function loadSenderFields(){
  const map = {name:'s-name',street:'s-street',city:'s-city',tel:'s-tel',email:'s-email',uid:'s-uid',steuer:'s-steuer',bank:'s-bank',kontoinhaber:'s-kinhaber',iban:'s-iban',bic:'s-bic'};
  for(const [k,id] of Object.entries(map)) { const el=document.getElementById(id); if(el) el.value=sender[k]||''; }
  document.getElementById('em-subject').value = emailTemplate.subject || '';
  document.getElementById('em-body').value = emailTemplate.body || '';
}

function saveSender(){
  const map = {name:'s-name',street:'s-street',city:'s-city',tel:'s-tel',email:'s-email',uid:'s-uid',steuer:'s-steuer',bank:'s-bank',kontoinhaber:'s-kinhaber',iban:'s-iban',bic:'s-bic'};
  for(const [k,id] of Object.entries(map)) { const el=document.getElementById(id); if(el) sender[k]=el.value; }
  emailTemplate.subject = document.getElementById('em-subject').value;
  emailTemplate.body = document.getElementById('em-body').value;
  fullSave();
}
function getSender(){ return {...sender}; }

// ═══════════════════════════════════════════════════════
//  SOFT DELETE WITH COUNTDOWN (shared helper)
// ═══════════════════════════════════════════════════════
function startSoftDeleteCountdown(item, seconds, onDelete, onRender) {
  item._deleting = true;
  item._countdown = seconds;
  onRender();
  
  item._countdownInterval = setInterval(() => {
    item._countdown--;
    onRender();
  }, 1000);

  item._deleteTimer = setTimeout(() => {
    clearInterval(item._countdownInterval);
    onDelete();
  }, seconds * 1000);
}

function undoSoftDelete(item, onRender) {
  clearTimeout(item._deleteTimer);
  clearInterval(item._countdownInterval);
  item._deleting = false;
  item._countdown = 0;
  onRender();
}

// ═══════════════════════════════════════════════════════
//  RECIPIENTS
// ═══════════════════════════════════════════════════════
function renderRecipients(){
  const tbody = document.getElementById('rec-body');
  tbody.innerHTML = recipients.map((r,i)=>{
    if(r._deleting) {
      return `<tr><td colspan="7" class="undo-row">
        <div class="undo-bar">
          <span>Empfänger wird in <strong>${r._countdown || 0}s</strong> gelöscht...</span>
          <button class="btn btn-sm btn-accent" onclick="undoRemoveRecipient(${i})">↩ Rückgängig</button>
        </div>
      </td></tr>`;
    }
    return `
    <tr>
      <td style="color:var(--ink3);font-size:12px">${i+1}</td>
      <td><input value="${esc(r.name)}" placeholder="Name" oninput="recipients[${i}].name=this.value;fullSave();refreshDropdowns()"></td>
      <td><input value="${esc(r.street)}" placeholder="Straße" oninput="recipients[${i}].street=this.value;fullSave()"></td>
      <td><input value="${esc(r.city)}" placeholder="PLZ Ort" oninput="recipients[${i}].city=this.value;fullSave()"></td>
      <td><input value="${esc(r.phone||'')}" placeholder="Telefon" oninput="recipients[${i}].phone=this.value;fullSave()"></td>
      <td><input type="email" value="${esc(r.email||'')}" placeholder="E-Mail" oninput="recipients[${i}].email=this.value;fullSave()"></td>
      <td><button class="btn btn-danger btn-sm btn-icon" onclick="removeRecipient(${i})">×</button></td>
    </tr>`
  }).join('');
}
function addRecipient(){ recipients.push({name:'',street:'',city:'',phone:'',email:''}); renderRecipients(); fullSave(); refreshDropdowns(); }
function removeRecipient(i){
  const r = recipients[i];
  startSoftDeleteCountdown(r, 5, () => {
    recipients = recipients.filter(x => x !== r);
    renderRecipients();
    fullSave();
    refreshDropdowns();
  }, () => renderRecipients());
}
function undoRemoveRecipient(i){
  undoSoftDelete(recipients[i], () => renderRecipients());
}
function recipientOptions(selected=''){ return `<option value="">— Benutzerdefiniert —</option>`+ recipients.filter(r=>!r._deleting).map(r=>`<option value="${esc(r.name)}" ${r.name===selected?'selected':''}>${esc(r.name)}</option>`).join(''); }
function refreshDropdowns(){ document.querySelectorAll('.rec-select').forEach(sel=>{ const cur=sel.value; sel.innerHTML=recipientOptions(cur); }); }

// ═══════════════════════════════════════════════════════
//  SERVICES (TEMPLATES)
// ═══════════════════════════════════════════════════════
function renderTemplates(){
  const c = document.getElementById('templates-container');
  if(!serviceTemplates.length){ c.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--ink3);padding:1rem;">Noch keine Vorlagen vorhanden.</td></tr>'; return; }
  c.innerHTML = serviceTemplates.map((t,i)=>{
    if(t._deleting) {
      return `<tr><td colspan="5" class="undo-row">
        <div class="undo-bar">
          <span>Vorlage wird in <strong>${t._countdown || 0}s</strong> gelöscht...</span>
          <button class="btn btn-sm btn-accent" onclick="undoRemoveTemplate(${t.id})">↩ Rückgängig</button>
        </div>
      </td></tr>`;
    }
    return `
    <tr>
      <td><input value="${esc(t.name)}" placeholder="z.B. Reinigung" oninput="serviceTemplates[${i}].name=this.value;fullSave();renderReceiptRows()"></td>
      <td>
        <select onchange="serviceTemplates[${i}].type=this.value;fullSave();renderReceiptRows()">
          <option value="fixed" ${t.type==='fixed'?'selected':''}>Pauschalpreis</option>
          <option value="hourly" ${t.type==='hourly'?'selected':''}>Stundensatz</option>
          <option value="per-unit" ${t.type==='per-unit'?'selected':''}>Pro Einheit</option>
        </select>
      </td>
      <td><input type="number" step="0.01" value="${t.rate}" oninput="serviceTemplates[${i}].rate=parseFloat(this.value)||0;fullSave();renderReceiptRows()"></td>
      <td><input value="${esc(t.desc||'')}" placeholder="Optional" oninput="serviceTemplates[${i}].desc=this.value;fullSave();renderReceiptRows()"></td>
      <td><button class="btn btn-danger btn-sm btn-icon" onclick="removeTemplate(${t.id})">×</button></td>
    </tr>`
  }).join('');
}
function addServiceTemplate(){ serviceTemplates.push({ id: Date.now(), name: '', type: 'fixed', rate: 0, desc: '' }); fullSave(); renderTemplates(); }
function removeTemplate(id){
  const t = serviceTemplates.find(x => x.id === id);
  if (!t) return;
  startSoftDeleteCountdown(t, 5, () => {
    serviceTemplates = serviceTemplates.filter(x => x.id !== id);
    fullSave();
    renderTemplates();
    renderReceiptRows();
  }, () => renderTemplates());
}
function undoRemoveTemplate(id){
  const t = serviceTemplates.find(x => x.id === id);
  if (!t) return;
  undoSoftDelete(t, () => renderTemplates());
}

// ═══════════════════════════════════════════════════════
//  INVOICE CREATION
// ═══════════════════════════════════════════════════════
function renderReceiptRows(){
  const div = document.getElementById('receipt-rows');
  const startNum = parseInt(document.getElementById('inp-start-num').value)||1;
  div.innerHTML = receiptRows.map((row,i)=>{
    const calcLines = row.calcLines||[];
    const calcTotal = calcLines.reduce((s,l)=>s+(l.qty*(l.rate||0)),0);
    return `
    <div class="receipt-card">
      <div class="receipt-card-head">
        <div style="display:flex;align-items:center;gap:10px">
          <span class="badge badge-accent">Rechnung #${startNum+i}</span>
        </div>
        <button class="btn btn-danger btn-sm" onclick="removeReceiptRow(${i})">Entfernen</button>
      </div>
      <div class="receipt-card-body">
        <div class="grid2" style="margin-bottom:12px">
          <div class="field">
            <label>Empfänger</label>
            <select class="rec-select" onchange="handleRecipientChange(${i}, this.value)">${recipientOptions(row.recipient)}</select>
          </div>
          <div class="field" style="display:${row.recipient?'none':'block'}">
            <label>Benutzerdefinierter Name</label>
            <input value="${esc(row.customName||'')}" oninput="receiptRows[${i}].customName=this.value;fullSave()">
          </div>
        </div>

        ${serviceTemplates.length?`<div style="margin-bottom:12px">
          <label style="margin-bottom:4px">Schnell-Vorlage:</label>
          <div class="templates-list">
            ${serviceTemplates.filter(t=>!t._deleting).map(t=>`<span class="template-chip" onclick="insertTemplate(${i},${t.id})">+ ${esc(t.name)}</span>`).join('')}
          </div>
        </div>`:''}

        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;margin-bottom:12px">
          <div id="calc-lines-${i}">${calcLines.map((l,li)=>calcLineHTML(i,li,l)).join('')}</div>
          <div style="display:flex;gap:8px;margin-top:8px;align-items:center;">
            <button class="btn btn-sm" onclick="addCalcLine(${i})">+ Zeile</button>
            <button class="btn btn-sm btn-accent" onclick="applyCalcTotal(${i})">↓ In Betrag übernehmen</button>
            ${calcLines.length?`<span style="font-family:var(--mono);font-size:13.5px;font-weight:600;color:var(--accent);margin-left:auto">Gesamt: ${calcTotal.toFixed(2)} €</span>`:''}
          </div>
        </div>

        <div class="grid2">
          <div class="field">
            <label>Nettobetrag (€)</label>
            <input type="number" value="${row.betrag||0}" step="0.01" oninput="receiptRows[${i}].betrag=parseFloat(this.value)||0;fullSave();renderReceiptRows()">
          </div>
          <div class="field">
            <label>Steuersatz</label>
            <select onchange="receiptRows[${i}].taxRate=parseFloat(this.value);fullSave();renderReceiptRows()">
              <option value="0.20" ${(row.taxRate==null||row.taxRate===0.20)?'selected':''}>20%</option>
              <option value="0.10" ${row.taxRate===0.10?'selected':''}>10%</option>
              <option value="0" ${row.taxRate===0?'selected':''}>0% (Steuerbefreit)</option>
            </select>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function calcLineHTML(i, li, l){
  return `<div class="calc-row" style="margin-bottom:4px">
    <input value="${esc(l.desc||'')}" placeholder="Beschreibung" oninput="receiptRows[${i}].calcLines[${li}].desc=this.value;fullSave()">
    <select onchange="receiptRows[${i}].calcLines[${li}].type=this.value;fullSave();renderReceiptRows()">
      <option value="fixed" ${l.type==='fixed'?'selected':''}>Pauschal</option>
      <option value="hourly" ${l.type==='hourly'?'selected':''}>Stunden</option>
      <option value="per-unit" ${l.type==='per-unit'?'selected':''}>Stück</option>
    </select>
    <input type="number" min="0" step="1" value="${l.qty||1}" placeholder="Menge" oninput="receiptRows[${i}].calcLines[${li}].qty=parseFloat(this.value)||0;fullSave();renderReceiptRows()">
    <input type="number" min="0" step="0.01" value="${l.rate||0}" placeholder="€" oninput="receiptRows[${i}].calcLines[${li}].rate=parseFloat(this.value)||0;fullSave();renderReceiptRows()">
    <button class="btn btn-danger btn-icon" onclick="removeCalcLine(${i},${li})">×</button>
  </div>`;
}

function addCalcLine(i){ receiptRows[i].calcLines.push({desc:'',type:'fixed',qty:1,rate:0}); fullSave(); renderReceiptRows(); }
function removeCalcLine(i,li){ receiptRows[i].calcLines.splice(li,1); fullSave(); renderReceiptRows(); }
function applyCalcTotal(i){
  const total = (receiptRows[i].calcLines||[]).reduce((s,l)=>s+(l.qty*(l.rate||0)),0);
  receiptRows[i].betrag = Math.round(total*100)/100; fullSave(); renderReceiptRows();
}
function addReceiptRow(){ receiptRows.push({recipient:'',betrag:0,taxRate:0.20,calcLines:[]}); fullSave(); renderReceiptRows(); }
function removeReceiptRow(i){ receiptRows.splice(i,1); fullSave(); renderReceiptRows(); }

function handleRecipientChange(i, value) {
  receiptRows[i].recipient = value;
  if(value && recipientHistory[value] && receiptRows[i].calcLines.length === 0) {
    if(confirm(`Möchtest du die zuletzt verwendeten Leistungen für ${value} einfügen?`)) {
      recipientHistory[value].forEach(tplId => insertTemplate(i, tplId, true));
    }
  }
  fullSave(); renderReceiptRows();
}
function insertTemplate(rowIdx, tplId, skipRender=false){
  const tpl = serviceTemplates.find(t=>t.id===tplId);
  if(!tpl) return;
  receiptRows[rowIdx].calcLines.push({desc:tpl.name+(tpl.desc?' – '+tpl.desc:''), type:tpl.type, qty:1, rate:tpl.rate});
  if(receiptRows[rowIdx].recipient) {
    if(!recipientHistory[receiptRows[rowIdx].recipient]) recipientHistory[receiptRows[rowIdx].recipient] = [];
    if(!recipientHistory[receiptRows[rowIdx].recipient].includes(tplId)) recipientHistory[receiptRows[rowIdx].recipient].push(tplId);
  }
  fullSave(); if(!skipRender) renderReceiptRows();
}

// ═══════════════════════════════════════════════════════
//  DAUERAUFTRAG (RECURRING INVOICES)
// ═══════════════════════════════════════════════════════
function renderRecurring() {
  const container = document.getElementById('recurring-list');
  if(!container) return;
  if(!recurringInvoices.length) {
    container.innerHTML = '<div class="empty-state">Noch keine Daueraufträge vorhanden.</div>';
    return;
  }
  container.innerHTML = recurringInvoices.map((item, i) => {
    if(item._deleting) {
      return `<div class="receipt-card"><div class="receipt-card-body undo-row">
        <div class="undo-bar">
          <span>Dauerauftrag wird in <strong>${item._countdown || 0}s</strong> gelöscht...</span>
          <button class="btn btn-sm btn-accent" onclick="undoRemoveRecurring(${item.id})">↩ Rückgängig</button>
        </div>
      </div></div>`;
    }
    const calcLines = item.calcLines || [];
    const calcTotal = calcLines.reduce((s,l) => s + (l.qty*(l.rate||0)), 0);
    const taxRate = item.taxRate != null ? item.taxRate : 0.20;
    const total = calcTotal + calcTotal * taxRate;
    const freqLabel = {monthly:'Monatlich',quarterly:'Vierteljährlich',yearly:'Jährlich'}[item.frequency] || item.frequency;
    const nextDue = getNextDueDate(item);
    const isDue = nextDue && new Date(nextDue) <= new Date();

    return `
    <div class="receipt-card ${item.active ? '' : 'recurring-inactive'}">
      <div class="receipt-card-head">
        <div style="display:flex;align-items:center;gap:10px">
          <span class="badge ${item.active ? 'badge-accent' : 'badge-gray'}">🔄 ${freqLabel}</span>
          <strong>${esc(item.recipientName || 'Kein Empfänger')}</strong>
          ${isDue && item.active ? '<span class="badge badge-blue" style="animation:pulse 2s infinite">⚡ Fällig</span>' : ''}
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn btn-sm ${item.active ? 'btn-green' : ''}" onclick="toggleRecurringActive(${item.id})">${item.active ? '✓ Aktiv' : '✗ Inaktiv'}</button>
          <button class="btn btn-sm btn-danger" onclick="removeRecurring(${item.id})">Entfernen</button>
        </div>
      </div>
      <div class="receipt-card-body">
        <div class="grid2" style="margin-bottom:12px">
          <div class="field">
            <label>Empfänger</label>
            <select class="rec-select" onchange="recurringInvoices[${i}].recipientName=this.value;fullSave();renderRecurring()">${recipientOptions(item.recipientName)}</select>
          </div>
          <div class="field">
            <label>Frequenz</label>
            <select onchange="recurringInvoices[${i}].frequency=this.value;fullSave();renderRecurring()">
              <option value="monthly" ${item.frequency==='monthly'?'selected':''}>Monatlich</option>
              <option value="quarterly" ${item.frequency==='quarterly'?'selected':''}>Vierteljährlich</option>
              <option value="yearly" ${item.frequency==='yearly'?'selected':''}>Jährlich</option>
            </select>
          </div>
        </div>

        ${serviceTemplates.length?`<div style="margin-bottom:12px">
          <label style="margin-bottom:4px">Schnell-Vorlage:</label>
          <div class="templates-list">
            ${serviceTemplates.filter(t=>!t._deleting).map(t=>`<span class="template-chip" onclick="insertRecurringTemplate(${i},${t.id})">+ ${esc(t.name)}</span>`).join('')}
          </div>
        </div>`:''}

        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;margin-bottom:12px">
          <div>${calcLines.map((l,li)=>recurringCalcLineHTML(i,li,l)).join('')}</div>
          <div style="display:flex;gap:8px;margin-top:8px;align-items:center;">
            <button class="btn btn-sm" onclick="addRecurringCalcLine(${i})">+ Zeile</button>
            ${calcLines.length?`<span style="font-family:var(--mono);font-size:13.5px;font-weight:600;color:var(--accent);margin-left:auto">Netto: ${calcTotal.toFixed(2)} € · Brutto: ${total.toFixed(2)} €</span>`:''}
          </div>
        </div>

        <div class="grid2">
          <div class="field">
            <label>Steuersatz</label>
            <select onchange="recurringInvoices[${i}].taxRate=parseFloat(this.value);fullSave();renderRecurring()">
              <option value="0.20" ${(taxRate===0.20)?'selected':''}>20%</option>
              <option value="0.10" ${taxRate===0.10?'selected':''}>10%</option>
              <option value="0" ${taxRate===0?'selected':''}>0% (Steuerbefreit)</option>
            </select>
          </div>
          <div class="field">
            <label>Zuletzt generiert</label>
            <input type="date" value="${item.lastGenerated||''}" onchange="recurringInvoices[${i}].lastGenerated=this.value;fullSave();renderRecurring()">
          </div>
        </div>

        <div style="margin-top:12px">
          <button class="btn btn-accent" onclick="generateFromRecurring(${item.id})">📝 Rechnung generieren</button>
          ${nextDue ? `<span style="font-size:12px;color:var(--ink3);margin-left:12px">Nächste Fälligkeit: ${nextDue}</span>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function recurringCalcLineHTML(i, li, l) {
  return `<div class="calc-row" style="margin-bottom:4px">
    <input value="${esc(l.desc||'')}" placeholder="Beschreibung" oninput="recurringInvoices[${i}].calcLines[${li}].desc=this.value;fullSave()">
    <select onchange="recurringInvoices[${i}].calcLines[${li}].type=this.value;fullSave()">
      <option value="fixed" ${l.type==='fixed'?'selected':''}>Pauschal</option>
      <option value="hourly" ${l.type==='hourly'?'selected':''}>Stunden</option>
      <option value="per-unit" ${l.type==='per-unit'?'selected':''}>Stück</option>
    </select>
    <input type="number" min="0" step="1" value="${l.qty||1}" placeholder="Menge" oninput="recurringInvoices[${i}].calcLines[${li}].qty=parseFloat(this.value)||0;fullSave();renderRecurring()">
    <input type="number" min="0" step="0.01" value="${l.rate||0}" placeholder="€" oninput="recurringInvoices[${i}].calcLines[${li}].rate=parseFloat(this.value)||0;fullSave();renderRecurring()">
    <button class="btn btn-danger btn-icon" onclick="removeRecurringCalcLine(${i},${li})">×</button>
  </div>`;
}

function addRecurringCalcLine(i) { recurringInvoices[i].calcLines.push({desc:'',type:'fixed',qty:1,rate:0}); fullSave(); renderRecurring(); }
function removeRecurringCalcLine(i,li) { recurringInvoices[i].calcLines.splice(li,1); fullSave(); renderRecurring(); }
function insertRecurringTemplate(rowIdx, tplId) {
  const tpl = serviceTemplates.find(t=>t.id===tplId);
  if(!tpl) return;
  recurringInvoices[rowIdx].calcLines.push({desc:tpl.name+(tpl.desc?' – '+tpl.desc:''), type:tpl.type, qty:1, rate:tpl.rate});
  fullSave(); renderRecurring();
}

function addRecurring() {
  recurringInvoices.push({
    id: Date.now(),
    recipientName: '',
    calcLines: [],
    taxRate: 0.20,
    frequency: 'monthly',
    active: true,
    lastGenerated: ''
  });
  fullSave(); renderRecurring();
}

function removeRecurring(id) {
  const item = recurringInvoices.find(x => x.id === id);
  if(!item) return;
  startSoftDeleteCountdown(item, 5, () => {
    recurringInvoices = recurringInvoices.filter(x => x.id !== id);
    fullSave(); renderRecurring();
  }, () => renderRecurring());
}

function undoRemoveRecurring(id) {
  const item = recurringInvoices.find(x => x.id === id);
  if(!item) return;
  undoSoftDelete(item, () => renderRecurring());
}

function toggleRecurringActive(id) {
  const item = recurringInvoices.find(x => x.id === id);
  if(!item) return;
  item.active = !item.active;
  fullSave(); renderRecurring();
}

function getNextDueDate(item) {
  if(!item.lastGenerated) return null;
  const last = new Date(item.lastGenerated);
  let next;
  if(item.frequency === 'monthly') {
    next = new Date(last.getFullYear(), last.getMonth() + 1, last.getDate());
  } else if(item.frequency === 'quarterly') {
    next = new Date(last.getFullYear(), last.getMonth() + 3, last.getDate());
  } else {
    next = new Date(last.getFullYear() + 1, last.getMonth(), last.getDate());
  }
  return `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`;
}

function generateFromRecurring(id) {
  const item = recurringInvoices.find(x => x.id === id);
  if(!item || !item.active) return;

  const calcTotal = (item.calcLines||[]).reduce((s,l) => s + (l.qty*(l.rate||0)), 0);

  // Create a receipt row from the recurring template
  receiptRows.push({
    recipient: item.recipientName,
    customName: '',
    betrag: Math.round(calcTotal * 100) / 100,
    taxRate: item.taxRate != null ? item.taxRate : 0.20,
    calcLines: JSON.parse(JSON.stringify(item.calcLines || []))
  });

  // Update last generated date
  const today = new Date();
  item.lastGenerated = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  fullSave();
  renderReceiptRows();
  renderRecurring();
  switchTab('create');
}

function generateAllDue() {
  let count = 0;
  recurringInvoices.forEach(item => {
    if(!item.active) return;
    const nextDue = getNextDueDate(item);
    if(!nextDue || new Date(nextDue) <= new Date()) {
      generateFromRecurring(item.id);
      count++;
    }
  });
  if(count === 0) {
    alert('Keine fälligen Daueraufträge gefunden.');
  } else {
    switchTab('create');
  }
}

// ═══════════════════════════════════════════════════════
//  INVOICE BUILDER & PDF EXPORT
// ═══════════════════════════════════════════════════════
function getRecipientInfo(row){
  if(row.recipient){ const r=recipients.find(x=>x.name===row.recipient); if(r) return r; }
  return {name:row.customName||'',street:'',city:'',phone:'',email:''};
}

const epcDataStore = {};

function buildInvoiceHTML(row, num, overrideMonth, overrideYear, overrideDate){
  const S = getSender();
  const r = getRecipientInfo(row);
  const taxRate = row.taxRate!=null?row.taxRate:0.20;
  const netto = row.betrag||0;
  const tax = netto*taxRate;
  const total = netto+tax;
  const month = overrideMonth || document.getElementById('sel-month').value;
  const year = overrideYear || document.getElementById('inp-year').value;
  const dateInput = overrideDate || document.getElementById('inp-date').value;
  const dateStr = dateInput.split('-').reverse().join('.');
  const calcLines = (row.calcLines||[]).filter(l=>l.desc||l.rate);

  if(S.iban && S.bic && S.kontoinhaber) {
    epcDataStore[num] = buildEPCString(S, total, num, month, year);
  }

  return `
<div class="invoice-paper" id="invoice-${num}">
  <div class="inv-header">
    <div>
      <h2 style="margin-bottom: 5px; color: #000;">RECHNUNG</h2>
      <table class="inv-meta-table">
        <tr><td>Nummer:</td><td><strong>${num.toString().padStart(4,'0')}</strong></td></tr>
        <tr><td>Datum:</td><td>${dateStr}</td></tr>
        <tr><td>Leistungszeitraum:</td><td>${month} ${year}</td></tr>
      </table>
    </div>
    <div style="text-align: right;">
      <strong style="font-size: 16px; color:#000;">${S.name}</strong><br>
      ${S.street}<br> ${S.city}<br> ${S.tel}<br> ${S.email}
    </div>
  </div>
  <div style="margin-bottom: 40px; margin-top:20px;">
    <strong>EmpfängerIn:</strong><br>
    <div style="font-size: 15px; margin-top: 5px; color:#000;">
      ${r.name}<br> ${r.street?r.street+'<br>':''} ${r.city?r.city:''}
    </div>
  </div>
  <table class="inv-items-table">
    <thead>
      <tr><th>Leistung / Beschreibung</th><th style="text-align:right;">Menge</th><th style="text-align:right;">Einzel</th><th style="text-align:right;">Gesamt (Netto)</th></tr>
    </thead>
    <tbody>
      ${calcLines.length ? calcLines.map(l => `
        <tr>
          <td>${esc(l.desc)}</td>
          <td style="text-align:right;">${l.qty} ${l.type==='hourly'?'h':l.type==='per-unit'?'Stk':''}</td>
          <td style="text-align:right;">${(l.rate||0).toFixed(2)} €</td>
          <td style="text-align:right;">${(l.qty*(l.rate||0)).toFixed(2)} €</td>
        </tr>
      `).join('') : `
        <tr><td>Allgemeine Leistungen</td><td style="text-align:right;">1</td><td style="text-align:right;">${netto.toFixed(2)} €</td><td style="text-align:right;">${netto.toFixed(2)} €</td></tr>
      `}
    </tbody>
  </table>
  <div style="display:flex; justify-content:flex-end;">
    <table style="width:300px;">
      <tr class="inv-total-row"><td>Netto Summe:</td><td>${netto.toFixed(2)} €</td></tr>
      <tr class="inv-total-row"><td>USt. ${(taxRate*100).toFixed(0)}%:</td><td>${tax.toFixed(2)} €</td></tr>
      <tr class="inv-total-row inv-grand-total"><td>Gesamtbetrag:</td><td>${total.toFixed(2)} €</td></tr>
    </table>
  </div>
  <div style="margin-top:40px;font-size:12px;color:#555;">
    <p>Zahlbar innerhalb von 14 Tagen ohne Abzug. Bitte geben Sie bei der Überweisung die Rechnungsnummer <strong>${num.toString().padStart(4,'0')}</strong> an.</p>
  </div>
  <div class="inv-footer">
    <div><strong>Bankverbindung</strong><br>${S.bank}<br>Konto: ${S.kontoinhaber}<br>IBAN: ${S.iban}<br>BIC: ${S.bic}</div>
    <div style="text-align:right;"><strong>Unternehmensdaten</strong><br>UID: ${S.uid}<br>Steuer-Nr: ${S.steuer}</div>
  </div>
  ${(S.iban && S.bic && S.kontoinhaber) ? `
  <div class="inv-qr-section" style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;display:flex;align-items:center;gap:24px;">
    <div id="epc-qr-${num}" data-epc-id="${num}"
      style="flex-shrink:0;width:120px;height:120px;background:#fff;"></div>
    <div style="font-size:11px;color:#555;line-height:1.8;">
      <strong style="font-size:12px;color:#333;">📱 Jetzt einfach per Banking-App bezahlen</strong><br>
      QR-Code mit Ihrer Banking-App scannen — alle Zahlungsdaten<br>
      werden automatisch ausgefüllt.<br>
      <span style="color:#888;font-size:10.5px;">Betrag: <strong>${total.toFixed(2)} €</strong> · Ref: Rechnung ${num.toString().padStart(4,'0')}</span>
    </div>
  </div>` : ''}
</div>`;
}

function buildEPCString(S, total, num, month, year) {
  const iban  = S.iban.replace(/\s/g, '');
  const bic   = S.bic.trim();
  const name  = S.kontoinhaber.substring(0, 70);
  const amt   = 'EUR' + total.toFixed(2);
  const ref   = ('Rechnung ' + String(num).padStart(4, '0')).substring(0, 35);
  
  return [
    'BCD', '002', '1', 'SCT',
    bic, name, iban, amt, '', ref, '', ''
  ].join('\n');
}

function renderEPCQRCodes() {
  document.querySelectorAll('[data-epc-id]').forEach(el => {
    if(el.children.length > 0) return;
    const id = parseInt(el.getAttribute('data-epc-id'));
    const epcData = epcDataStore[id];
    if(!epcData || typeof QRCode === 'undefined') return;
    try {
      new QRCode(el, { text: epcData, width: 200, height: 200, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
      const img = el.querySelector('img');
      const canvas = el.querySelector('canvas');
      if(img) img.style.cssText = 'width:120px;height:120px;display:block;';
      if(canvas) canvas.style.cssText = 'width:120px;height:120px;display:block;';
    } catch(e) {}
  });
}

function populatePreviewSelect(){
  const sel = document.getElementById('preview-select');
  const startNum = parseInt(document.getElementById('inp-start-num').value)||1;
  sel.innerHTML = `<option value="all">📑 Alle Rechnungen</option>` + receiptRows.map((r,i)=> `<option value="${i}">Rechnung #${startNum+i} — ${r.recipient||r.customName||'Unbekannt'}</option>`).join('');
  
  if(receiptRows.length) showPreview('all');
  else document.getElementById('preview-area').innerHTML='<p style="text-align:center;padding:2rem;color:var(--ink3);">Noch keine Rechnungen erstellt.</p>';
}

function showPreview(val){
  const startNum = parseInt(document.getElementById('inp-start-num').value)||1;
  const area = document.getElementById('preview-area');
  const emailBtn = document.getElementById('btn-email-current');

  if(val === 'all') {
    emailBtn.style.display = 'none';
    area.innerHTML = receiptRows.map((r,i) => buildInvoiceHTML(r, startNum+i)).join('<div class="divider" style="margin:2rem 0"></div>');
  } else {
    emailBtn.style.display = 'inline-flex';
    const idx = parseInt(val);
    if(receiptRows[idx]) area.innerHTML = buildInvoiceHTML(receiptRows[idx], startNum+idx);
  }
  setTimeout(renderEPCQRCodes, 50);
}

// TAURI PDF SAVE FLOW
async function generatePDFBytes(row, num, filename, overrideMonth, overrideYear, overrideDate) {
  const month = overrideMonth || document.getElementById('sel-month').value;
  const year = overrideYear || document.getElementById('inp-year').value;
  const taxRate = row.taxRate != null ? row.taxRate : 0.20;
  const netto = row.betrag || 0;
  const total = netto + netto * taxRate;
  const S = getSender();
  if(S.iban && S.bic && S.kontoinhaber) epcDataStore[num] = buildEPCString(S, total, num, month, year);

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;background:#fff;';
  wrapper.innerHTML = buildInvoiceHTML(row, num, overrideMonth, overrideYear, overrideDate);
  document.body.appendChild(wrapper);

  wrapper.querySelectorAll('[data-epc-id]').forEach(el => {
    const id = parseInt(el.getAttribute('data-epc-id'));
    const epcStr = epcDataStore[id];
    if(!epcStr) return;
    try {
      new QRCode(el, { text: epcStr, width: 200, height: 200, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
      const img = el.querySelector('img');
      const canvas = el.querySelector('canvas');
      if(img) img.style.cssText = 'width:120px;height:120px;display:block;';
      if(canvas) canvas.style.cssText = 'width:120px;height:120px;display:block;';
    } catch(e) {}
  });

  await new Promise(r => setTimeout(r, 350));

  const opt = {
    margin: [10, 10, 10, 10],
    filename: filename,
    image: { type: 'png' },
    html2canvas: { scale: 3, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  const pdfBytes = await html2pdf().set(opt).from(wrapper.firstElementChild).outputPdf('arraybuffer');
  document.body.removeChild(wrapper);

  return Array.from(new Uint8Array(pdfBytes));
}

async function finalizeReceipt(row, num, status="Finalized") {
  const month = document.getElementById('sel-month').value;
  const year = document.getElementById('inp-year').value;
  const recName = (row.recipient || row.customName || 'Unbekannt').replace(/[^a-zA-Z0-9_\-]/g, '');
  const monthNum = String(new Date(Date.parse(month +" 1, 2012")).getMonth()+1).padStart(2, '0');
  let vendorPrefix = recName.substring(0,4).toUpperCase();
  if(!vendorPrefix) vendorPrefix = "UNKN";
  
  const filename = `${year}${monthNum}-${vendorPrefix}-${String(num).padStart(4,'0')}.pdf`;
  const taxRate = row.taxRate != null ? row.taxRate : 0.20;
  const netto = row.betrag || 0;
  const total = netto + netto * taxRate;
  let primaryCategory = "Allgemein";
  if(row.calcLines && row.calcLines.length > 0) primaryCategory = row.calcLines[0].desc.split(' ')[0] || "Allgemein";
  
  const metadata = {
    file_name: filename,
    path: "", 
    date: document.getElementById('inp-date').value,
    vendor: recName,
    category: primaryCategory,
    amount: total,
    status: status,
    row_data: row,
    invoice_num: num
  };

  const savedReceipt = await invoke('add_receipt', { metadata, pdfBytes: [] });
  await loadFromBackend(); 
  return savedReceipt;
}

// ═══════════════════════════════════════════════════════
//  ARCHIVE — Helper to resolve month from date string
// ═══════════════════════════════════════════════════════
function getMonthFromDate(dateStr) {
  if(!dateStr) return document.getElementById('sel-month').value;
  const parts = dateStr.split('-');
  if(parts.length < 2) return document.getElementById('sel-month').value;
  const monthIdx = parseInt(parts[1]) - 1;
  return GERMAN_MONTHS[monthIdx] || document.getElementById('sel-month').value;
}

function getYearFromDate(dateStr) {
  if(!dateStr) return document.getElementById('inp-year').value;
  return dateStr.split('-')[0] || document.getElementById('inp-year').value;
}

// ═══════════════════════════════════════════════════════
//  ARCHIVE — Download, Preview, Email
// ═══════════════════════════════════════════════════════
async function downloadArchivePdf(fileName) {
  const r = appRegistry.find(x => x.file_name === fileName);
  if(!r) return;
  if(r.row_data && r.invoice_num) {
    const month = getMonthFromDate(r.date);
    const year = getYearFromDate(r.date);
    
    const tempWrapper = document.createElement('div');
    tempWrapper.innerHTML = buildInvoiceHTML(r.row_data, r.invoice_num, month, year, r.date);
    const S = getSender();
    if(S.iban && S.bic && S.kontoinhaber) {
        const tr = r.row_data.taxRate != null ? r.row_data.taxRate : 0.20;
        const total = (r.row_data.betrag||0) * (1 + tr);
        epcDataStore[r.invoice_num] = buildEPCString(S, total, r.invoice_num, month, year);
    }
    
    document.body.appendChild(tempWrapper);
    const id = r.invoice_num;
    tempWrapper.querySelectorAll('[data-epc-id]').forEach(el => {
      const epcStr = epcDataStore[id];
      if(!epcStr) return;
      try {
        new QRCode(el, { text: epcStr, width: 200, height: 200, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
      } catch(e) {}
    });

    const opt = { margin: [10, 10, 10, 10], filename: fileName, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
    await html2pdf().set(opt).from(tempWrapper).save();
    document.body.removeChild(tempWrapper);
  } else {
    if(r.path) {
      await invoke('open_pdf', { path: r.path });
    } else {
      alert("Fehler: Dateipfad für altes Dokument nicht gefunden.");
    }
  }
}

async function previewArchiveReceipt(fileName) {
  const r = appRegistry.find(x => x.file_name === fileName);
  if(!r) return;
  if(r.row_data && r.invoice_num) {
    switchTab('preview');
    const area = document.getElementById('preview-area');
    const month = getMonthFromDate(r.date);
    const year = getYearFromDate(r.date);
    document.getElementById('btn-email-current').style.display = 'none';
    area.innerHTML = buildInvoiceHTML(r.row_data, r.invoice_num, month, year, r.date);
    setTimeout(renderEPCQRCodes, 50);
  } else {
    if(r.path) {
      // Altes Dokument -> öffne die ursprünglich generierte PDF-Datei
      await invoke('open_pdf', { path: r.path });
    } else {
      alert("Fehler: Dateipfad für altes Dokument nicht gefunden.");
    }
  }
}

async function emailArchiveReceipt(fileName) {
  const r = appRegistry.find(x => x.file_name === fileName);
  if(!r) return;
  
  if(!r.row_data || !r.invoice_num) {
      alert("Altes Dokument: Standard-Email wird vorbereitet.");
      await invoke('open_email', { to:'', subject:'Rechnung', body:'', attachmentPath: r.path });
      return;
  }

  const recInfo = getRecipientInfo(r.row_data);
  // FIX: Derive month from the receipt's stored date, not the current selector
  const month = getMonthFromDate(r.date);

  let subj = emailTemplate.subject.replace(/{Name}/g, recInfo.name).replace(/{Nummer}/g, r.invoice_num).replace(/{Monat}/g, month);
  let body = emailTemplate.body.replace(/{Name}/g, recInfo.name).replace(/{Nummer}/g, r.invoice_num).replace(/{Monat}/g, month);

  const bytesArray = await generatePDFBytes(r.row_data, r.invoice_num, fileName, month, getYearFromDate(r.date), r.date);
  const tempPath = await invoke('save_temp_pdf', { fileName: fileName, pdfBytes: bytesArray });

  await invoke('open_email', { to: recInfo.email||'', subject: subj, body: body, attachmentPath: tempPath });
}

// ═══════════════════════════════════════════════════════
//  PRINT / EMAIL (current invoices)
// ═══════════════════════════════════════════════════════
async function printCurrent(){
  const val = document.getElementById('preview-select').value;
  if(val === 'all') return printAll();
  
  const idx = parseInt(val);
  const startNum = parseInt(document.getElementById('inp-start-num').value)||1;
  const row = receiptRows[idx];
  if(row) {
    const filename = `Rechnung_${startNum+idx}.pdf`;
    const bytesArray = await generatePDFBytes(row, startNum+idx, filename);
    const tempPath = await invoke('save_temp_pdf', { fileName: filename, pdfBytes: bytesArray });
    await finalizeReceipt(row, startNum+idx, "Finalized");
    await invoke('print_file', { path: tempPath });
  }
}

async function printAll(){
  if(!receiptRows.length) return;
  const startNum = parseInt(document.getElementById('inp-start-num').value)||1;
  
  for(let i=0; i<receiptRows.length; i++) {
    await finalizeReceipt(receiptRows[i], startNum+i, "Finalized");
    await new Promise(r => setTimeout(r, 100));
  }
  
  const count = receiptRows.length;
  receiptRows = [];
  document.getElementById('inp-start-num').value = startNum + count;

  const selMonth = document.getElementById('sel-month');
  if(selMonth.selectedIndex < 11) selMonth.selectedIndex++;
  else { selMonth.selectedIndex = 0; document.getElementById('inp-year').value++; }

  fullSave(); saveSettings(); renderReceiptRows(); populatePreviewSelect();
  renderArchive();
  switchTab('archive');
}

async function emailCurrent() {
  const val = document.getElementById('preview-select').value;
  if(val === 'all') return alert("Bitte wähle eine einzelne Rechnung aus, um sie per Mail zu versenden.");
  
  const idx = parseInt(val);
  const row = receiptRows[idx];
  const r = getRecipientInfo(row);
  if(!r.email) {
    alert("Für diesen Empfänger ist keine E-Mail-Adresse hinterlegt!");
    return;
  }

  const startNum = parseInt(document.getElementById('inp-start-num').value)||1;
  const num = startNum + idx;
  const month = document.getElementById('sel-month').value;
  
  let subj = emailTemplate.subject.replace(/{Name}/g, r.name).replace(/{Nummer}/g, num).replace(/{Monat}/g, month);
  let body = emailTemplate.body.replace(/{Name}/g, r.name).replace(/{Nummer}/g, num).replace(/{Monat}/g, month);

  const filename = `Rechnung_${num}.pdf`;
  const bytesArray = await generatePDFBytes(row, num, filename);
  const tempPath = await invoke('save_temp_pdf', { fileName: filename, pdfBytes: bytesArray });
  await finalizeReceipt(row, num, "Sent");

  await invoke('open_email', { to: r.email, subject: subj, body: body, attachmentPath: tempPath });
}

// ═══════════════════════════════════════════════════════
//  ARCHIVE TABLE (with overflow menu & clickable rows)
// ═══════════════════════════════════════════════════════
function renderArchive() {
  const term = (document.getElementById('archive-search')?.value || '').toLowerCase().trim();
  const tbody = document.getElementById('archive-body');
  if(!tbody) return;

  const searchTerms = term.split(' ').filter(t => t);

  const filtered = appRegistry.filter(r => {
    if (!term) return true;
    
    let payload = [r.vendor, r.category, r.date, r.file_name, r.status, r.amount];
    
    // Search within Dienstleistungen (services)
    if (r.row_data && r.row_data.calcLines) {
      r.row_data.calcLines.forEach(l => {
        if (l.desc) payload.push(l.desc);
      });
    }
    const fullText = payload.join(' ').toLowerCase();

    // 1. Token-based match (e.g. "thomas 2024")
    const wordsMatch = searchTerms.every(t => fullText.includes(t));
    if (wordsMatch) return true;

    // 2. Sequential fuzzy fallback (e.g. "tms" matches "thomas")
    const fuzzyPattern = term.split('').map(c => c.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')).join('.*');
    const fuzzyRegex = new RegExp(fuzzyPattern, 'i');
    return fuzzyRegex.test(fullText);
  });

  tbody.innerHTML = filtered.map(r => {
    if(r._deleting) {
      return `<tr><td colspan="6" class="undo-row">
        <div class="undo-bar">
          <span>Rechnung wird in <strong>${r._countdown || 0}s</strong> gelöscht...</span>
          <button class="btn btn-sm btn-accent" onclick="undoDeleteReceipt('${esc(r.file_name)}')">↩ Rückgängig</button>
        </div>
      </td></tr>`;
    }
    return `
    <tr>
      <td>${r.date}</td>
      <td><strong class="archive-link" onclick="previewArchiveReceipt('${esc(r.file_name)}')">${esc(r.vendor)}</strong></td>
      <td><span class="archive-link" onclick="previewArchiveReceipt('${esc(r.file_name)}')" style="font-family:var(--mono);font-size:12px;color:var(--ink2)">${esc(r.file_name)}</span></td>
      <td>${r.amount.toFixed(2)} €</td>
      <td>
        <select onchange="updateStatus('${esc(r.file_name)}', this.value)" style="border:none;background:var(--surface2);padding:2px 6px;border-radius:4px;font-size:12px;">
          <option value="Draft" ${r.status==='Draft'?'selected':''}>Draft</option>
          <option value="Finalized" ${r.status==='Finalized'?'selected':''}>Finalized</option>
          <option value="Sent" ${r.status==='Sent'?'selected':''}>Sent</option>
          <option value="Archived" ${r.status==='Archived'?'selected':''}>Archived</option>
        </select>
      </td>
      <td>
        <div class="archive-actions">
          <button class="btn btn-sm btn-icon" onclick="downloadArchivePdf('${esc(r.file_name)}')" title="PDF Herunterladen">💾</button>
          <button class="btn btn-sm btn-icon" onclick="emailArchiveReceipt('${esc(r.file_name)}')" title="Teilen/Email">📧</button>
          <div class="overflow-menu-wrap">
            <button class="btn btn-sm btn-icon" onclick="toggleOverflowMenu(event, '${esc(r.file_name)}')" title="Mehr">⋯</button>
            <div class="overflow-menu" id="overflow-${esc(r.file_name)}" style="display:none">
              <button onclick="previewArchiveReceipt('${esc(r.file_name)}');closeAllOverflows()">👁 Vorschau</button>
              <div class="overflow-divider"></div>
              <button class="overflow-danger" onclick="deleteReceipt('${esc(r.file_name)}');closeAllOverflows()">🗑 Löschen</button>
            </div>
          </div>
        </div>
      </td>
    </tr>
  `
  }).join('');
}

function toggleOverflowMenu(event, fileName) {
  event.stopPropagation();
  closeAllOverflows();
  const menu = document.getElementById('overflow-' + fileName);
  if(menu) menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
}
function closeAllOverflows() {
  document.querySelectorAll('.overflow-menu').forEach(m => m.style.display = 'none');
}
document.addEventListener('click', () => closeAllOverflows());

function filterArchive() { renderArchive(); }

async function updateStatus(fileName, newStatus) {
  await invoke('update_receipt_status', { fileName, status: newStatus });
  await loadFromBackend();
  renderArchive();
}

async function deleteReceipt(fileName) {
  const r = appRegistry.find(x => x.file_name === fileName);
  if(!r) return;
  startSoftDeleteCountdown(r, 5, async () => {
    await invoke('delete_receipt', { fileName });
    await loadFromBackend();
    renderArchive();
  }, () => renderArchive());
}

function undoDeleteReceipt(fileName) {
  const r = appRegistry.find(x => x.file_name === fileName);
  if(!r) return;
  undoSoftDelete(r, () => renderArchive());
}

// ═══════════════════════════════════════════════════════
//  TAB SWITCHING
// ═══════════════════════════════════════════════════════
function switchTab(name){
  const tabNames = ['sender','recipients','services','create','recurring','preview','archive'];
  document.querySelectorAll('.tab').forEach((t,i)=>t.classList.toggle('active', tabNames[i]===name));
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  if(name==='preview') populatePreviewSelect();
}

// ═══════════════════════════════════════════════════════
//  BACKUP EXPORT / IMPORT
// ═══════════════════════════════════════════════════════
function exportBackupData() {
  const data = sysSettings;
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `rechnungen_backup_${getSmartDate()}.json`;
  a.click();
}

function importBackupData(e) {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    try {
      const data = JSON.parse(ev.target.result);
      
      // Detect old format (localStorage export) vs new format (Tauri settings export)
      // Old format has top-level keys: sender, recipients, serviceTemplates, receiptRows, recipientHistory, emailTemplate
      // New format has: sender, recipients, templates, drafts, history, emailTemplate
      
      const isOldFormat = data.serviceTemplates !== undefined || data.receiptRows !== undefined || data.recipientHistory !== undefined;
      
      if(isOldFormat) {
        // Map old key names → new key names
        sender = data.sender || sender;
        recipients = data.recipients || recipients;
        serviceTemplates = data.serviceTemplates || serviceTemplates;
        receiptRows = data.receiptRows || receiptRows;
        recipientHistory = data.recipientHistory || recipientHistory;
        if(data.emailTemplate) emailTemplate = data.emailTemplate;
      } else {
        // New format — keys already match what fullSave() produces
        sender = data.sender || sender;
        recipients = data.recipients || recipients;
        serviceTemplates = data.templates || serviceTemplates;
        receiptRows = data.drafts || receiptRows;
        recipientHistory = data.history || recipientHistory;
        recurringInvoices = data.recurring || recurringInvoices;
        if(data.emailTemplate) emailTemplate = data.emailTemplate;
        
        // Preserve settings fields from new format
        if(data.startNum) sysSettings.startNum = data.startNum;
        if(data.month) sysSettings.month = data.month;
        if(data.year) sysSettings.year = data.year;
        if(data.date) sysSettings.date = data.date;
        if(data.theme) sysSettings.theme = data.theme;
        if(data.lang) sysSettings.lang = data.lang;
      }
      
      // Push everything into sysSettings & save to backend
      await fullSave();
      
      // Reload settings into UI fields
      if(sysSettings.startNum) document.getElementById('inp-start-num').value = sysSettings.startNum;
      if(sysSettings.month) document.getElementById('sel-month').value = sysSettings.month;
      if(sysSettings.year) document.getElementById('inp-year').value = sysSettings.year;
      if(sysSettings.date) document.getElementById('inp-date').value = sysSettings.date;
      
      // Re-render everything
      loadSenderFields();
      renderRecipients();
      renderTemplates();
      renderReceiptRows();
      renderRecurring();
      renderArchive();
      
      alert("✓ Backup wurde erfolgreich geladen (" + (isOldFormat ? "altes Format erkannt" : "neues Format") + ").");
    } catch(err) {
      console.error("Import error:", err);
      alert("Fehler beim Laden der Backup-Datei. Ist es eine gültige JSON Datei?\n\n" + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
