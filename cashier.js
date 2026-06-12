function addRow(tbodyId) {
  const tbody = document.getElementById(tbodyId);
  const tr = document.createElement('tr');
  
  if (tbodyId === 'bodyVales') {
    tr.innerHTML = `
      <td><input type="number" class="dyn-val cash-input" step="0.01" value="0"></td>
      <td><input type="text" class="dyn-just" placeholder="..."></td>
      <td><input type="text" class="dyn-dept" placeholder="..."></td>
      <td><input type="text" class="dyn-resp" placeholder="..."></td>
      <td><input type="date" class="dyn-date"></td>
      <td><button class="help-btn" onclick="this.closest('tr').remove(); calculateTotalCaixa();" style="border-color:#ff5757; color:#ff5757;">X</button></td>
    `;
  } else {
    tr.innerHTML = `
      <td><input type="number" class="dyn-val cash-input" step="0.01" value="0"></td>
      <td><input type="text" class="dyn-just" placeholder="..."></td>
      <td><input type="text" class="dyn-room" placeholder="..."></td>
      <td><input type="text" class="dyn-resp" placeholder="..."></td>
      <td><input type="date" class="dyn-date"></td>
      <td><button class="help-btn" onclick="this.closest('tr').remove(); calculateTotalCaixa();" style="border-color:#ff5757; color:#ff5757;">X</button></td>
    `;
  }
  
  tbody.appendChild(tr);
  calculateTotalCaixa();
}

function calculateTotalCaixa() {
  let totalNotas = 0, totalMoedas = 0, totalVales = 0, totalPaidouts = 0;

  const getTableSum = (selector, isDynamic = false) => {
    return Array.from(document.querySelectorAll(selector)).reduce((acc, input) => {
      const val = parseFloat(input.value) || 0;
      if (isDynamic) return acc + val;
      
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

  totalPaidouts = getTableSum('#bodyPaidouts .dyn-val', true);
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
  document.getElementById('depositoDiaCalculado').innerText = depositoCalculado.toFixed(2);
  
  const resDiferenca = document.getElementById('diferencaCaixa');
  resDiferenca.innerText = diferenca.toFixed(2) + '€';
  resDiferenca.style.color = diferenca < 0 ? '#ff5757' : (diferenca > 0 ? '#3d7f4f' : 'var(--gold)');

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
