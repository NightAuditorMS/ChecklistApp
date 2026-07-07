// Utility for auto-resizing textareas
function autoResizeTextArea(element) {
  if (!element) return;
  element.style.height = 'auto';
  element.style.height = element.scrollHeight + 'px';
}

function addRow(tbodyId) {
  const tbody = document.getElementById(tbodyId);
  const tr = document.createElement('tr');
  const todayStr = new Date().toISOString().split('T')[0];
  
  if (tbodyId === 'bodyVales') {
    tr.innerHTML = `
      <td>
        <input type="number" class="dyn-val cash-input" step="0.01" value="0" oninput="handleValueChange(this)">
      </td>
      <td>
        <textarea class="dyn-just" placeholder="..." rows="1" oninput="autoResizeTextArea(this); saveProgress();"></textarea>
      </td>
      <td><input type="text" class="dyn-dept" placeholder="..." oninput="saveProgress()"></td>
      <td><input type="text" class="dyn-resp" placeholder="..." oninput="saveProgress()"></td>
      <td><input type="date" class="dyn-date" value="${todayStr}" oninput="saveProgress()"></td>
      <td>
        <div style="display:flex; gap:5px; align-items:center;">
          <button class="action-btn vale-status-btn" onclick="toggleValePaidState(this)" style="border-color: var(--muted); color: var(--muted); margin:0;">Pagar</button>
          <button class="help-btn" onclick="this.closest('tr').remove(); calculateTotalCaixa(); saveProgress();" style="border-color:#ff5757; color:#ff5757; margin:0;">X</button>
        </div>
      </td>
    `;
    tr.dataset.status = 'Pendente';
  } else {
    tr.innerHTML = `
      <td>
        <input type="number" class="dyn-val cash-input" step="0.01" value="0" oninput="handleValueChange(this)">
      </td>
      <td>
        <textarea class="dyn-just" placeholder="..." rows="1" oninput="autoResizeTextArea(this); saveProgress();"></textarea>
      </td>
      <td><input type="text" class="dyn-room" placeholder="..." oninput="saveProgress()"></td>
      <td><input type="text" class="dyn-resp" placeholder="..." oninput="saveProgress()"></td>
      <td><input type="date" class="dyn-date" value="${todayStr}" oninput="saveProgress()"></td>
      <td>
        <div style="display:flex; gap:5px; align-items:center;">
          <button class="action-btn paidout-status-btn" onclick="promptPaidoutReimbursement(this)" style="border-color: var(--muted); color: var(--muted); margin:0;">Reembolsar</button>
          <button class="help-btn" onclick="this.closest('tr').remove(); calculateTotalCaixa(); saveProgress();" style="border-color:#ff5757; color:#ff5757; margin:0;">X</button>
        </div>
      </td>
    `;
    tr.dataset.status = 'Pendente';
    tr.dataset.reimbursed = '0';
    tr.dataset.pending = '0';
  }
  
  tbody.appendChild(tr);
  if (tbodyId === 'bodyVales') {
    updateValeRowUI(tr);
  } else {
    updatePaidoutRowUI(tr);
  }
  calculateTotalCaixa();
  
  // Trigger initial resize for the textarea
  setTimeout(() => {
    autoResizeTextArea(tr.querySelector('.dyn-just'));
  }, 10);
}

function handleValueChange(input) {
  const tr = input.closest('tr');
  if (!tr) return;
  const val = parseFloat(input.value) || 0;
  
  if (tr.querySelector('.paidout-status-btn')) {
    // Paid-out row
    let reimbursed = parseFloat(tr.dataset.reimbursed) || 0;
    if (reimbursed > val) {
      reimbursed = val;
      tr.dataset.reimbursed = reimbursed;
    }
    const pending = val - reimbursed;
    tr.dataset.pending = pending;
    
    if (val > 0 && pending === 0) {
      tr.dataset.status = 'Reembolsado';
    } else if (reimbursed > 0) {
      tr.dataset.status = 'Parcial';
    } else {
      tr.dataset.status = 'Pendente';
    }
    updatePaidoutRowUI(tr);
  } else {
    // Vale row
    updateValeRowUI(tr);
  }
  
  calculateTotalCaixa();
  saveProgress();
}

