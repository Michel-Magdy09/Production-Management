// ✅ **STEP 1: Load the 'timeline' package instead of 'gantt'**
google.charts.load("current", { packages: ["timeline"] });
google.charts.setOnLoadCallback(initialize);

// Global variables
let fasi = [];
let schede = {};
let currentEditIdentifier = null;

function initialize() {
  fasi = JSON.parse(localStorage.getItem("fasi")) || [];
  schede = JSON.parse(localStorage.getItem("schede")) || {};
  aggiornaListaPezzi();
  aggiornaTabella();
  // Call the new timeline function
  disegnaTimeline();
}

// --- Data Saving Functions (No changes needed here) ---
function salvaScheda() {
  const id = document.getElementById("idScheda").value.trim();
  const materiale = document.getElementById("materiale").value.trim();
  const quantita = document.getElementById("quantita").value;
  const consegna = document.getElementById("consegnaRichiesta").value;
  if (!id || !materiale || !quantita || !consegna) {
    alert("Compila tutti i campi della scheda pezzo!");
    return;
  }
  schede[id] = { materiale, quantita: parseInt(quantita), consegna };
  localStorage.setItem("schede", JSON.stringify(schede));
  aggiornaListaPezzi();
  alert("Pezzo salvato con successo!");
  document.getElementById("idScheda").value = "";
  document.getElementById("materiale").value = "";
  document.getElementById("quantita").value = "";
}

function salvaFase() {
  const id = document.getElementById("idPezzo").value;
  const descr = document.getElementById("descrizione").value.trim();
  const inizioStr = document.getElementById("inizio").value;
  const ore = parseInt(document.getElementById("oreNecessarie").value);
  const risorsa = document.getElementById("risorsa").value;
  const weekend = document.getElementById("weekend").checked;
  const oreTurno = parseInt(document.getElementById("turni").value);

  if (!id || !descr || !inizioStr || !ore || !risorsa) {
    alert("Compila tutti i campi della fase!");
    return;
  }

  fasi.sort((a, b) => new Date(a.inizio) - new Date(b.inizio));
  const fineUltimaFase = trovaFineUltimaFasePerRisorsa(risorsa);
  let inizio = new Date(inizioStr);

  if (fineUltimaFase && inizio < fineUltimaFase) {
    const dataFormattata = fineUltimaFase.toLocaleString('it-IT');
    alert(`La risorsa '${risorsa}' è occupata. La fase verrà accodata e inizierà alle ${dataFormattata}.`);
    inizio = fineUltimaFase;
  }
  
  const fine = calcolaFineLavorazione(inizio, ore, weekend, oreTurno);

  fasi.push({
    id, descr, inizio: inizio.toISOString(), fine: fine.toISOString(),
    ore, risorsa, weekend, oreTurno, status: "Not Started"
  });

  localStorage.setItem("fasi", JSON.stringify(fasi));
  aggiornaTabella();
  disegnaTimeline();
}

function trovaFineUltimaFasePerRisorsa(risorsa) {
  const fasiPerRisorsa = fasi.filter(f => f.risorsa === risorsa);
  if (fasiPerRisorsa.length === 0) return null;
  const fineMassima = new Date(Math.max.apply(null, fasiPerRisorsa.map(f => new Date(f.fine))));
  return fineMassima;
}

// --- UI Update Functions (No changes needed here) ---
function aggiornaListaPezzi() {
  const select = document.getElementById("idPezzo");
  select.innerHTML = "";
  if (Object.keys(schede).length === 0) {
    const opt = document.createElement("option");
    opt.textContent = "Nessun pezzo inserito";
    opt.disabled = true;
    select.appendChild(opt);
  } else {
    Object.keys(schede).forEach(id => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = id;
      select.appendChild(opt);
    });
  }
}

