const storageKey = 'nightAuditProgress_v72';

function saveProgress() {
  const currentShift = document.querySelector('#cashTurnoAtual')?.value || '';
  
  const cashData = {
    inputs: Array.from(document.querySelectorAll('.cash-input:not(.dyn-val)')).map(i => ({val: i.value})),
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
      tAtual: currentShift, 
      rAtual: document.querySelector('#cashRececionistaAtual')?.value || '',
      tProx: document.querySelector('#cashTurnoProximo')?.value || '', 
      rProx: document.querySelector('#cashRececionistaProximo')?.value || '',
      recebido: document.querySelector('#montanteRecebidoDia')?.value || '0'
    }
  };
  
  const turnoSelecionado = document.querySelector('#turnoSelecionado');
  const auditorNome = document.querySelector('#auditorNome');
  const auditorData = document.querySelector('#auditorData');
  const obsIniciais = document.querySelector('#obsIniciais');
  const proto = document.querySelector('#proto');
  const obsFinais = document.querySelector('#obsFinais');
  const tela2 = document.querySelector('#tela2');
  
  let existingShiftsCash = {};
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      existingShiftsCash = parsed.shiftsCash || {};
    }
  } catch (e) {}

  if (currentShift) {
    existingShiftsCash[currentShift] = cashData;
  }

  const d = {
    turno: turnoSelecionado ? turnoSelecionado.value : '',
    auditorNome: auditorNome ? auditorNome.value : '',
    auditorData: auditorData ? auditorData.value : '',
    obsIniciais: obsIniciais ? obsIniciais.value : '',
    proto: proto ? proto.value : '',
    obsFinais: obsFinais ? obsFinais.value : '',
    tela2Visible: tela2 ? tela2.style.display === 'block' : false,
    checks: typeof getAllCheckboxes === 'function' ? getAllCheckboxes().map(cb => cb.checked) : [],
    openPhases: Array.from(document.querySelectorAll('.phase-content'))
                     .filter(el => el.style.display === 'block')
                     .map(el => el.id),
    cash: cashData,
    shiftsCash: existingShiftsCash
  };
  
  try { 
    localStorage.setItem(storageKey, JSON.stringify(d)); 
  } catch(e) {}
  
  if (typeof updateChecklistProgressBar === 'function') {
    updateChecklistProgressBar();
  }
}

function saveProgressForShift(shift) {
  if (!shift) return;
  
  const cashData = {
    inputs: Array.from(document.querySelectorAll('.cash-input:not(.dyn-val)')).map(i => ({val: i.value})),
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
      tAtual: shift, 
      rAtual: document.querySelector('#cashRececionistaAtual')?.value || '',
      tProx: document.querySelector('#cashTurnoProximo')?.value || '', 
      rProx: document.querySelector('#cashRececionistaProximo')?.value || '',
      recebido: document.querySelector('#montanteRecebidoDia')?.value || '0'
    }
  };

  try {
    const saved = localStorage.getItem(storageKey);
    let d = saved ? JSON.parse(saved) : {};
    if (!d.shiftsCash) d.shiftsCash = {};
    d.shiftsCash[shift] = cashData;
    const cashTurno = document.getElementById('cashTurnoAtual');
    if (cashTurno && cashTurno.value === shift) {
      d.cash = cashData;
    }
    localStorage.setItem(storageKey, JSON.stringify(d));
  } catch(e) {}
}