function updateValeRowUI(tr) {
  const val = parseFloat(tr.querySelector('.dyn-val').value) || 0;
  const status = tr.dataset.status || 'Pendente';
  
  let detailsEl = tr.querySelector('.vale-details');
  if (!detailsEl) {
    const cell = tr.querySelector('td'); // first cell (Valor)
    detailsEl = document.createElement('div');
    detailsEl.className = 'vale-details';
    detailsEl.style.fontSize = '11px';
    detailsEl.style.marginTop = '4px';
    cell.appendChild(detailsEl);
  }
  
  const statusBtn = tr.querySelector('.vale-status-btn');
  
  if (status === 'Pago') {
    const paidBy = tr.dataset.paidBy || '';
    const paidTime = tr.dataset.paidTime || '';
    detailsEl.innerHTML = `<span style="color:var(--success); font-weight:bold;">Pago</span><br><span style="font-size:9.5px; color:var(--muted);">${paidBy} (${paidTime.split(' ')[0]})</span>`;
    if (statusBtn) {
      statusBtn.innerText = 'Pago';
      statusBtn.style.borderColor = 'var(--success)';
      statusBtn.style.color = 'var(--success)';
      statusBtn.classList.add('active');
    }
  } else {
    detailsEl.innerHTML = `Pendente: ${val.toFixed(2)}€`;
    if (statusBtn) {
      statusBtn.innerText = 'Pagar';
      statusBtn.style.borderColor = 'var(--muted)';
      statusBtn.style.color = 'var(--muted)';
      statusBtn.classList.remove('active');
    }
  }
}

function updatePaidoutRowUI(tr) {
  const val = parseFloat(tr.querySelector('.dyn-val').value) || 0;
  const status = tr.dataset.status || 'Pendente';
  const reimbursed = parseFloat(tr.dataset.reimbursed) || 0;
  const pending = parseFloat(tr.dataset.pending) || 0;
  
  let detailsEl = tr.querySelector('.reimbursed-details');
  if (!detailsEl) {
    const cell = tr.querySelector('td'); // first cell (Valor)
    detailsEl = document.createElement('div');
    detailsEl.className = 'reimbursed-details';
    detailsEl.style.fontSize = '11px';
    detailsEl.style.marginTop = '4px';
    cell.appendChild(detailsEl);
  }
  
  const statusBtn = tr.querySelector('.paidout-status-btn');
  const actionBy = tr.dataset.reimbursedBy || '';
  const actionTime = tr.dataset.reimbursedTime || '';
  
  if (status === 'Reembolsado') {
    detailsEl.innerHTML = `<span style="color:var(--success); font-weight:bold;">Reembolsado</span><br><span style="font-size:9.5px; color:var(--muted);">${actionBy} (${actionTime.split(' ')[0]})</span>`;
    if (statusBtn) {
      statusBtn.innerText = 'Reembolsado';
      statusBtn.style.borderColor = 'var(--success)';
      statusBtn.style.color = 'var(--success)';
      statusBtn.classList.add('active');
    }
  } else if (status === 'Parcial') {
    detailsEl.innerHTML = `<span style="color:var(--gold); font-weight:bold;">Pendente: ${pending.toFixed(2)}€</span><br><span style="color:var(--muted); font-size:10px;">(Reemb: ${reimbursed.toFixed(2)}€ por ${actionBy})</span>`;
    if (statusBtn) {
      statusBtn.innerText = 'Parcial';
      statusBtn.style.borderColor = 'var(--gold)';
      statusBtn.style.color = 'var(--gold)';
      statusBtn.classList.add('active');
    }
  } else {
    detailsEl.innerHTML = `Pendente: ${val.toFixed(2)}€`;
    if (statusBtn) {
      statusBtn.innerText = 'Reembolsar';
      statusBtn.style.borderColor = 'var(--muted)';
      statusBtn.style.color = 'var(--muted)';
      statusBtn.classList.remove('active');
    }
  }
}

// Reimbursement Modal state logic
let activePaidoutTrForReimbursement = null;