function aggiornaTabella() {
  fasi.sort((a, b) => new Date(a.inizio) - new Date(b.inizio));
  const tbody = document.querySelector("#tabellaFasi tbody");
  tbody.innerHTML = "";
  fasi.forEach((fase, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fase.id}</td>
      <td>${fase.descr}</td>
      <td>${fase.status}</td>
      <td>${new Date(fase.inizio).toLocaleString('it-IT')}</td>
      <td>${new Date(fase.fine).toLocaleString('it-IT')}</td>
      <td>${fase.ore}</td>
      <td>${fase.risorsa}</td>
      <td>${fase.oreTurno}h</td>
      <td>${fase.weekend ? "✅" : "❌"}</td>
      <td>
        <button onclick="apriModalModifica(${i})">✏️</button>
        <button onclick="eliminaFase(${i})">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// --- Core Logic Functions (No changes needed here) ---
function calcolaFineLavorazione(inizio, oreTotali, lavoraWeekend, oreTurno) {
    let fine = new Date(inizio);
    let oreRimanenti = oreTotali;
    const INIZIO_TURNO = 8;
    while (oreRimanenti > 0) {
        let giorno = fine.getDay();
        let isWeekend = (giorno === 0 || giorno === 6);
        if (isWeekend && !lavoraWeekend) {
            fine.setDate(fine.getDate() + 1);
            fine.setHours(INIZIO_TURNO, 0, 0, 0);
            continue;
        }
        let startHour = fine.getHours();
        if (startHour < INIZIO_TURNO) startHour = INIZIO_TURNO;
        let oreLavorabiliOggi = (INIZIO_TURNO + oreTurno) - startHour;
        if(oreTurno === 24) oreLavorabiliOggi = 24 - startHour;
        if (oreLavorabiliOggi <= 0) {
            fine.setDate(fine.getDate() + 1);
            fine.setHours(INIZIO_TURNO, 0, 0, 0);
            continue;
        }
        const oreDaLavorareOggi = Math.min(oreRimanenti, oreLavorabiliOggi);
        fine.setHours(fine.getHours() + oreDaLavorareOggi);
        oreRimanenti -= oreDaLavorareOggi;
        if (oreRimanenti > 0) {
            fine.setDate(fine.getDate() + 1);
            fine.setHours(INIZIO_TURNO, 0, 0, 0);
        }
    }
    return fine;
}

function eliminaFase(index) {
  const sortedFasi = [...fasi].sort((a, b) => new Date(a.inizio) - new Date(b.inizio));
  const itemToDelete = sortedFasi[index];
  if (confirm(`Sei sicuro di voler eliminare la fase "${itemToDelete.descr}"?`)) {
    fasi = fasi.filter(f => f.inizio !== itemToDelete.inizio || f.descr !== itemToDelete.descr);
    localStorage.setItem("fasi", JSON.stringify(fasi));
    aggiornaTabella();
    disegnaTimeline();
  }
}

function esportaExcel() {
  const wsData = [["ID Pezzo", "Descrizione", "Stato", "Inizio", "Fine", "Ore", "Risorsa", "Turni (h)", "Lavora Weekend"]];
  fasi.forEach(f => {
    wsData.push([
      f.id, f.descr, f.status, new Date(f.inizio).toLocaleString('it-IT'),
      new Date(f.fine).toLocaleString('it-IT'), f.ore, f.risorsa, f.oreTurno, f.weekend ? "Sì" : "No"
    ]);
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Fasi Produzione");
  XLSX.writeFile(wb, "produzione.xlsx");
}

// --- Charting Functions ---

/**
 * ✅ FINAL WORKING SOLUTION: This function uses a TIMELINE chart.
 * It natively supports a 'style' role for coloring individual bars.
 */
function disegnaTimeline() {
  const filtro = document.getElementById("filtroRisorsa").value;
  // Note: The container ID is still "ganttChart" from the HTML, which is fine.
  const container = document.getElementById("ganttChart");
  container.innerHTML = ''; // Clear previous contents

  const filteredFasi = fasi.filter(f => !filtro || f.risorsa === filtro);

  if (filteredFasi.length === 0) {
    container.innerHTML = "Nessuna fase da visualizzare.";
    return;
  }
  
  const dataTable = new google.visualization.DataTable();
  // STEP 2: Define the columns for a Timeline chart.
  // The first column is the "Row Label" (our machine/resource).
  // The second is the "Bar Label" (our phase description).
  // The third is the special 'style' role for color.
  // Then Start and End dates.
  dataTable.addColumn({ type: 'string', id: 'Resource' });
  dataTable.addColumn({ type: 'string', id: 'Phase' });
  dataTable.addColumn({ type: 'string', role: 'style' });
  dataTable.addColumn({ type: 'date', id: 'Start' });
  dataTable.addColumn({ type: 'date', id: 'End' });

  // STEP 3: Add the data, including the color from our helper function.
  filteredFasi.forEach(fase => {
    dataTable.addRow([
      fase.risorsa,
      fase.descr,
      getStatusColor(fase.status),
      new Date(fase.inizio),
      new Date(fase.fine)
    ]);
  });

  const options = {
    height: Math.max(200, 40 * dataTable.getNumberOfRows() + 50),
    timeline: {
        // This ensures each bar is colored individually
        colorByRowLabel: false
    }
  };

  // STEP 4: Create and draw a TIMELINE chart.
  const chart = new google.visualization.Timeline(container);
  chart.draw(dataTable, options);
}

function getStatusColor(status) {
  if (!status) return '#9E9E9E'; // Gray
  switch (status.toLowerCase()) {
    case 'completed': return '#4CAF50'; // Green
    case 'in progress': return '#FFC107'; // Orange
    case 'stopped': return '#F44336'; // Red
    case 'not started': default: return '#9E9E9E'; // Gray
  }
}

// --- Modal Functions (No changes needed here) ---
function apriModalModifica(index) {
  const sortedFasi = [...fasi].sort((a, b) => new Date(a.inizio) - new Date(b.inizio));
  const itemToEdit = sortedFasi[index];
  if (!itemToEdit) return;
  currentEditIdentifier = itemToEdit.inizio; 
  document.getElementById("editStatus").value = itemToEdit.status;
  document.getElementById("editOre").value = itemToEdit.ore;
  document.getElementById("editModal").style.display = "block";
}

function chiudiModal() {
  document.getElementById("editModal").style.display = "none";
  currentEditIdentifier = null;
}

function salvaModificheFase() {
  if (!currentEditIdentifier) return;
  const faseModificata = fasi.find(f => f.inizio === currentEditIdentifier);
  if (!faseModificata) return;
  
  const nuoveOre = parseInt(document.getElementById("editOre").value);
  const nuovoStatus = document.getElementById("editStatus").value;
  
  const durationChanged = faseModificata.ore !== nuoveOre;
  faseModificata.status = nuovoStatus;

  if (durationChanged) {
    faseModificata.ore = nuoveOre;
    const inizioTask = new Date(faseModificata.inizio);
    faseModificata.fine = calcolaFineLavorazione(inizioTask, nuoveOre, faseModificata.weekend, faseModificata.oreTurno).toISOString();
    fasi.sort((a, b) => new Date(a.inizio) - new Date(b.inizio));
    for (let i = 0; i < fasi.length; i++) {
        const faseCorrente = fasi[i];
        let finePrecedente = null;
        for (let j = 0; j < i; j++) {
            if (fasi[j].risorsa === faseCorrente.risorsa) {
                const finePotenziale = new Date(fasi[j].fine);
                if (!finePrecedente || finePotenziale > finePrecedente) {
                    finePrecedente = finePotenziale;
                }
            }
        }
        if (finePrecedente && new Date(faseCorrente.inizio) < finePrecedente) {
            faseCorrente.inizio = finePrecedente.toISOString();
            faseCorrente.fine = calcolaFineLavorazione(finePrecedente, faseCorrente.ore, faseCorrente.weekend, faseCorrente.oreTurno).toISOString();
        }
    }
  }

  localStorage.setItem("fasi", JSON.stringify(fasi));
  aggiornaTabella();
  disegnaTimeline();
  chiudiModal();
}

window.onclick = function(event) {
  const modal = document.getElementById("editModal");
  if (event.target == modal) {
    chiudiModal();
  }
}