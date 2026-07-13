// Utility helpers
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function showScreen(num) {
  $('#tela1').style.display = num === 1 ? 'block' : 'none';
  $('#tela2').style.display = num === 2 ? 'block' : 'none';
}

function sanitizeFileName(v) {
  return String(v || 'Checklist')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\-_]+/g, '_').replace(/^_+|_+$/g, '');
}

function updateAuditorInfo() {
  const nome = $('#auditorNome')?.value?.trim() || 'Rececionista não identificado';
  const data = $('#auditorData')?.value?.trim();
  const turno = $('#turnoSelecionado')?.value || '';
  const map = { noite: 'Noite', manha: 'Manhã', tarde: 'Tarde', doorman: 'Doorman' };
  $('#auditorInfo').innerText = `${map[turno] || 'Não selecionado'} | ${nome}${data ? ' | ' + data : ''}`;
}

function getChecklistItems() { return $$('#tela2 .check-item'); }
function getAllCheckboxes(root = document) { return $$('input[type="checkbox"]:not(.section-toggle-all)', root); }
function isOptional(cb) { return cb.dataset.optional === 'true' || cb.dataset.sunday === 'true'; }
function clearWarnings() { getChecklistItems().forEach(li => li.classList.remove('unchecked-warning')); }

function aplicarExclusivos(turno) {
  $$('.bloco-exclusivo-noturno').forEach(el => {
    el.style.display = turno === 'noite' ? 'block' : 'none';
  });

  const contagemTabBtn = $('[data-tab="tab-contagem"]');
  if (contagemTabBtn) {
    if (turno === 'doorman') {
      contagemTabBtn.style.display = 'none';
      if (contagemTabBtn.classList.contains('active')) {
        switchTab('tab-checklist');
      }
    } else {
      contagemTabBtn.style.display = '';
    }
  }
}

function switchTab(tabId) {
  if (tabId === 'tab-contagem') {
    const isStarted = $('#turnoSelecionado').value !== '' && $('#tela2').style.display === 'block';
    if (!isStarted) {
      alert('Por favor, seleciona o turno e inicia o processo primeiro.');
      return;
    }
  }

  $$('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  $$('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === tabId);
  });
  if (tabId === 'tab-checklist') {
    const isStarted = $('#turnoSelecionado').value !== '' && $('#tela2').style.display === 'block';
    showScreen(isStarted ? 2 : 1);
  }
  
  if (typeof updateChecklistProgressBar === 'function') {
    updateChecklistProgressBar();
  }
}

async function confirmarTurno(isLoading = false) {
  const turno = $('#turnoSelecionado').value;
  const nome = $('#auditorNome').value.trim();
  const data = $('#auditorData').value.trim();

  if (!isLoading && (!turno || !nome || !data)) {
    alert('Por favor, seleciona o turno, preenche o nome do rececionista e a data.');
    return;
  }

  if (!isLoading) {
    await loadDynamicChecklists();
  }

  const map = { noite: 'Noite', manha: 'Manhã', tarde: 'Tarde', doorman: 'Doorman' };
  const resumo = $('#turnoResumoTexto');
  if (resumo) resumo.textContent = map[turno] || '';

  $$('.checklist-wrapper').forEach(el => el.style.display = 'none');
  const wrapper = $(`#checklist-${turno}`);
  if (wrapper) wrapper.style.display = 'block';

  aplicarExclusivos(turno);

  document.body.classList.remove('turno-noite', 'turno-manha', 'turno-tarde', 'turno-doorman');
  document.body.classList.add(`turno-${turno}`);

  const obs = $('#observacoesFinaisContainer');
  if (obs) obs.style.display = 'block';

  updateAuditorInfo();
  
  if (!isLoading) {
    try {
      const saved = localStorage.getItem(storageKey);
      let d = saved ? JSON.parse(saved) : {};
      if (!d.shiftsCash) d.shiftsCash = {};
      
      // Get the most recently finalized shift from the database
      let lastCompletedCash = null;
      try {
        const db = JSON.parse(localStorage.getItem('night_audit_db_v1') || '[]');
        for (const record of db) {
          if (record.cash && record.cash.inputs && record.cash.inputs.length > 0) {
            lastCompletedCash = JSON.parse(JSON.stringify(record.cash));
            break;
          }
        }
      } catch (dbErr) {
        console.error("Error reading database for cash data:", dbErr);
      }
      
      // Initialize or carry over cashier registries
      const nextInputs = lastCompletedCash ? (lastCompletedCash.inputs || Array(15).fill(null).map(() => ({ val: '0' }))) : Array(15).fill(null).map(() => ({ val: '0' }));
      const nextVales = lastCompletedCash ? (lastCompletedCash.vales || []).filter(v => v.status !== 'Pago') : [];
      const nextPaidouts = lastCompletedCash ? (lastCompletedCash.paidouts || []).filter(p => p.status !== 'Reembolsado') : [];
      
      d.shiftsCash[turno] = {
        inputs: nextInputs,
        vales: nextVales,
        paidouts: nextPaidouts,
        meta: {
          tAtual: turno,
          rAtual: nome,
          tProx: '',
          rProx: '',
          recebido: '0.00'
        }
      };
      
      d.cash = d.shiftsCash[turno];
      localStorage.setItem(storageKey, JSON.stringify(d));
    } catch (e) {
      console.error("Error initializing starting cash data:", e);
    }

    const cashTurno = $('#cashTurnoAtual');
    if (cashTurno) {
      cashTurno.value = turno;
      cashTurno.dispatchEvent(new Event('change'));
    }

    const cashRececionista = $('#cashRececionistaAtual');
    if (cashRececionista) cashRececionista.value = nome;
  }

  showScreen(2);

  if (typeof saveProgress === 'function') saveProgress();
}

function togglePhase(btn) {
  const id = btn.dataset.target;
  const el = document.getElementById(id);
  if (!el) return;
  const open = el.style.display === 'block';
  el.style.display = open ? 'none' : 'block';
  btn.setAttribute('aria-expanded', String(!open));

  if (typeof saveProgress === 'function') saveProgress();
}

function toggleHelp(btn) {
  const item = btn.closest('.check-item');
  const help = $('.help-text', item);
  if (!help) return;
  const willOpen = !help.classList.contains('open');
  help.classList.toggle('open', willOpen);
  btn.setAttribute('aria-expanded', String(willOpen));
  btn.setAttribute('aria-label', willOpen ? 'Ocultar explicação' : 'Mostrar explicação');
  btn.textContent = willOpen ? '−' : '?';
}

function getSectionCBs(sec) { return $$('li.check-item input[type="checkbox"]', sec); }

function updateSectionToggle(sec) {
  const master = $('.section-toggle-all', sec);
  if (!master) return;
  const items = getSectionCBs(sec);
  const total = items.length;
  const checked = items.filter(cb => cb.checked).length;
  master.checked = total > 0 && checked === total;
  master.indeterminate = checked > 0 && checked < total;
}

function updateAllSectionToggles() {
  $$('.phase-content, .checklist-continua').forEach(updateSectionToggle);
}

function handleSectionToggle(master) {
  const sec = master.closest('.phase-content, .checklist-continua');
  if (!sec) return;
  getSectionCBs(sec).forEach(cb => cb.checked = master.checked);
  clearWarnings();
  updateSectionToggle(sec);

  if (typeof saveProgress === 'function') saveProgress();
}