function promptPaidoutReimbursement(btn) {
  const tr = btn.closest('tr');
  if (!tr) return;
  
  const val = parseFloat(tr.querySelector('.dyn-val').value) || 0;
  if (val <= 0) {
    alert('Por favor, introduza um valor maior que 0 primeiro.');
    return;
  }
  
  activePaidoutTrForReimbursement = tr;
  document.getElementById('reimbursementModal').style.display = 'flex';
  showModalStep1();
}

function closeReimbursementModal() {
  document.getElementById('reimbursementModal').style.display = 'none';
  activePaidoutTrForReimbursement = null;
}

function showModalStep1() {
  document.getElementById('modalStep1').style.display = 'flex';
  document.getElementById('modalStep2').style.display = 'none';
  document.getElementById('reimburseAmountInput').value = '';
}

function handleReimburseOption(option) {
  if (!activePaidoutTrForReimbursement) return;
  const tr = activePaidoutTrForReimbursement;
  const val = parseFloat(tr.querySelector('.dyn-val').value) || 0;
  const currentUser = document.getElementById('cashRececionistaAtual')?.value?.trim() || document.getElementById('auditorNome')?.value?.trim() || 'Rececionista';
  const now = new Date().toLocaleString('pt-PT');
  
  if (option === 'fully') {
    tr.dataset.status = 'Reembolsado';
    tr.dataset.reimbursed = val;
    tr.dataset.pending = '0';
    tr.dataset.reimbursedBy = currentUser;
    tr.dataset.reimbursedTime = now;
    
    updatePaidoutRowUI(tr);
    calculateTotalCaixa();
    saveProgress();
    closeReimbursementModal();
  } else if (option === 'partially') {
    document.getElementById('modalStep1').style.display = 'none';
    document.getElementById('modalStep2').style.display = 'block';
    
    const currentPending = parseFloat(tr.dataset.pending) !== undefined && parseFloat(tr.dataset.pending) > 0 
      ? parseFloat(tr.dataset.pending) 
      : val;
    document.getElementById('reimburseAmountInput').value = currentPending;
  }
}

function confirmPartialReimbursement() {
  if (!activePaidoutTrForReimbursement) return;
  const tr = activePaidoutTrForReimbursement;
  const val = parseFloat(tr.querySelector('.dyn-val').value) || 0;
  const inputVal = parseFloat(document.getElementById('reimburseAmountInput').value) || 0;
  const currentUser = document.getElementById('cashRececionistaAtual')?.value?.trim() || document.getElementById('auditorNome')?.value?.trim() || 'Rececionista';
  const now = new Date().toLocaleString('pt-PT');
  
  if (inputVal <= 0) {
    alert('Por favor, introduza um valor válido maior que 0.');
    return;
  }
  
  if (inputVal > val) {
    alert(`O valor reembolsado não pode ser maior do que o valor do paid-out (${val.toFixed(2)}€).`);
    return;
  }
  
  const pending = val - inputVal;
  tr.dataset.reimbursed = inputVal;
  tr.dataset.pending = pending;
  tr.dataset.reimbursedBy = currentUser;
  tr.dataset.reimbursedTime = now;
  
  if (pending === 0) {
    tr.dataset.status = 'Reembolsado';
  } else {
    tr.dataset.status = 'Parcial';
  }
  
  updatePaidoutRowUI(tr);
  calculateTotalCaixa();
  saveProgress();
  closeReimbursementModal();
}

function toggleValePaidState(btn) {
  const tr = btn.closest('tr');
  if (!tr) return;
  
  const val = parseFloat(tr.querySelector('.dyn-val').value) || 0;
  if (val <= 0) {
    alert('Por favor, introduza um valor maior que 0 primeiro.');
    return;
  }
  
  const currentStatus = tr.dataset.status || 'Pendente';
  const currentUser = document.getElementById('cashRececionistaAtual')?.value?.trim() || document.getElementById('auditorNome')?.value?.trim() || 'Rececionista';
  const now = new Date().toLocaleString('pt-PT');
  
  if (currentStatus === 'Pago') {
    tr.dataset.status = 'Pendente';
    delete tr.dataset.paidBy;
    delete tr.dataset.paidTime;
  } else {
    tr.dataset.status = 'Pago';
    tr.dataset.paidBy = currentUser;
    tr.dataset.paidTime = now;
  }
  
  updateValeRowUI(tr);
  calculateTotalCaixa();
  saveProgress();
}