function loadShiftCashDataApp(d, shift) {
  if (!d.shiftsCash) d.shiftsCash = {};
  
  if (!d.shiftsCash[shift]) {
    if (d.cash && d.cash.meta && d.cash.meta.tAtual === shift) {
      d.shiftsCash[shift] = JSON.parse(JSON.stringify(d.cash));
    } else {
      d.shiftsCash[shift] = {
        inputs: Array(15).fill(null).map(() => ({val: '0'})),
        vales: [],
        paidouts: [],
        meta: {
          tAtual: shift,
          rAtual: '',
          tProx: '',
          rProx: '',
          recebido: '0'
        }
      };
    }
  }
  
  const cash = d.shiftsCash[shift];
  
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  };
  
  setVal('cashTurnoAtual', shift);
  setVal('cashRececionistaAtual', cash.meta.rAtual);
  setVal('cashTurnoProximo', cash.meta.tProx);
  setVal('cashRececionistaProximo', cash.meta.rProx);
  setVal('montanteRecebidoDia', cash.meta.recebido || '0');
  
  const inputs = document.querySelectorAll('.cash-input:not(.dyn-val)');
  inputs.forEach((input, i) => {
    input.value = (cash.inputs && cash.inputs[i] && cash.inputs[i].val != null) ? cash.inputs[i].val : '0';
  });
  
  const bodyVales = document.getElementById('bodyVales');
  if (bodyVales) bodyVales.innerHTML = '';
  const bodyPaidouts = document.getElementById('bodyPaidouts');
  if (bodyPaidouts) bodyPaidouts.innerHTML = '';
  
  if (typeof addRow === 'function') {
    (cash.vales || []).forEach(v => {
      addRow('bodyVales');
      const lastRow = document.querySelector('#bodyVales tr:last-child');
      if (lastRow) {
        lastRow.querySelector('.dyn-val').value = v.val;
        lastRow.querySelector('.dyn-just').value = v.just || '';
        lastRow.querySelector('.dyn-dept').value = v.dept || '';
        lastRow.querySelector('.dyn-resp').value = v.resp || '';
        lastRow.querySelector('.dyn-date').value = v.date || '';
        lastRow.dataset.status = v.status || 'Pendente';
        lastRow.dataset.paidBy = v.paidBy || '';
        lastRow.dataset.paidTime = v.paidTime || '';
        updateValeRowUI(lastRow);
        autoResizeTextArea(lastRow.querySelector('.dyn-just'));
      }
    });
    
    (cash.paidouts || []).forEach(p => {
      addRow('bodyPaidouts');
      const lastRow = document.querySelector('#bodyPaidouts tr:last-child');
      if (lastRow) {
        lastRow.querySelector('.dyn-val').value = p.val;
        lastRow.querySelector('.dyn-just').value = p.just || '';
        lastRow.querySelector('.dyn-room').value = p.room || '';
        lastRow.querySelector('.dyn-resp').value = p.resp || '';
        lastRow.querySelector('.dyn-date').value = p.date || '';
        lastRow.dataset.status = p.status || 'Pendente';
        lastRow.dataset.reimbursed = p.reimbursed || '0';
        lastRow.dataset.pending = p.pending || '0';
        lastRow.dataset.reimbursedBy = p.reimbursedBy || '';
        lastRow.dataset.reimbursedTime = p.reimbursedTime || '';
        updatePaidoutRowUI(lastRow);
        autoResizeTextArea(lastRow.querySelector('.dyn-just'));
      }
    });
  }
  
  if (typeof calculateTotalCaixa === 'function') {
    calculateTotalCaixa();
  }
}

function loadProgress() {
  try {
    const saved = localStorage.getItem(storageKey);
    if(!saved) return;
    const d = JSON.parse(saved);
    
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };

    setVal('turnoSelecionado', d.turno);
    setVal('auditorNome', d.auditorNome);
    setVal('auditorData', d.auditorData);
    setVal('obsIniciais', d.obsIniciais);
    setVal('proto', d.proto);
    setVal('obsFinais', d.obsFinais);
    
    if (typeof getAllCheckboxes === 'function') {
      const cbs = getAllCheckboxes();
      (d.checks || []).forEach((v, i) => { if(cbs[i]) cbs[i].checked = v; });
    }
    
    if(d.tela2Visible && typeof confirmarTurno === 'function') confirmarTurno(true);
    
    (d.openPhases || []).forEach(id => {
      const el = document.getElementById(id);
      const btn = document.querySelector(`.phase-btn[data-target="${id}"]`);
      if(el) el.style.display = 'block';
      if(btn) btn.setAttribute('aria-expanded', 'true');
    });
    
    let shiftToLoad = (d.cash && d.cash.meta && d.cash.meta.tAtual) ? d.cash.meta.tAtual : (d.turno || '');
    loadShiftCashDataApp(d, shiftToLoad);
    const cashTurno = document.getElementById('cashTurnoAtual');
    if (cashTurno) {
      cashTurno.dataset.currentLoadedShift = shiftToLoad;
    }
  } catch(e) {}
  
  if (typeof updateAuditorInfo === 'function') updateAuditorInfo();
  if (typeof updateAllSectionToggles === 'function') updateAllSectionToggles();
  const tSel = document.getElementById('turnoSelecionado');
  if (typeof aplicarExclusivos === 'function') aplicarExclusivos(tSel ? tSel.value : '');
  
  if (typeof updateChecklistProgressBar === 'function') {
    updateChecklistProgressBar();
  }
}

// Bind custom event listener to cashTurnoAtual
document.addEventListener('DOMContentLoaded', () => {
  const cashTurno = document.getElementById('cashTurnoAtual');
  if (cashTurno) {
    cashTurno.addEventListener('change', (e) => {
      const newShift = e.target.value;
      if (!newShift) return;
      
      const currentLoadedShift = cashTurno.dataset.currentLoadedShift || '';
      if (currentLoadedShift && currentLoadedShift !== newShift) {
        saveProgressForShift(currentLoadedShift);
      }
      
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const d = JSON.parse(saved);
          loadShiftCashDataApp(d, newShift);
        }
      } catch (err) {}
      
      cashTurno.dataset.currentLoadedShift = newShift;
    });
  }
});
