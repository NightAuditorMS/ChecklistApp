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
}

function switchTab(tabId) {
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
}

function confirmarTurno(isLoading = false) {
  const turno = $('#turnoSelecionado').value;
  const nome = $('#auditorNome').value.trim();
  const data = $('#auditorData').value.trim();

  if (!isLoading && (!turno || !nome || !data)) {
    alert('Por favor, seleciona o turno, preenche o nome do rececionista e a data.');
    return;
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
  const items = getSectionCBs(sec).filter(cb => cb.offsetParent !== null);
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
      localStorage.setItem(storageKey, JSON.stringify({ cash: d.cash }));
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
}

async function finalizarTurno() {
  const turno = $('#turnoSelecionado')?.value || '';
  const proto = $('#proto')?.value?.trim();
  if (turno === 'noite' && !proto) { alert('O protocolo MySana é obrigatório.'); return; }
  clearWarnings();
  const cbs = getAllCheckboxes($('#tela2'));
  for (const cb of cbs) {
    if (!cb.checked && !isOptional(cb) && cb.offsetParent !== null) {
      const li = cb.closest('.check-item');
      li.classList.add('unchecked-warning');
      li.scrollIntoView({ behavior: 'smooth', block: 'center' });
      alert('Existem itens obrigatórios não marcados.');
      return;
    }
  }
  if (confirm('Checklist completa. Deseja finalizar o turno, gerar PDF e reiniciar?')) {
    await gerarPDF();
    try {
      const saved = localStorage.getItem(storageKey); // Requires storageKey from storage.js
      if (saved) {
        const d = JSON.parse(saved);
        if (d.cash && d.cash.meta) {
          d.cash.meta.tAtual = d.cash.meta.tProx || '';
          d.cash.meta.rAtual = d.cash.meta.rProx || '';
          d.cash.meta.tProx = '';
          d.cash.meta.rProx = '';
          d.cash.meta.recebido = '0';
        }
        d.turno = d.cash?.meta?.tAtual || '';
        d.auditorNome = d.cash?.meta?.rAtual || '';
        d.auditorData = '';
        d.obsIniciais = ''; d.proto = ''; d.obsFinais = '';
        d.checks = []; d.tela2Visible = false; d.openPhases = [];
        localStorage.setItem(storageKey, JSON.stringify(d));
      }
    } catch (e) { }
    location.reload();
  }
}

async function gerarPDF() {
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

  y += 5;
  addLine(`Fundo de Caixa Fixo: 750.00 €`, 11, [0, 0, 0], 6);
  addLine(`Montante Recebido (Sistema): ${recebido} €`, 11, [0, 0, 0], 6);
  addLine(`Total Geral (Espécie + Docs): ${totalGeral} €`, 11, [0, 0, 0], 6);
  addLine(`DEPÓSITO DO DIA: ${deposito} €`, 13, [0, 38, 58], 7);
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
  // --- INÍCIO DO BLOCO DETETIVE ---
  try {
    const pdfBase64 = doc.output('datauristring').split(',')[1];

    // O sinal de interrogação (?) previne que o código quebre se o elemento não existir na tela
    const payload = {
      dataHora: new Date().toLocaleString('pt-PT'),
      turno: turno,
      rececionista: auditor,
      totalGeralCaixa: parseFloat(document.getElementById('totalGeralCaixa')?.innerText) || 0,
      diferencaCaixa: parseFloat(document.getElementById('diferencaCaixa')?.innerText) || 0,
      obsIniciais: document.querySelector('.dyn-just')?.value || "Sem observações iniciais.",
      obsFinais: "Fecho concluído via app.",
      pdfNome: `${safe}.pdf`,
      pdfConteudoBase64: pdfBase64
    };

    // Replace this string with the actual URL containing the &sig= parameter
    const webhookUrl = "https://defaulte3dc9b5c8d2143428af283327ca360.e3.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/a90ca4cb88204727a3bf23354a19cf91/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=HE9JTgBLGHRX3RZT7qVsSzpnLojaOKhxMHVNssyz8xw";

    fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    .then(response => {
      if (response.ok) {
        alert("✅ SUCESSO! Turno finalizado e salvo no SharePoint!");
      } else {
        alert("⚠️ O SharePoint recusou os dados. Código de erro: " + response.status);
      }
    })
    .catch(error => {
      // Se houver erro de rede ou CORS, o alerta salta na tela em vez de se esconder no console!
      alert("❌ ERRO DE CONEXÃO: " + error.message);
    });

  } catch (erroGrave) {
    // Se o JavaScript quebrar ao tentar ler algum dado, ele avisa-o aqui.
    alert("❌ ERRO NO CÓDIGO DA PÁGINA: " + erroGrave.message);
  }
  // --- FIM DO BLOCO DETETIVE ---

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
          if (sec.title) {
            if (phase.title) html += `<h3>${sec.title}</h3>`;
            else html += `<p class="section-header">${sec.title}</p>`;
          }
          html += `<ul>`;
          sec.items.forEach(item => {
            // Handle download links
            if (item.type === 'download') {
              html += `<li class="download-links">`;
              html += `<a href="${item.url}" download target="_blank" rel="noopener noreferrer">${item.text}</a>`;
              html += `</li>`;
              return;
            }

            const optClass = (item.optional || item.sunday) ? ' optional-item' : '';
            html += `<li class="check-item${optClass}">`;

            html += `<button class="help-btn" type="button" aria-expanded="false" aria-label="Mostrar explicação">?</button>`;
            html += `<div class="check-wrap"><label class="check-label">`;

            const attrs = [];
            if (item.optional) attrs.push('data-optional="true"');
            if (item.sunday) attrs.push('data-sunday="true"');

            html += `<input type="checkbox" ${attrs.join(' ')}>`;
            html += `<span class="item-text">${item.text}`;

            if (item.optional && !item.sunday) html += `<div class="optional-badge">Opcional / conforme necessário</div>`;
            if (item.sunday) html += `<div class="optional-badge">Somente Domingos</div>`;
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

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
  await loadDynamicChecklists();
  if (typeof loadProgress === 'function') loadProgress();
});