function calculateTotalCaixa() {
  let totalNotas = 0, totalMoedas = 0, totalVales = 0, totalPaidouts = 0;

  const getTableSum = (selector, isDynamic = false, isPaidout = false) => {
    return Array.from(document.querySelectorAll(selector)).reduce((acc, input) => {
      const val = parseFloat(input.value) || 0;
      if (isDynamic) {
        if (isPaidout) {
          const tr = input.closest('tr');
          const pending = tr && tr.dataset.pending !== undefined ? parseFloat(tr.dataset.pending) : val;
          return acc + pending;
        }
        return acc + val;
      }
      
      const mult = parseFloat(input.dataset.value) || 0;
      const sub = val * mult;
      const rowDisplay = input.closest('tr')?.querySelector('.row-total');
      if (rowDisplay) rowDisplay.innerText = sub.toFixed(2) + '€';
      return acc + sub;
    }, 0);
  };

  totalNotas = getTableSum('#tableNotas tbody .cash-input');
  totalMoedas = getTableSum('#tableMoedas tbody .cash-input');
  totalVales = getTableSum('#bodyVales .dyn-val', true);
  
  document.getElementById('totalNotasSum').innerText = totalNotas.toFixed(2) + '€';
  document.getElementById('totalMoedasSum').innerText = totalMoedas.toFixed(2) + '€';
  document.getElementById('totalValesSum').innerText = totalVales.toFixed(2) + '€';

  totalPaidouts = getTableSum('#bodyPaidouts .dyn-val', true, true);
  document.getElementById('totalPaidoutsSum').innerText = totalPaidouts.toFixed(2) + '€';

  const totalDocs = totalVales + totalPaidouts;
  document.getElementById('totalDocsSum').innerText = totalDocs.toFixed(2) + '€';

  const totalEspecie = totalNotas + totalMoedas;
  const totalGeral = totalEspecie + totalDocs;
  const fundoCaixa = 750.00;
  const montanteRecebido = parseFloat(document.getElementById('montanteRecebidoDia').value) || 0;

  const depositoCalculado = totalGeral - fundoCaixa;
  const diferenca = depositoCalculado - montanteRecebido;

  document.getElementById('totalGeralCaixa').innerText = totalGeral.toFixed(2);
  
  const elDeposito = document.getElementById('depositoDiaCalculado');
  const elDepositoEuro = document.getElementById('depositoDiaEuro');
  if (depositoCalculado < 0) {
    elDeposito.innerText = '-';
    elDeposito.style.color = 'var(--gold)';
    if (elDepositoEuro) elDepositoEuro.style.display = 'none';
  } else {
    elDeposito.innerText = depositoCalculado.toFixed(2);
    if (elDepositoEuro) elDepositoEuro.style.display = 'inline';
    const condicaoVerde = (totalEspecie - totalPaidouts + montanteRecebido) > 750.00;
    if (condicaoVerde) {
      elDeposito.style.color = '#3d7f4f'; // green
    } else {
      elDeposito.style.color = 'var(--gold)';
    }
  }
  
  const resDiferenca = document.getElementById('diferencaCaixa');
  if (diferenca < -0.005) {
    resDiferenca.innerText = diferenca.toFixed(2) + '€';
    resDiferenca.style.color = '#ff5757';
  } else {
    resDiferenca.innerText = '-';
    resDiferenca.style.color = 'var(--gold)';
  }

  const statusMsg = document.getElementById('statusCaixaMsg');
  if (Math.abs(diferenca) < 0.01 && depositoCalculado > 0) {
    statusMsg.innerText = "Tudo certo!";
    statusMsg.style.color = "#3d7f4f";
  } else if (diferenca < -0.01) {
    statusMsg.innerText = "Inconsistência na contagem";
    statusMsg.style.color = "#ff5757";
  } else {
    statusMsg.innerText = "";
  }

  document.getElementById('totalCaixaCalculado').innerText = totalGeral.toFixed(2);
}