function resetTurno() {
  if (!confirm('Deseja anular o progresso da checklist e voltar ao início? (A contagem de caixa será mantida)')) return;
  try {
    const saved = localStorage.getItem(storageKey); // Requires storageKey from storage.js
    if (saved) {
      const d = JSON.parse(saved);
      localStorage.setItem(storageKey, JSON.stringify({ cash: d.cash, shiftsCash: d.shiftsCash }));
    }
  } catch (e) { }

  ['auditorNome', 'auditorData', 'obsIniciais', 'proto', 'obsFinais'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const sel = document.getElementById('turnoSelecionado');
  if (sel) sel.value = '';

  $$('#tab-checklist input[type="checkbox"]').forEach(cb => cb.checked = false);
  document.querySelectorAll('.help-text.open').forEach(el => el.classList.remove('open'));
  clearWarnings();
  updateAllSectionToggles();
  aplicarExclusivos('');
  document.body.classList.remove('turno-noite', 'turno-manha', 'turno-tarde', 'turno-doorman');
  showScreen(1);
  updateAuditorInfo();
  
  if (typeof updateChecklistProgressBar === 'function') {
    updateChecklistProgressBar();
  }
}

async function finalizarTurno() {
  const turno = $('#turnoSelecionado')?.value || '';
  const proto = $('#proto')?.value?.trim();
  if (turno === 'noite' && !proto) { alert('O protocolo MySana é obrigatório.'); return; }
  clearWarnings();
  const activeWrapper = $(`#checklist-${turno}`);
  const cbs = getAllCheckboxes(activeWrapper);
  for (const cb of cbs) {
    if (!cb.checked && !isOptional(cb)) {
      const phaseContent = cb.closest('.phase-content');
      if (phaseContent && phaseContent.style.display === 'none') {
        const btn = document.querySelector(`.phase-btn[data-target="${phaseContent.id}"]`);
        if (btn) togglePhase(btn);
      }
      
      const li = cb.closest('.check-item');
      li.classList.add('unchecked-warning');
      li.scrollIntoView({ behavior: 'smooth', block: 'center' });
      alert('Existem itens obrigatórios não marcados.');
      return;
    }
  }
  
  if (confirm('Checklist completa. Deseja finalizar o turno, gerar PDFs e reiniciar?')) {
    // Force final progress save to make sure everything is in sync
    if (typeof saveProgress === 'function') saveProgress();

    const auditor = $('#auditorNome')?.value?.trim() || 'Rececionista';
    const data = $('#auditorData')?.value?.trim() || new Date().toISOString().split('T')[0];
    
    // Generate Checklist PDF
    const chResult = await gerarChecklistPDFObject();
    
    // Generate Caixa PDF
    let cxResult = null;
    if (turno !== 'doorman') {
      cxResult = await gerarCaixaPDF();
    }
    
    // Save to local database
    saveShiftToDatabase({
      turno: turno,
      auditor: auditor,
      data: data,
      obsIniciais: $('#obsIniciais')?.value || '',
      obsFinais: $('#obsFinais')?.value || '',
      proto: proto || '',
      checklistChecks: typeof getAllCheckboxes === 'function' ? getAllCheckboxes(activeWrapper).map(cb => ({
        label: cb.closest('.check-label')?.querySelector('.item-text')?.textContent?.replace(/\?/g, '')?.trim() || cb.closest('.check-label')?.textContent?.trim() || '',
        checked: cb.checked
      })) : [],
      cash: turno !== 'doorman' ? {
        inputs: Array.from(document.querySelectorAll('#tableNotas .cash-input, #tableMoedas .cash-input')).map(i => ({ val: i.value, denomination: i.dataset.value })),
        totalNotas: parseFloat(document.getElementById('totalNotasSum')?.innerText) || 0,
        totalMoedas: parseFloat(document.getElementById('totalMoedasSum')?.innerText) || 0,
        totalVales: parseFloat(document.getElementById('totalValesSum')?.innerText) || 0,
        totalPaidouts: parseFloat(document.getElementById('totalPaidoutsSum')?.innerText) || 0,
        totalGeral: parseFloat(document.getElementById('totalGeralCaixa')?.innerText) || 0,
        montanteRecebido: parseFloat(document.getElementById('montanteRecebidoDia').value) || 0,
        deposito: parseFloat(document.getElementById('depositoDiaCalculado')?.innerText) || 0,
        diferenca: parseFloat(document.getElementById('diferencaCaixa')?.innerText) || 0,
        vales: Array.from(document.querySelectorAll('#bodyVales tr')).map(tr => ({
          val: tr.querySelector('.dyn-val').value, 
          just: tr.querySelector('.dyn-just').value, 
          dept: tr.querySelector('.dyn-dept').value, 
          resp: tr.querySelector('.dyn-resp').value, 
          date: tr.querySelector('.dyn-date').value,
          status: tr.dataset.status || 'Pendente',
          paidBy: tr.dataset.paidBy || '',
          paidTime: tr.dataset.paidTime || ''
        })),
        paidouts: Array.from(document.querySelectorAll('#bodyPaidouts tr')).map(tr => ({
          val: tr.querySelector('.dyn-val').value, 
          just: tr.querySelector('.dyn-just').value, 
          room: tr.querySelector('.dyn-room').value, 
          resp: tr.querySelector('.dyn-resp').value, 
          date: tr.querySelector('.dyn-date').value,
          status: tr.dataset.status || 'Pendente',
          reimbursed: tr.dataset.reimbursed || '0',
          pending: tr.dataset.pending || '0',
          reimbursedBy: tr.dataset.reimbursedBy || '',
          reimbursedTime: tr.dataset.reimbursedTime || ''
        })),
        meta: {
          tAtual: $('#cashTurnoAtual')?.value || '',
          rAtual: $('#cashRececionistaAtual')?.value || '',
          tProx: $('#cashTurnoProximo')?.value || '',
          rProx: $('#cashRececionistaProximo')?.value || ''
        }
      } : null
    });

    // Send webhooks to Power Automate (SharePoint)
    let webhookSuccess = true;
    if (chResult) {
      const ok = await triggerWebhook(chResult.pdfNome, chResult.pdfBase64, 'Checklist');
      if (!ok) webhookSuccess = false;
    }
    if (cxResult) {
      const ok = await triggerWebhook(cxResult.pdfNome, cxResult.pdfBase64, 'Caixa');
      if (!ok) webhookSuccess = false;
    }

    if (webhookSuccess) {
      alert("✅ SUCESSO! Turno finalizado, PDFs descarregados e salvos no SharePoint!");
    } else {
      alert("⚠️ Turno finalizado, mas houve falha ao guardar no SharePoint (verifique a consola).");
    }

    try {
      const saved = localStorage.getItem(storageKey); // Requires storageKey from storage.js
      if (saved) {
        const d = JSON.parse(saved);
        
        const completedShift = d.turno || (d.cash && d.cash.meta && d.cash.meta.tAtual) || '';
        
        // Save current completed shift's cash state to shiftsCash
        if (completedShift && d.cash) {
          if (!d.shiftsCash) d.shiftsCash = {};
          d.shiftsCash[completedShift] = JSON.parse(JSON.stringify(d.cash));
        }

        let nextShift = '';
        let nextRec = '';
        if (d.cash && d.cash.meta) {
          nextShift = d.cash.meta.tProx || '';
          nextRec = d.cash.meta.rProx || '';
        }

        // Initialize or load the next shift's cash data
        if (nextShift) {
          if (!d.shiftsCash) d.shiftsCash = {};
          const currentCash = d.cash ? JSON.parse(JSON.stringify(d.cash)) : null;
          if (currentCash) {
            const nextInputs = currentCash.inputs || Array(15).fill(null).map(() => ({ val: '0' }));
            const nextVales = (currentCash.vales || []).filter(v => v.status !== 'Pago');
            const nextPaidouts = (currentCash.paidouts || []).filter(p => p.status !== 'Reembolsado');
            d.cash = {
              inputs: nextInputs,
              vales: nextVales,
              paidouts: nextPaidouts,
              meta: {
                tAtual: nextShift,
                rAtual: nextRec,
                tProx: '',
                rProx: '',
                recebido: '0.00'
              }
            };
          } else {
            d.cash = {
              inputs: Array(15).fill(null).map(() => ({ val: '0' })),
              vales: [],
              paidouts: [],
              meta: {
                tAtual: nextShift,
                rAtual: nextRec,
                tProx: '',
                rProx: '',
                recebido: '0.00'
              }
            };
          }
          
          // Ensure meta settings are set for the transition
          d.cash.meta.tAtual = nextShift;
          d.cash.meta.rAtual = nextRec;
          d.cash.meta.tProx = '';
          d.cash.meta.rProx = '';
          d.cash.meta.recebido = '0.00';
          
          // Keep in sync in shiftsCash map
          d.shiftsCash[nextShift] = d.cash;
        } else {
          d.cash = null;
        }

        d.turno = nextShift;
        d.auditorNome = nextRec;
        d.auditorData = '';
        d.obsIniciais = ''; d.proto = ''; d.obsFinais = '';
        d.checks = []; d.tela2Visible = false; d.openPhases = [];
        localStorage.setItem(storageKey, JSON.stringify(d));
      }
    } catch (e) { }
    location.reload();
  }
}

async function triggerWebhook(pdfNome, pdfBase64, type) {
  const turno = $('#turnoSelecionado')?.value || '';
  const auditor = $('#auditorNome')?.value?.trim() || 'Rececionista';
  const totalGeral = $('#totalGeralCaixa')?.innerText || '0.00';
  const diferenca = $('#diferencaCaixa')?.innerText || '0.00';
  const obsIni = $('#obsIniciais')?.value || 'Sem observações.';
  
  const payload = {
    dataHora: new Date().toLocaleString('pt-PT'),
    turno: turno,
    rececionista: auditor,
    totalGeralCaixa: parseFloat(totalGeral) || 0,
    diferencaCaixa: parseFloat(diferenca) || 0,
    obsIniciais: `[${type}] ` + obsIni,
    obsFinais: `Fecho concluído via app. Relatório tipo: ${type}`,
    pdfNome: pdfNome,
    pdfConteudoBase64: pdfBase64
  };

  const webhookUrl = "https://defaulte3dc9b5c8d2143428af283327ca360.e3.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/a90ca4cb88204727a3bf23354a19cf91/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=HE9JTgBLGHRX3RZT7qVsSzpnLojaOKhxMHVNssyz8xw";

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (response.ok) {
      console.log(`✅ SUCESSO! PDF [${type}] enviado para SharePoint!`);
      return true;
    } else {
      console.warn(`⚠️ O SharePoint recusou o PDF [${type}]. Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ ERRO DE CONEXÃO webhook para [${type}]: ${error.message}`);
    return false;
  }
}

async function gerarChecklistPDFObject() {
  if (!window.jspdf?.jsPDF) { alert('Biblioteca de PDF não carregada.'); return null; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 15;
  const margin = 10, pw = 190;

  function addLine(txt, size = 11, color = [0, 0, 0], gap = 6) {
    doc.setFontSize(size); doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(txt), pw);
    if (y + (lines.length * 5) > 285) { doc.addPage(); y = 15; }
    doc.text(lines, margin, y);
    y += Math.max(gap, lines.length * 5);
  }

  const turno = $('#turnoSelecionado')?.value || '';
  const map = { noite: 'Night Audit', manha: 'Manhã', tarde: 'Tarde', doorman: 'Doorman' };
  const auditor = $('#auditorNome')?.value?.trim() || 'Rececionista';
  const data = $('#auditorData')?.value?.trim() || 'Não informada';
  const proto = $('#proto')?.value?.trim() || 'N/A';
  const obsIni = $('#obsIniciais')?.value?.trim() || 'Sem observações iniciais.';
  const obsFim = $('#obsFinais')?.value?.trim() || 'Sem observações finais.';
  const totalGeral = $('#totalGeralCaixa')?.innerText || '0.00';
  const deposito = $('#depositoDiaCalculado')?.innerText || '0.00';
  const diferenca = $('#diferencaCaixa')?.innerText || '0.00';
  const recebido = $('#montanteRecebidoDia')?.value || '0.00';

  doc.setFontSize(20); doc.setTextColor(0, 38, 58);
  doc.text(`Checklist ${map[turno] || turno} - Comprovativo`, 10, y); y += 8;
  doc.setDrawColor(198, 166, 103); doc.setLineWidth(1); doc.line(10, y, 200, y); y += 8;

  addLine(`Auditor: ${auditor}`);
  addLine(`Data: ${data}`);
  addLine(`Protocolo MySana: ${proto}`);
  addLine(`Gerado em: ${new Date().toLocaleString('pt-PT')}`, 10, [60, 60, 60]);
  addLine(`Obs. iniciais: ${obsIni}`, 10, [60, 60, 60], 8);
  addLine(`Obs. finais: ${obsFim}`, 10, [60, 60, 60], 8);

  if (turno !== 'doorman') {
    y += 5;
    addLine(`Fundo de Caixa Fixo: 750.00 €`, 11, [0, 0, 0], 6);
    addLine(`Montante Recebido (Sistema): ${recebido} €`, 11, [0, 0, 0], 6);
    addLine(`Total Geral (Espécie + Docs): ${totalGeral} €`, 11, [0, 0, 0], 6);
    addLine(deposito === '-' ? 'DEPÓSITO DO DIA: -' : `DEPÓSITO DO DIA: ${deposito} €`, 13, [0, 38, 58], 7);
    addLine(`Diferença de Caixa: ${diferenca}`, 11, [parseFloat(diferenca) < 0 ? 200 : 0, 0, 0], 8);

    const vales = Array.from(document.querySelectorAll('#bodyVales tr'));
    if (vales.length > 0) {
      addLine('Detalhamento de Vales / Vouchers:', 11, [198, 166, 103], 6);
      vales.forEach(tr => {
        const v = tr.querySelector('.dyn-val').value || '0';
        const j = tr.querySelector('.dyn-just').value || '-';
        const d = tr.querySelector('.dyn-dept').value || '-';
        addLine(` - ${v}€ | Just: ${j} | Dept: ${d}`, 9, [0, 0, 0], 5);
      });
    }

    const pouts = Array.from(document.querySelectorAll('#bodyPaidouts tr'));
    if (pouts.length > 0) {
      addLine('Detalhamento de Paid-outs:', 11, [198, 166, 103], 6);
      pouts.forEach(tr => {
        const v = tr.querySelector('.dyn-val').value || '0';
        const j = tr.querySelector('.dyn-just').value || '-';
        const r = tr.querySelector('.dyn-room').value || '-';
        addLine(` - ${v}€ | Just: ${j} | Quarto: ${r}`, 9, [0, 0, 0], 5);
      });
    }
  }

  y += 2;
  addLine('Itens concluídos:', 15, [0, 38, 58], 8);

  let count = 0;
  const activeWrapper = $(`#checklist-${turno}`);

  getChecklistItems().forEach(li => {
    if (!activeWrapper || !activeWrapper.contains(li)) return;

    const cb = $('input[type="checkbox"]', li);
    const it = $('.item-text', li);
    let txt = '';
    if (it) {
      const clone = it.cloneNode(true);
      const toRemove = clone.querySelectorAll('.help-text, .optional-badge');
      toRemove.forEach(el => el.remove());
      txt = (clone.textContent || '').trim().replace(/\s+/g, ' ');
    }
    if (cb && cb.checked && txt) { count++; addLine(`• ${txt}`, 10, [0, 0, 0], 6); }
  });

  if (!count) addLine('Nenhum item concluído foi marcado.', 10, [120, 0, 0], 6);
  addLine(`Total: ${count} itens concluídos`, 11, [0, 38, 58], 8);
  addLine(`Rececionista: ${auditor}`, 12, [0, 38, 58], 6);
  doc.setDrawColor(198, 166, 103); doc.setLineWidth(1); doc.line(10, y, 100, y); y += 6;
  addLine('Assinatura manual:', 11, [20, 20, 20], 8);

  const safe = sanitizeFileName(`Checklist_${map[turno] || turno}_${data}_${auditor}`) || 'ChecklistComprovativo';
  doc.save(`${safe}.pdf`);

  return {
    pdfNome: `${safe}.pdf`,
    pdfBase64: doc.output('datauristring').split(',')[1]
  };
}

async function gerarCaixaPDF() {
  if (!window.jspdf?.jsPDF) { alert('Biblioteca de PDF não carregada.'); return null; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 15;
  const margin = 10, pw = 190;

  function addLine(txt, size = 11, color = [0, 0, 0], gap = 6) {
    doc.setFontSize(size); doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(txt), pw);
    if (y + (lines.length * 5) > 285) { doc.addPage(); y = 15; }
    doc.text(lines, margin, y);
    y += Math.max(gap, lines.length * 5);
  }

  const turno = $('#turnoSelecionado')?.value || '';
  const map = { noite: 'Night Audit', manha: 'Manhã', tarde: 'Tarde', doorman: 'Doorman' };
  const auditor = $('#auditorNome')?.value?.trim() || 'Rececionista';
  const data = $('#auditorData')?.value?.trim() || 'Não informada';
  
  const cashTurnoAtual = $('#cashTurnoAtual')?.value || '';
  const cashRececionistaAtual = $('#cashRececionistaAtual')?.value || '';
  const cashTurnoProximo = $('#cashTurnoProximo')?.value || '';
  const cashRececionistaProximo = $('#cashRececionistaProximo')?.value || '';

  const totalGeral = $('#totalGeralCaixa')?.innerText || '0.00';
  const deposito = $('#depositoDiaCalculado')?.innerText || '0.00';
  const diferenca = $('#diferencaCaixa')?.innerText || '0.00';
  const recebido = $('#montanteRecebidoDia')?.value || '0.00';

  doc.setFontSize(20); doc.setTextColor(0, 38, 58);
  doc.text(`Contagem de Caixa - Comprovativo`, 10, y); y += 8;
  doc.setDrawColor(198, 166, 103); doc.setLineWidth(1); doc.line(10, y, 200, y); y += 8;

  addLine(`Rececionista Turno Atual: ${cashRececionistaAtual || auditor} (${map[cashTurnoAtual] || map[turno] || cashTurnoAtual})`);
  addLine(`Data de Trabalho: ${data}`);
  addLine(`Próximo Rececionista: ${cashRececionistaProximo || 'N/A'} (${map[cashTurnoProximo] || 'N/A'})`);
  addLine(`Gerado em: ${new Date().toLocaleString('pt-PT')}`, 10, [60, 60, 60]);

  y += 5;
  addLine(`FUNDO DE CAIXA FIXO: 750.00 €`, 11, [0, 0, 0], 6);
  addLine(`Montante Recebido (Sistema): ${recebido} €`, 11, [0, 0, 0], 6);
  addLine(`Total Geral (Espécie + Docs): ${totalGeral} €`, 11, [0, 0, 0], 6);
  addLine(deposito === '-' ? 'DEPÓSITO DO DIA: -' : `DEPÓSITO DO DIA: ${deposito} €`, 13, [0, 38, 58], 7);
  addLine(`Diferença de Caixa: ${diferenca}`, 11, [parseFloat(diferenca) < 0 ? 200 : 0, 0, 0], 8);

  y += 5;
  addLine('Detalhamento de Espécie:', 13, [0, 38, 58], 7);

  const notesInputs = Array.from(document.querySelectorAll('#tableNotas tbody .cash-input'));
  let notesStr = "Notas: ";
  notesInputs.forEach(i => {
    const qty = parseInt(i.value) || 0;
    if (qty > 0) {
      notesStr += `${qty}x${i.dataset.value}€ | `;
    }
  });
  if (notesStr === "Notas: ") notesStr += "Nenhuma nota declarada.";
  else notesStr = notesStr.slice(0, -3);
  addLine(notesStr, 10, [0, 0, 0], 6);

  const coinsInputs = Array.from(document.querySelectorAll('#tableMoedas tbody .cash-input'));
  let coinsStr = "Moedas: ";
  coinsInputs.forEach(i => {
    const qty = parseInt(i.value) || 0;
    if (qty > 0) {
      coinsStr += `${qty}x${i.dataset.value}€ | `;
    }
  });
  if (coinsStr === "Moedas: ") coinsStr += "Nenhuma moeda declarada.";
  else coinsStr = coinsStr.slice(0, -3);
  addLine(coinsStr, 10, [0, 0, 0], 8);

  const vales = Array.from(document.querySelectorAll('#bodyVales tr'));
  if (vales.length > 0) {
    y += 2;
    addLine('Detalhamento de Vales / Vouchers:', 13, [0, 38, 58], 7);
    vales.forEach(tr => {
      const v = tr.querySelector('.dyn-val').value || '0';
      const j = tr.querySelector('.dyn-just').value || '-';
      const d = tr.querySelector('.dyn-dept').value || '-';
      const r = tr.querySelector('.dyn-resp').value || '-';
      const date = tr.querySelector('.dyn-date').value || '-';
      const status = tr.dataset.status || 'Pendente';
      const paidBy = tr.dataset.paidBy || '';
      const paidTime = tr.dataset.paidTime || '';
      
      let statusStr = status;
      if (status === 'Pago') {
        statusStr = `PAGO por ${paidBy} em ${paidTime}`;
      }
      
      addLine(` - ${v}€ | Just: ${j} | Dept: ${d} | Resp: ${r} | Data: ${date} | Estado: ${statusStr}`, 9, [0, 0, 0], 5);
    });
  }

  const pouts = Array.from(document.querySelectorAll('#bodyPaidouts tr'));
  if (pouts.length > 0) {
    y += 4;
    addLine('Detalhamento de Paid-outs:', 13, [0, 38, 58], 7);
    pouts.forEach(tr => {
      const v = parseFloat(tr.querySelector('.dyn-val').value) || 0;
      const j = tr.querySelector('.dyn-just').value || '-';
      const rm = tr.querySelector('.dyn-room').value || '-';
      const r = tr.querySelector('.dyn-resp').value || '-';
      const date = tr.querySelector('.dyn-date').value || '-';
      
      const status = tr.dataset.status || 'Pendente';
      const reimbursed = parseFloat(tr.dataset.reimbursed) || 0;
      const pending = parseFloat(tr.dataset.pending) || 0;
      const actionBy = tr.dataset.reimbursedBy || '';
      const actionTime = tr.dataset.reimbursedTime || '';
      
      let reimbStr = "Pendente";
      if (status === 'Reembolsado') {
        reimbStr = `REEMBOLSADO INTEGRALMENTE por ${actionBy} em ${actionTime}`;
      } else if (status === 'Parcial') {
        reimbStr = `REEMBOLSADO PARCIALMENTE: Recebido ${reimbursed.toFixed(2)}€, Falta Reembolsar ${pending.toFixed(2)}€ (por ${actionBy} em ${actionTime})`;
      }
      
      addLine(` - Original: ${v.toFixed(2)}€ | Just: ${j} | Quarto: ${rm} | Resp: ${r} | Data: ${date} | Estado: ${reimbStr}`, 9, [0, 0, 0], 5);
    });
  }

  y += 10;
  addLine('Assinatura do Rececionista:', 11, [20, 20, 20], 12);
  doc.setDrawColor(198, 166, 103); doc.setLineWidth(1); doc.line(10, y, 100, y); y += 6;

  const safe = sanitizeFileName(`Caixa_${map[cashTurnoAtual] || cashTurnoAtual || 'Turno'}_${data}_${cashRececionistaAtual || auditor}`) || 'ComprovativoCaixa';
  doc.save(`${safe}.pdf`);

  return {
    pdfNome: `${safe}.pdf`,
    pdfBase64: doc.output('datauristring').split(',')[1]
  };
}

// Local Database Functions
function saveShiftToDatabase(shiftData) {
  try {
    const key = 'night_audit_db_v1';
    const db = JSON.parse(localStorage.getItem(key) || '[]');
    shiftData.id = 'shift-' + Date.now();
    shiftData.timestamp = Date.now();
    db.unshift(shiftData);
    localStorage.setItem(key, JSON.stringify(db));
  } catch (e) {
    console.error('Error saving shift to database:', e);
  }
}

function exportDatabase() {
  const db = localStorage.getItem('night_audit_db_v1') || '[]';
  const blob = new Blob([db], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `night_audit_database_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importDatabase(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (Array.isArray(data)) {
        if (confirm(`Deseja importar ${data.length} registos? Isso irá substituir o histórico atual.`)) {
          localStorage.setItem('night_audit_db_v1', JSON.stringify(data));
          renderHistoryTab();
          alert('Histórico importado com sucesso!');
        }
      } else {
        alert('Ficheiro inválido. A base de dados deve ser um array JSON.');
      }
    } catch(err) {
      alert('Erro ao ler ficheiro: ' + err.message);
    }
  };
  reader.readAsText(file);
  input.value = ''; // Reset file input
}

// History tab columns rendering engine
function applyHistoryFilters() {
  renderHistoryTab();
}

function renderHistoryTab() {
  const db = JSON.parse(localStorage.getItem('night_audit_db_v1') || '[]');
  
  // Read filter values
  const filterDate = document.getElementById('histFilterDate')?.value || '';
  const filterAuditor = document.getElementById('histFilterAuditor')?.value?.toLowerCase()?.trim() || '';
  const filterShift = document.getElementById('histFilterShift')?.value || '';
  const sortOption = document.getElementById('histSortOptions')?.value || 'newest';
  
  // Apply filtering
  let filteredDb = db.filter(record => {
    if (filterDate && record.data !== filterDate) return false;
    if (filterShift && record.turno !== filterShift) return false;
    if (filterAuditor && !record.auditor?.toLowerCase()?.includes(filterAuditor)) return false;
    return true;
  });
  
  // Apply sorting
  filteredDb.sort((a, b) => {
    if (sortOption === 'newest') {
      return (b.timestamp || 0) - (a.timestamp || 0);
    } else if (sortOption === 'oldest') {
      return (a.timestamp || 0) - (b.timestamp || 0);
    } else if (sortOption === 'az') {
      return (a.auditor || '').localeCompare(b.auditor || '');
    } else if (sortOption === 'za') {
      return (b.auditor || '').localeCompare(a.auditor || '');
    }
    return 0;
  });

  const chContainer = document.getElementById('historyChecklistList');
  const cxContainer = document.getElementById('historyCaixaList');
  const poContainer = document.getElementById('historyPaidoutsList');
  const vaContainer = document.getElementById('historyValesList');
  
  chContainer.innerHTML = '';
  cxContainer.innerHTML = '';
  poContainer.innerHTML = '';
  vaContainer.innerHTML = '';
  
  if (filteredDb.length === 0) {
    const emptyMsg = '<div style="text-align:center; color:var(--muted); padding:20px; font-size:13px;">Sem registos correspondentes.</div>';
    chContainer.innerHTML = emptyMsg;
    cxContainer.innerHTML = emptyMsg;
    poContainer.innerHTML = emptyMsg;
    vaContainer.innerHTML = emptyMsg;
    return;
  }
  
  const map = { noite: 'Night Audit', manha: 'Manhã', tarde: 'Tarde', doorman: 'Doorman' };
  
  let allPaidouts = [];
  let allVales = [];

  filteredDb.forEach((record) => {
    // Column 1: Checklist Card
    const chCard = document.createElement('div');
    chCard.className = 'history-card';
    const checkedCount = (record.checklistChecks || []).filter(c => c.checked).length;
    const totalCount = (record.checklistChecks || []).length;
    chCard.innerHTML = `
      <div class="history-card-header">
        <span class="history-card-title">${map[record.turno] || record.turno}</span>
        <span class="history-card-date">${record.data}</span>
      </div>
      <div class="history-card-body">
        <strong>Rececionista:</strong> ${record.auditor}<br>
        <strong>Tarefas:</strong> ${checkedCount}/${totalCount} concluídas<br>
        <strong>Obs:</strong> ${record.obsFinais ? record.obsFinais.substring(0, 50) + (record.obsFinais.length > 50 ? '...' : '') : 'N/A'}
      </div>
      <div class="history-card-actions">
        <button class="history-pdf-btn" onclick="regenerateChecklistPDF('${record.id}')">Descarregar PDF</button>
      </div>
    `;
    chContainer.appendChild(chCard);

    // Column 2: Caixa Card
    if (record.cash) {
      const cxCard = document.createElement('div');
      cxCard.className = 'history-card';
      const dep = record.cash.deposito;
      const dif = record.cash.diferenca;
      
      cxCard.innerHTML = `
        <div class="history-card-header">
          <span class="history-card-title">Contagem Caixa</span>
          <span class="history-card-date">${record.data}</span>
        </div>
        <div class="history-card-body">
          <strong>Rececionista:</strong> ${record.cash.meta?.rAtual || record.auditor}<br>
          <strong>Total Geral:</strong> ${record.cash.totalGeral.toFixed(2)}€<br>
          <strong>Depósito:</strong> ${dep < 0 || isNaN(dep) ? '-' : dep.toFixed(2) + '€'}<br>
          <strong>Diferença:</strong> ${dif < -0.005 ? `<span style="color:#ff5757; font-weight:bold;">${dif.toFixed(2)}€</span>` : '-'}
        </div>
        <div class="history-card-actions">
          <button class="history-pdf-btn" onclick="regenerateCaixaPDF('${record.id}')">Descarregar PDF</button>
        </div>
      `;
      cxContainer.appendChild(cxCard);

      // Accumulate logs
      if (record.cash.paidouts) {
        record.cash.paidouts.forEach(p => {
          allPaidouts.push({ ...p, auditor: record.auditor, shift: record.turno, shiftDate: record.data });
        });
      }
      if (record.cash.vales) {
        record.cash.vales.forEach(v => {
          allVales.push({ ...v, auditor: record.auditor, shift: record.turno, shiftDate: record.data });
        });
      }
    }
  });

  // Column 3 - Paidouts History Box
  if (allPaidouts.length === 0) {
    poContainer.innerHTML = '<div style="text-align:center; color:var(--muted); padding:20px; font-size:13px;">Sem paid-outs registados.</div>';
  } else {
    allPaidouts.forEach(p => {
      const poCard = document.createElement('div');
      poCard.className = 'history-card';
      
      const val = parseFloat(p.val) || 0;
      const reimbursed = parseFloat(p.reimbursed) || 0;
      const pending = parseFloat(p.pending) || 0;
      
      let statusBadge = '';
      let logMeta = '';
      if (p.status === 'Reembolsado') {
        statusBadge = `<span style="color:var(--success); font-weight:bold; font-size:11px;">Reembolsado</span>`;
        logMeta = `<div style="font-size:10px; color:var(--muted); margin-top:5px; border-top:1px dashed var(--border); padding-top:4px;">
                     Reembolsado por <strong>${p.reimbursedBy || 'Rececionista'}</strong> em ${p.reimbursedTime || p.shiftDate}
                   </div>`;
      } else if (p.status === 'Parcial') {
        statusBadge = `<span style="color:var(--gold); font-weight:bold; font-size:11px;">Reembolso Parcial</span>`;
        logMeta = `<div style="font-size:10px; color:var(--muted); margin-top:5px; border-top:1px dashed var(--border); padding-top:4px;">
                     Reembolsado: <strong>${reimbursed.toFixed(2)}€</strong> (Falta reembolsar <strong>${pending.toFixed(2)}€</strong>)<br>
                     Registado por <strong>${p.reimbursedBy || 'Rececionista'}</strong> em ${p.reimbursedTime || p.shiftDate}
                   </div>`;
      } else {
        statusBadge = `<span style="color:var(--muted); font-weight:bold; font-size:11px;">Pendente</span>`;
      }

      poCard.innerHTML = `
        <div class="history-card-header">
          <span class="history-card-title">${val.toFixed(2)}€</span>
          ${statusBadge}
        </div>
        <div class="history-card-body">
          <strong>Justificação:</strong> ${p.just || '-'}<br>
          <strong>Quarto:</strong> ${p.room || '-'} | <strong>Resp:</strong> ${p.resp || '-'}<br>
          <strong>Fecho:</strong> ${p.shiftDate} (${map[p.shift] || p.shift} por ${p.auditor})
          ${logMeta}
        </div>
      `;
      poContainer.appendChild(poCard);
    });
  }

  // Column 3 - Vales History Box
  if (allVales.length === 0) {
    vaContainer.innerHTML = '<div style="text-align:center; color:var(--muted); padding:20px; font-size:13px;">Sem vales registados.</div>';
  } else {
    allVales.forEach(v => {
      const vaCard = document.createElement('div');
      vaCard.className = 'history-card';
      
      const val = parseFloat(v.val) || 0;
      let statusBadge = '';
      let logMeta = '';
      if (v.status === 'Pago') {
        statusBadge = `<span style="color:var(--success); font-weight:bold; font-size:11px;">Pago</span>`;
        logMeta = `<div style="font-size:10px; color:var(--muted); margin-top:5px; border-top:1px dashed var(--border); padding-top:4px;">
                     Pago por <strong>${v.paidBy || 'Rececionista'}</strong> em ${v.paidTime || v.shiftDate}
                   </div>`;
      } else {
        statusBadge = `<span style="color:var(--muted); font-weight:bold; font-size:11px;">Pendente</span>`;
      }

      vaCard.innerHTML = `
        <div class="history-card-header">
          <span class="history-card-title">${val.toFixed(2)}€</span>
          ${statusBadge}
        </div>
        <div class="history-card-body">
          <strong>Justificação:</strong> ${v.just || '-'}<br>
          <strong>Dept:</strong> ${v.dept || '-'} | <strong>Resp:</strong> ${v.resp || '-'}<br>
          <strong>Fecho:</strong> ${v.shiftDate} (${map[v.shift] || v.shift} por ${v.auditor})
          ${logMeta}
        </div>
      `;
      vaContainer.appendChild(vaCard);
    });
  }
}

function regenerateChecklistPDF(recordId) {
  const db = JSON.parse(localStorage.getItem('night_audit_db_v1') || '[]');
  const record = db.find(r => r.id === recordId);
  if (!record) return;

  if (!window.jspdf?.jsPDF) { alert('Biblioteca de PDF não carregada.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 15;
  const margin = 10, pw = 190;

  function addLine(txt, size = 11, color = [0, 0, 0], gap = 6) {
    doc.setFontSize(size); doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(txt), pw);
    if (y + (lines.length * 5) > 285) { doc.addPage(); y = 15; }
    doc.text(lines, margin, y);
    y += Math.max(gap, lines.length * 5);
  }

  const map = { noite: 'Night Audit', manha: 'Manhã', tarde: 'Tarde', doorman: 'Doorman' };
  
  doc.setFontSize(20); doc.setTextColor(0, 38, 58);
  doc.text(`Checklist ${map[record.turno] || record.turno} - Comprovativo (Arquivo)`, 10, y); y += 8;
  doc.setDrawColor(198, 166, 103); doc.setLineWidth(1); doc.line(10, y, 200, y); y += 8;

  addLine(`Auditor: ${record.auditor}`);
  addLine(`Data: ${record.data}`);
  addLine(`Protocolo MySana: ${record.proto || 'N/A'}`);
  addLine(`Gerado em: ${new Date().toLocaleString('pt-PT')}`, 10, [60, 60, 60]);
  addLine(`Obs. iniciais: ${record.obsIniciais || 'N/A'}`, 10, [60, 60, 60], 8);
  addLine(`Obs. finais: ${record.obsFinais || 'N/A'}`, 10, [60, 60, 60], 8);

  if (record.cash) {
    y += 5;
    addLine(`Fundo de Caixa Fixo: 750.00 €`, 11, [0, 0, 0], 6);
    addLine(`Montante Recebido (Sistema): ${record.cash.montanteRecebido.toFixed(2)} €`, 11, [0, 0, 0], 6);
    addLine(`Total Geral (Espécie + Docs): ${record.cash.totalGeral.toFixed(2)} €`, 11, [0, 0, 0], 6);
    const dep = record.cash.deposito;
    addLine(dep < 0 || isNaN(dep) ? 'DEPÓSITO DO DIA: -' : `DEPÓSITO DO DIA: ${dep.toFixed(2)} €`, 13, [0, 38, 58], 7);
    addLine(`Diferença de Caixa: ${record.cash.diferenca.toFixed(2)} €`, 11, [record.cash.diferenca < 0 ? 200 : 0, 0, 0], 8);

    if (record.cash.vales && record.cash.vales.length > 0) {
      addLine('Detalhamento de Vales / Vouchers:', 11, [198, 166, 103], 6);
      record.cash.vales.forEach(v => {
        addLine(` - ${v.val}€ | Just: ${v.just} | Dept: ${v.dept}`, 9, [0, 0, 0], 5);
      });
    }

    if (record.cash.paidouts && record.cash.paidouts.length > 0) {
      addLine('Detalhamento de Paid-outs:', 11, [198, 166, 103], 6);
      record.cash.paidouts.forEach(p => {
        addLine(` - ${p.val}€ | Just: ${p.just} | Quarto: ${p.room}`, 9, [0, 0, 0], 5);
      });
    }
  }

  y += 2;
  addLine('Itens concluídos:', 15, [0, 38, 58], 8);
  let count = 0;
  (record.checklistChecks || []).forEach(item => {
    if (item.checked) {
      count++;
      addLine(`• ${item.label}`, 10, [0, 0, 0], 6);
    }
  });
  if (!count) addLine('Nenhum item concluído foi marcado.', 10, [120, 0, 0], 6);
  addLine(`Total: ${count} itens concluídos`, 11, [0, 38, 58], 8);
  addLine(`Rececionista: ${record.auditor}`, 12, [0, 38, 58], 6);
  doc.setDrawColor(198, 166, 103); doc.setLineWidth(1); doc.line(10, y, 100, y); y += 6;
  addLine('Assinatura manual:', 11, [20, 20, 20], 8);

  const safe = sanitizeFileName(`Checklist_${map[record.turno] || record.turno}_${record.data}_${record.auditor}`) || 'ChecklistComprovativo';
  doc.save(`${safe}_Arquivo.pdf`);
}

function regenerateCaixaPDF(recordId) {
  const db = JSON.parse(localStorage.getItem('night_audit_db_v1') || '[]');
  const record = db.find(r => r.id === recordId);
  if (!record || !record.cash) return;

  if (!window.jspdf?.jsPDF) { alert('Biblioteca de PDF não carregada.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 15;
  const margin = 10, pw = 190;

  function addLine(txt, size = 11, color = [0, 0, 0], gap = 6) {
    doc.setFontSize(size); doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(txt), pw);
    if (y + (lines.length * 5) > 285) { doc.addPage(); y = 15; }
    doc.text(lines, margin, y);
    y += Math.max(gap, lines.length * 5);
  }

  const map = { noite: 'Night Audit', manha: 'Manhã', tarde: 'Tarde', doorman: 'Doorman' };
  const cash = record.cash;
  const tAtual = cash.meta?.tAtual || record.turno;
  const rAtual = cash.meta?.rAtual || record.auditor;
  const tProx = cash.meta?.tProx || 'N/A';
  const rProx = cash.meta?.rProx || 'N/A';

  doc.setFontSize(20); doc.setTextColor(0, 38, 58);
  doc.text(`Contagem de Caixa - Comprovativo (Arquivo)`, 10, y); y += 8;
  doc.setDrawColor(198, 166, 103); doc.setLineWidth(1); doc.line(10, y, 200, y); y += 8;

  addLine(`Rececionista Turno Atual: ${rAtual} (${map[tAtual] || tAtual})`);
  addLine(`Data de Trabalho: ${record.data}`);
  addLine(`Próximo Rececionista: ${rProx} (${map[tProx] || tProx})`);
  addLine(`Gerado em: ${new Date().toLocaleString('pt-PT')}`, 10, [60, 60, 60]);

  y += 5;
  addLine(`FUNDO DE CAIXA FIXO: 750.00 €`, 11, [0, 0, 0], 6);
  addLine(`Montante Recebido (Sistema): ${cash.montanteRecebido.toFixed(2)} €`, 11, [0, 0, 0], 6);
  addLine(`Total Geral (Espécie + Docs): ${cash.totalGeral.toFixed(2)} €`, 11, [0, 0, 0], 6);
  const dep = cash.deposito;
  addLine(dep < 0 || isNaN(dep) ? 'DEPÓSITO DO DIA: -' : `DEPÓSITO DO DIA: ${dep.toFixed(2)} €`, 13, [0, 38, 58], 7);
  addLine(`Diferença de Caixa: ${cash.diferenca.toFixed(2)} €`, 11, [cash.diferenca < 0 ? 200 : 0, 0, 0], 8);

  y += 5;
  addLine('Detalhamento de Espécie declarada:', 13, [0, 38, 58], 7);
  let notesStr = "Notas: ";
  (cash.inputs || []).forEach(i => {
    const val = parseFloat(i.denomination) || 0;
    const qty = parseInt(i.val) || 0;
    if (qty > 0 && [500, 200, 100, 50, 20, 10, 5].includes(val)) {
      notesStr += `${qty}x${val}€ | `;
    }
  });
  if (notesStr === "Notas: ") notesStr += "Nenhuma nota declarada.";
  else notesStr = notesStr.slice(0, -3);
  addLine(notesStr, 10, [0, 0, 0], 6);

  let coinsStr = "Moedas: ";
  (cash.inputs || []).forEach(i => {
    const val = parseFloat(i.denomination) || 0;
    const qty = parseInt(i.val) || 0;
    if (qty > 0 && [2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01].includes(val)) {
      coinsStr += `${qty}x${val}€ | `;
    }
  });
  if (coinsStr === "Moedas: ") coinsStr += "Nenhuma moeda declarada.";
  else coinsStr = coinsStr.slice(0, -3);
  addLine(coinsStr, 10, [0, 0, 0], 8);

  if (cash.vales && cash.vales.length > 0) {
    y += 2;
    addLine('Detalhamento de Vales / Vouchers:', 13, [0, 38, 58], 7);
    cash.vales.forEach(v => {
      let statusStr = v.status || 'Pendente';
      if (v.status === 'Pago') {
        statusStr = `PAGO por ${v.paidBy} em ${v.paidTime}`;
      }
      addLine(` - ${v.val}€ | Just: ${v.just} | Dept: ${v.dept} | Resp: ${v.resp} | Data: ${v.date} | Estado: ${statusStr}`, 9, [0, 0, 0], 5);
    });
  }

  if (cash.paidouts && cash.paidouts.length > 0) {
    y += 4;
    addLine('Detalhamento de Paid-outs:', 13, [0, 38, 58], 7);
    cash.paidouts.forEach(p => {
      const v = parseFloat(p.val) || 0;
      const reimbursed = parseFloat(p.reimbursed) || 0;
      const pending = parseFloat(p.pending) || 0;
      let reimbStr = p.status || 'Pendente';
      if (p.status === 'Reembolsado') {
        reimbStr = `REEMBOLSADO INTEGRALMENTE por ${p.reimbursedBy} em ${p.reimbursedTime}`;
      } else if (p.status === 'Parcial') {
        reimbStr = `REEMBOLSADO PARCIALMENTE: Recebido ${reimbursed.toFixed(2)}€, Falta Reembolsar ${pending.toFixed(2)}€ (por ${p.reimbursedBy} em ${p.reimbursedTime})`;
      }
      addLine(` - Original: ${v.toFixed(2)}€ | Just: ${p.just} | Quarto: ${p.room} | Resp: ${p.resp} | Data: ${p.date} | Estado: ${reimbStr}`, 9, [0, 0, 0], 5);
    });
  }

  y += 10;
  addLine('Assinatura do Rececionista:', 11, [20, 20, 20], 12);
  doc.setDrawColor(198, 166, 103); doc.setLineWidth(1); doc.line(10, y, 100, y); y += 6;

  const safe = sanitizeFileName(`Caixa_${map[tAtual] || tAtual}_${record.data}_${rAtual}`) || 'ComprovativoCaixa';
  doc.save(`${safe}_Arquivo.pdf`);
}

document.addEventListener('click', e => {
  const phaseBtn = e.target.closest('.phase-btn[data-target]');
  if (phaseBtn) return togglePhase(phaseBtn);
  const helpBtn = e.target.closest('.help-btn');
  if (helpBtn) return toggleHelp(helpBtn);
  if (e.target.id === 'confirmarTurnoBtn') return confirmarTurno();
  if (e.target.id === 'finalizarTurnoBtn') return finalizarTurno();
  if (e.target.id === 'resetTurnoBtn') return resetTurno();

  const tabBtn = e.target.closest('.tab-btn');
  if (tabBtn) return switchTab(tabBtn.dataset.tab);
});

document.addEventListener('change', e => {
  if (e.target.id === 'cashTurnoAtual') return; // Handled separately
  if (e.target.matches('.section-toggle-all')) return handleSectionToggle(e.target);
  if (e.target.matches('#tela2 input[type="checkbox"]')) {
    const sec = e.target.closest('.phase-content, .checklist-continua');
    if (sec) updateSectionToggle(sec);
  }
  if (typeof saveProgress === 'function') saveProgress();
});

document.addEventListener('input', e => {
  if (e.target.matches('input,textarea')) {
    updateAuditorInfo();
    if (typeof saveProgress === 'function') saveProgress();
  }
  if (e.target.matches('.cash-input')) {
    if (typeof calculateTotalCaixa === 'function') calculateTotalCaixa();
  }
  if (e.target.matches('.dyn-just')) {
    autoResizeTextArea(e.target);
  }
});

// Dynamic checklist rendering
async function loadDynamicChecklists() {
  try {
    // Use data from window.tarefasData (loaded by tarefas.js)
    // Fall back to fetch if window.tarefasData is not available
    let data = window.tarefasData;
    if (!data) {
      const res = await fetch('./tarefas.json');
      if (!res.ok) throw new Error('Failed to load tarefas.json');
      data = await res.json();
    }

    // Determine the active date to filter by day of the week
    let activeDate = new Date();
    const dateInput = document.getElementById('auditorData');
    if (dateInput && dateInput.value) {
      const parts = dateInput.value.split('-');
      if (parts.length === 3) {
        activeDate = new Date(parts[0], parts[1] - 1, parts[2]);
      }
    } else {
      try {
        const saved = localStorage.getItem('nightAuditProgress_v72');
        if (saved) {
          const d = JSON.parse(saved);
          if (d && d.auditorData) {
            const parts = d.auditorData.split('-');
            if (parts.length === 3) {
              activeDate = new Date(parts[0], parts[1] - 1, parts[2]);
            }
          }
        }
      } catch (e) {}
    }

    const dayIndex = activeDate.getDay(); // 0 is Sunday, 6 is Saturday
    const dayNamesPt = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
    const dayNamesEn = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

    const normalizeDay = (str) => {
      if (typeof str !== 'string') return '';
      return str.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace("-feira", "")
        .trim();
    };

    const matchesDay = (item, dayIdx) => {
      if (item.dias && Array.isArray(item.dias) && item.dias.length > 0) {
        const targetPt = normalizeDay(dayNamesPt[dayIdx]);
        const targetEn = normalizeDay(dayNamesEn[dayIdx]);
        return item.dias.some(d => {
          if (typeof d === 'number') {
            return d === dayIdx;
          }
          if (typeof d === 'string') {
            const normalized = normalizeDay(d);
            return normalized === targetPt || normalized === targetEn;
          }
          return false;
        });
      }
      return true;
    };

    for (const [turno, phases] of Object.entries(data)) {
      const container = document.getElementById(`checklist-${turno}`);
      if (!container) continue;

      let html = '';

      phases.forEach(phase => {
        if (phase.title) {
          html += `<button class="phase-btn" type="button" data-target="${phase.id}" aria-expanded="false">${phase.title}</button>`;
          html += `<div id="${phase.id}" class="phase-content" style="display:none;">`; // hidden by default like CSS/logic expects
          html += `<div class="section-tools"><label class="bulk-toggle"><input type="checkbox" class="section-toggle-all"> Marcar / desmarcar todos desta secção</label></div>`;
          if (phase.note) {
            html += `<p class="section-note">${phase.note}</p>`;
          }
        } else {
          html += `<div id="${phase.id}" class="checklist-continua">`;
          html += `<div class="section-tools"><label class="bulk-toggle"><input type="checkbox" class="section-toggle-all"> Marcar / desmarcar todos desta secção</label></div>`;
        }

        phase.sections.forEach(sec => {
          const hasRenderedItems = sec.items.some(item => matchesDay(item, dayIndex));
          if (!hasRenderedItems) return;

          if (sec.title) {
            if (phase.title) html += `<h3>${sec.title}</h3>`;
            else html += `<p class="section-header">${sec.title}</p>`;
          }
          html += `<ul>`;
          sec.items.forEach(item => {
            if (!matchesDay(item, dayIndex)) return;

            // Handle download links
            if (item.type === 'download') {
              html += `<li class="download-links">`;
              html += `<a href="${item.url}" download target="_blank" rel="noopener noreferrer">${item.text}</a>`;
              html += `</li>`;
              return;
            }

            const isDayRestricted = item.dias && Array.isArray(item.dias) && item.dias.length > 0;
            const isOpt = item.optional || (item.sunday && !isDayRestricted);
            const optClass = isOpt ? ' optional-item' : '';
            html += `<li class="check-item${optClass}">`;

            html += `<button class="help-btn" type="button" aria-expanded="false" aria-label="Mostrar explicação">?</button>`;
            html += `<div class="check-wrap"><label class="check-label">`;

            const attrs = [];
            if (item.optional) attrs.push('data-optional="true"');
            if (item.sunday && !isDayRestricted) attrs.push('data-sunday="true"');

            html += `<input type="checkbox" ${attrs.join(' ')}>`;
            html += `<span class="item-text">${item.text}`;

            if (item.optional) {
              html += `<div class="optional-badge">Opcional / conforme necessário</div>`;
            } else if (isDayRestricted) {
              const dayStr = item.dias.map(d => {
                if (typeof d === 'number') return dayNamesPt[d];
                return d;
              }).map(name => name.charAt(0).toUpperCase() + name.slice(1)).join(', ');
              html += `<div class="optional-badge">Somente ${dayStr}s</div>`;
            } else if (item.sunday) {
              html += `<div class="optional-badge">Somente Domingos</div>`;
            }
            if (item.help) html += `<div class="help-text">${item.help}</div>`;

            html += `</span></label></div></li>`;
          });
          html += `</ul>`;
        });

        if (phase.id === 'fase4') {
          html += `
            <div style="margin-top: 20px; padding: 15px; border: 1px solid var(--gold); border-radius: 8px; background: rgba(198,166,103,0.05);">
              <label for="proto" style="display: block; margin-bottom: 8px;"><strong>Protocolo MySana</strong></label>
              <input id="proto" type="text" placeholder="Ex.: MYS-2024-001" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 4px; background: rgba(255,255,255,0.05); color: white;">
            </div>
          `;
        }

        html += `</div>`;
      });

      container.innerHTML = html;
    }
  } catch (err) {
    console.error('Dynamic load error:', err);
  }
}

// Weather Service for Lisbon
const WeatherService = {
  defaultLocation: {
    latitude: 38.7167,
    longitude: -9.1333
  },

  weatherCodeMap(code) {
    const map = {
      0: 'Ensolarado',
      1: 'Pouco nublado',
      2: 'Parcialmente nublado',
      3: 'Nublado',
      45: 'Neblina',
      48: 'Neblina seca',
      51: 'Chuvisco leve',
      53: 'Chuvisco moderado',
      55: 'Chuvisco denso',
      56: 'Garoa congelante leve',
      57: 'Garoa congelante densa',
      61: 'Chuva fraca',
      63: 'Chuva moderada',
      65: 'Chuva forte',
      66: 'Chuva congelante leve',
      67: 'Chuva congelante forte',
      71: 'Neve fraca',
      73: 'Neve moderada',
      75: 'Neve forte',
      77: 'Granizo',
      80: 'Chuva de pancada',
      81: 'Chuva intensa de pancada',
      82: 'Chuva muito intensa de pancada',
      85: 'Neve de pancada',
      86: 'Neve intensa de pancada',
      95: 'Tempestade',
      96: 'Tempestade com granizo',
      99: 'Tempestade severa'
    };
    return map[code] || 'Tempo indefinido';
  },

  async fetchForecast() {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${this.defaultLocation.latitude}&longitude=${this.defaultLocation.longitude}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const data = await response.json();
      const daily = data.daily;
      if (!daily || !daily.weathercode || daily.weathercode.length === 0) return null;
      const index = 0;
      const description = this.weatherCodeMap(daily.weathercode[index]);
      const min = Math.round(daily.temperature_2m_min[index]);
      const max = Math.round(daily.temperature_2m_max[index]);
      return { description, min, max };
    } catch (e) {
      console.error(e);
      return null;
    }
  },

  formatForecast(forecast) {
    if (!forecast) return 'Não foi possível obter a previsão';
    return `${forecast.description} · min ${forecast.min}° · max ${forecast.max}°`;
  }
};

const HeaderController = {
  async init() {
    const weatherSummary = document.getElementById('weather-summary');
    if (weatherSummary) {
      weatherSummary.textContent = 'A carregar previsão...';
      const forecast = await WeatherService.fetchForecast();
      weatherSummary.textContent = WeatherService.formatForecast(forecast);
    }

    const clockEl = document.getElementById('current-date-time');
    if (clockEl) {
      const updateClock = () => {
        const now = new Date();
        const dateStr = now.toLocaleDateString('pt-PT', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
        const timeStr = now.toLocaleTimeString('pt-PT', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        clockEl.textContent = `${dateStr} | ${timeStr}`;
      };
      updateClock();
      setInterval(updateClock, 1000);
    }
  }
};

function updateChecklistProgressBar() {
  const turno = $('#turnoSelecionado')?.value;
  const isTela2Visible = $('#tela2')?.style.display === 'block';
  const isChecklistTab = $('.tab-btn[data-tab="tab-checklist"]')?.classList.contains('active');

  const container = document.getElementById('checklist-progress-container');
  const badge = document.getElementById('header-progress-badge');
  const percentText = document.getElementById('header-progress-percent');

  if (!turno || !isTela2Visible || !isChecklistTab) {
    if (container) container.style.display = 'none';
    if (badge) badge.style.display = 'none';
    return;
  }

  const activeWrapper = document.getElementById(`checklist-${turno}`);
  if (!activeWrapper) {
    if (container) container.style.display = 'none';
    if (badge) badge.style.display = 'none';
    return;
  }

  // Filter out optional items from calculations only for night shift (noite)
  let checkboxes = $$('input[type="checkbox"]:not(.section-toggle-all)', activeWrapper);
  if (turno === 'noite') {
    checkboxes = checkboxes.filter(cb => !isOptional(cb));
  }
  const total = checkboxes.length;
  const checked = checkboxes.filter(cb => cb.checked).length;
  const percentage = total > 0 ? Math.round((checked / total) * 100) : 0;

  if (container) {
    container.style.display = 'block';
    const progressBar = document.getElementById('checklist-progress-bar');
    if (progressBar) progressBar.style.width = `${percentage}%`;
  }

  if (badge) {
    badge.style.display = 'flex';
    if (percentText) percentText.innerText = `${percentage}%`;
  }

  const resumo = document.getElementById('turnoResumoTexto');
  if (resumo) {
    const map = { noite: 'Night Audit', manha: 'Manhã', tarde: 'Tarde', doorman: 'Doorman' };
    resumo.innerHTML = `${map[turno] || turno} <span class="resumo-progresso">(${percentage}% concluído · ${checked}/${total} tarefas)</span>`;
  }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
  HeaderController.init();
  await loadDynamicChecklists();
  if (typeof loadProgress === 'function') loadProgress();
  if (typeof renderHistoryTab === 'function') renderHistoryTab();
  updateChecklistProgressBar();
});
