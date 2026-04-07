const { invoke } = window.__TAURI__.core;

// ═══════════════════════════════════════════════════════
//  STATE & INITIALIZATION
// ═══════════════════════════════════════════════════════
let sender = {};
let recipients = [];
let serviceTemplates = [];
let receiptRows = [];
let recipientHistory = {}; 
let emailTemplate = { subject: "Rechnung {Nummer} - {Monat}", body: "Hallo {Name},\n\nanbei erhältst du die Rechnung Nr. {Nummer} für den Monat {Monat}.\n\nViele Grüße,\nDein Team" };
let sysSettings = {};
let appRegistry = [];

async function loadFromBackend() {
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
}

async function fullSave() {
  sysSettings.sender = sender;
  sysSettings.recipients = recipients;
  sysSettings.templates = serviceTemplates;
  sysSettings.drafts = receiptRows;
  sysSettings.history = recipientHistory;
  sysSettings.emailTemplate = emailTemplate;
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
  renderArchive();
});

async function pickStorageFolder() {
  const f = await invoke('pick_folder');
  if(f) {
    document.getElementById('sys-storage-path').value = f;
    // We would need to tell backend to move storage or just update path.
    alert("Speicherort aktualisiert (Funktionalität im Backend wird benötigt, um Dateien zu migrieren).");
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
//  THEME / DARK MODE
// ═══════════════════════════════════════════════════════
function toggleTheme(forceDark = false) {
  const isDark = forceDark || document.body.getAttribute('data-theme') !== 'dark';
  if(isDark) {
    document.body.setAttribute('data-theme', 'dark');
    document.getElementById('theme-btn').innerText = '☀️';
    sysSettings.theme = 'dark';
  } else {
    document.body.removeAttribute('data-theme');
    document.getElementById('theme-btn').innerText = '🌙';
    sysSettings.theme = 'light';
  }
  fullSave();
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
//  RECIPIENTS
// ═══════════════════════════════════════════════════════
function renderRecipients(){
  const tbody = document.getElementById('rec-body');
  tbody.innerHTML = recipients.map((r,i)=>`
    <tr>
      <td style="color:var(--ink3);font-size:12px">${i+1}</td>
      <td><input value="${esc(r.name)}" placeholder="Name" oninput="recipients[${i}].name=this.value;fullSave();refreshDropdowns()"></td>
      <td><input value="${esc(r.street)}" placeholder="Straße" oninput="recipients[${i}].street=this.value;fullSave()"></td>
      <td><input value="${esc(r.city)}" placeholder="PLZ Ort" oninput="recipients[${i}].city=this.value;fullSave()"></td>
      <td><input value="${esc(r.phone||'')}" placeholder="Telefon" oninput="recipients[${i}].phone=this.value;fullSave()"></td>
      <td><input type="email" value="${esc(r.email||'')}" placeholder="E-Mail" oninput="recipients[${i}].email=this.value;fullSave()"></td>
      <td><button class="btn btn-danger btn-sm btn-icon" onclick="removeRecipient(${i})">×</button></td>
    </tr>`).join('');
}
function addRecipient(){ recipients.push({name:'',street:'',city:'',phone:'',email:''}); renderRecipients(); fullSave(); refreshDropdowns(); }
function removeRecipient(i){ recipients.splice(i,1); renderRecipients(); fullSave(); refreshDropdowns(); }
function recipientOptions(selected=''){ return `<option value="">— Benutzerdefiniert —</option>`+ recipients.map(r=>`<option value="${esc(r.name)}" ${r.name===selected?'selected':''}>${esc(r.name)}</option>`).join(''); }
function refreshDropdowns(){ document.querySelectorAll('.rec-select').forEach(sel=>{ const cur=sel.value; sel.innerHTML=recipientOptions(cur); }); }

// ═══════════════════════════════════════════════════════
//  SERVICES (TEMPLATES)
// ═══════════════════════════════════════════════════════
function renderTemplates(){
  const c = document.getElementById('templates-container');
  if(!serviceTemplates.length){ c.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--ink3);padding:1rem;">Noch keine Vorlagen vorhanden.</td></tr>'; return; }
  c.innerHTML = serviceTemplates.map((t,i)=>`
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
    </tr>`).join('');
}
function addServiceTemplate(){ serviceTemplates.push({ id: Date.now(), name: '', type: 'fixed', rate: 0, desc: '' }); fullSave(); renderTemplates(); }
function removeTemplate(id){ serviceTemplates = serviceTemplates.filter(t=>t.id!==id); fullSave(); renderTemplates(); renderReceiptRows(); }

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
            ${serviceTemplates.map(t=>`<span class="template-chip" onclick="insertTemplate(${i},${t.id})">+ ${esc(t.name)}</span>`).join('')}
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
//  INVOICE BUILDER & PDF EXPORT
// ═══════════════════════════════════════════════════════
function getRecipientInfo(row){
  if(row.recipient){ const r=recipients.find(x=>x.name===row.recipient); if(r) return r; }
  return {name:row.customName||'',street:'',city:'',phone:'',email:''};
}

const epcDataStore = {};

function buildInvoiceHTML(row, num){
  const S = getSender();
  const r = getRecipientInfo(row);
  const taxRate = row.taxRate!=null?row.taxRate:0.20;
  const netto = row.betrag||0;
  const tax = netto*taxRate;
  const total = netto+tax;
  const month = document.getElementById('sel-month').value;
  const year = document.getElementById('inp-year').value;
  const dateStr = document.getElementById('inp-date').value.split('-').reverse().join('.');
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
async function generateAndSavePDF(row, num, status="Finalized") {
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
  const S = getSender();
  if(S.iban && S.bic && S.kontoinhaber) epcDataStore[num] = buildEPCString(S, total, num, month, year);

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;background:#fff;';
  wrapper.innerHTML = buildInvoiceHTML(row, num);
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

  // Convert arraybuffer to array for Tauri byte passing
  const bytesArray = Array.from(new Uint8Array(pdfBytes));
  
  let primaryCategory = "Allgemein";
  if(row.calcLines && row.calcLines.length > 0) primaryCategory = row.calcLines[0].desc.split(' ')[0] || "Allgemein";
  
  const metadata = {
    file_name: filename,
    path: "", // backend will fill
    date: document.getElementById('inp-date').value,
    vendor: recName,
    category: primaryCategory,
    amount: total,
    status: status
  };

  const savedReceipt = await invoke('add_receipt', { metadata, pdfBytes: bytesArray });
  await loadFromBackend(); // refresh registry
  return savedReceipt;
}

async function printCurrent(){
  const val = document.getElementById('preview-select').value;
  if(val === 'all') return printAll();
  
  const idx = parseInt(val);
  const startNum = parseInt(document.getElementById('inp-start-num').value)||1;
  const row = receiptRows[idx];
  if(row) {
    const receipt = await generateAndSavePDF(row, startNum+idx, "Finalized");
    await invoke('print_file', { path: receipt.path });
  }
}

async function printAll(){
  if(!receiptRows.length) return;
  const startNum = parseInt(document.getElementById('inp-start-num').value)||1;
  
  for(let i=0; i<receiptRows.length; i++) {
    await generateAndSavePDF(receiptRows[i], startNum+i, "Finalized");
    await new Promise(r => setTimeout(r, 600)); 
  }
  
  // Clear drafts properly
  const count = receiptRows.length;
  receiptRows = [];
  document.getElementById('inp-start-num').value = startNum + count;

  // Auto-advance month if > 15 logic
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

  const receipt = await generateAndSavePDF(row, num, "Sent");
  await invoke('open_email', { to: r.email, subject: subj, body: body, attachmentPath: receipt.path });
}

// ═══════════════════════════════════════════════════════
//  ARCHIVE & DASHBOARD
// ═══════════════════════════════════════════════════════
function renderArchive() {
  const term = (document.getElementById('archive-search')?.value || '').toLowerCase();
  const tbody = document.getElementById('archive-body');
  if(!tbody) return;
  
  const filtered = appRegistry.filter(r => 
    r.vendor.toLowerCase().includes(term) ||
    r.category.toLowerCase().includes(term) ||
    r.date.includes(term) ||
    r.file_name.toLowerCase().includes(term)
  );

  tbody.innerHTML = filtered.map(r => `
    <tr>
      <td>${r.date}</td>
      <td><strong>${esc(r.vendor)}</strong></td>
      <td><span style="font-family:var(--mono);font-size:12px;color:var(--ink2)">${esc(r.file_name)}</span></td>
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
        <button class="btn btn-sm btn-icon" onclick="invoke('open_email', {to:'', subject:'Rechnung', body:'', attachmentPath:'${esc(r.path)}'})" title="Teilen">📧</button>
        <button class="btn btn-sm btn-icon btn-danger" onclick="deleteReceipt('${esc(r.file_name)}')">×</button>
      </td>
    </tr>
  `).join('');
  
  renderDashboard();
}

function filterArchive() { renderArchive(); }

async function updateStatus(fileName, newStatus) {
  await invoke('update_receipt_status', { fileName, status: newStatus });
  await loadFromBackend();
  renderArchive();
}

async function deleteReceipt(fileName) {
  if(!confirm(`Bist du sicher, dass du "${fileName}" löschen möchtest? Dies löscht auch die Datei unwiderruflich.`)) return;
  await invoke('delete_receipt', { fileName });
  await loadFromBackend();
  renderArchive();
}

function renderDashboard() {
  const chart = document.getElementById('dashboard-chart');
  if(!chart) return;
  
  if(appRegistry.length === 0) {
    chart.innerHTML = '<div class="empty-state">Noch keine Daten vorhanden.</div>';
    return;
  }
  
  // Group by vendor 
  const byVendor = {};
  appRegistry.forEach(r => { 
    if(!byVendor[r.vendor]) byVendor[r.vendor] = 0;
    byVendor[r.vendor] += r.amount;
  });
  
  const max = Math.max(...Object.values(byVendor));
  
  chart.innerHTML = Object.keys(byVendor).map(v => {
    const h = (byVendor[v] / max) * 250;
    return `
      <div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:40px;">
        <span style="font-size:11px;color:var(--ink2);margin-bottom:4px;">${byVendor[v].toFixed(0)}€</span>
        <div style="width:30px;height:${h}px;background:var(--accent);border-radius:4px 4px 0 0;transition:height .3s;"></div>
        <span style="font-size:11px;color:var(--ink);margin-top:6px;writing-mode:horizontal-tb;transform:rotate(0deg);text-align:center;overflow:hidden;text-overflow:ellipsis;width:100%;">${esc(v)}</span>
      </div>
    `;
  }).join('');
}

function switchTab(name){
  document.querySelectorAll('.tab').forEach((t,i)=>t.classList.toggle('active', ['sender','recipients','services','create','preview','archive','dashboard'][i]===name));
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  if(name==='preview') populatePreviewSelect();
}

// Backup Export/Import wrapper for new registry formats
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
