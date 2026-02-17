import { PdfDocumentReader } from '../reader/pdf/PdfDocumentReader.js';
import { DocumentComparer } from '../domain/services/DocumentComparer.js';

class PdfComparatorApp {
  constructor() {
    this.fileA_data = null;
    this.fileB_data = null;
    this.report = null;
    this.currentFilter = 'all';
    
    this.initElements();
    this.attachEventListeners();
  }

  initElements() {
    // Upload
    this.dropA = document.getElementById('dropA');
    this.dropB = document.getElementById('dropB');
    this.fileA = document.getElementById('fileA');
    this.fileB = document.getElementById('fileB');
    this.nameA = document.getElementById('nameA');
    this.nameB = document.getElementById('nameB');
    this.btnCompare = document.getElementById('btnCompare');
    this.btnText = document.getElementById('btnText');
    this.btnLoading = document.getElementById('btnLoading');
    
    // Sections
    this.uploadSection = document.getElementById('uploadSection');
    this.results = document.getElementById('results');
    this.error = document.getElementById('error');
    
    // Results
    this.summary = document.getElementById('summary');
    this.list = document.getElementById('list');
    this.badgeAll = document.getElementById('badgeAll');
    this.badgeChanged = document.getElementById('badgeChanged');
    this.badgeAdded = document.getElementById('badgeAdded');
    this.badgeRemoved = document.getElementById('badgeRemoved');
    
    // Buttons
    this.btnHTML = document.getElementById('btnHTML');
    this.btnJSON = document.getElementById('btnJSON');
    this.btnReset = document.getElementById('btnReset');
    this.btnDismiss = document.getElementById('btnDismiss');
    this.errorMsg = document.getElementById('errorMsg');
  }

  attachEventListeners() {
    // Drop zones
    this.setupDropZone(this.dropA, this.fileA, (file) => {
      this.fileA_data = file;
      this.nameA.textContent = file.name;
      this.dropA.classList.add('has-file');
      this.checkReady();
    });

    this.setupDropZone(this.dropB, this.fileB, (file) => {
      this.fileB_data = file;
      this.nameB.textContent = file.name;
      this.dropB.classList.add('has-file');
      this.checkReady();
    });

    // Buttons
    this.btnCompare.addEventListener('click', () => this.compare());
    document.querySelectorAll('.filter').forEach(btn => {
      btn.addEventListener('click', (e) => this.filter(e.currentTarget.dataset.filter));
    });
    this.btnHTML.addEventListener('click', () => this.exportHTML());
    this.btnJSON.addEventListener('click', () => this.exportJSON());
    this.btnReset.addEventListener('click', () => this.reset());
    this.btnDismiss.addEventListener('click', () => this.hideError());
  }

  setupDropZone(zone, input, onFile) {
    zone.addEventListener('click', () => input.click());
    
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file && file.type === 'application/pdf') onFile(file);
    });

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.type === 'application/pdf') {
        input.files = e.dataTransfer.files;
        onFile(file);
      }
    });
  }

  checkReady() {
    this.btnCompare.disabled = !(this.fileA_data && this.fileB_data);
  }

  async compare() {
    try {
      this.btnText.hidden = true;
      this.btnLoading.hidden = false;
      this.btnCompare.disabled = true;

      const bufA = await this.readFile(this.fileA_data);
      const bufB = await this.readFile(this.fileB_data);

      const reader = new PdfDocumentReader();
      const docA = await reader.read(bufA);
      const docB = await reader.read(bufB);

      const comparer = new DocumentComparer();
      const report = comparer.compare(docA, docB);

      this.report = report;
      this.showResults(report);

    } catch (error) {
      console.error('Error:', error);
      this.showError(error.message || 'Error al comparar. Verifica que sean PDFs válidos con texto.');
    } finally {
      this.btnText.hidden = false;
      this.btnLoading.hidden = true;
      this.btnCompare.disabled = false;
    }
  }

  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Error al leer archivo'));
      reader.readAsArrayBuffer(file);
    });
  }

  showResults(report) {
    this.uploadSection.hidden = true;
    this.results.hidden = false;

    const n = report.summary.diffs;
    this.summary.textContent = `✅ ${n} diferencia${n !== 1 ? 's' : ''} encontrada${n !== 1 ? 's' : ''}`;

    const counts = { CHANGED: 0, ADDED: 0, REMOVED: 0 };
    report.differences.forEach(d => counts[d.kind]++);

    this.badgeAll.textContent = n;
    this.badgeChanged.textContent = counts.CHANGED;
    this.badgeAdded.textContent = counts.ADDED;
    this.badgeRemoved.textContent = counts.REMOVED;

    this.render(report.differences);
  }

  render(diffs) {
    this.list.innerHTML = '';

    diffs.forEach((d, i) => {
      const item = document.createElement('div');
      item.className = 'diff-item';
      item.dataset.kind = d.kind;
      item.dataset.index = i;

      const kind = {
        CHANGED: 'Modificada',
        ADDED: 'Agregada',
        REMOVED: 'Removida'
      }[d.kind];

      let content = '';
      if (d.original && d.evaluated) {
        content = `
          <div class="diff-content">
            <div>
              <div class="diff-label">Antes:</div>
              <div class="diff-text diff-original">${this.esc(d.original)}</div>
            </div>
            <div>
              <div class="diff-label">Ahora:</div>
              <div class="diff-text diff-evaluated">${this.esc(d.evaluated)}</div>
            </div>
          </div>
        `;
      } else if (d.evaluated) {
        content = `
          <div class="diff-content">
            <div>
              <div class="diff-label">Agregado:</div>
              <div class="diff-text diff-evaluated">${this.esc(d.evaluated)}</div>
            </div>
          </div>
        `;
      } else if (d.original) {
        content = `
          <div class="diff-content">
            <div>
              <div class="diff-label">Removido:</div>
              <div class="diff-text diff-original">${this.esc(d.original)}</div>
            </div>
          </div>
        `;
      }

      item.innerHTML = `
        <div class="diff-header">
          <span>Página ${d.page}</span>
          <span class="diff-kind ${d.kind}">${kind}</span>
        </div>
        ${content}
      `;

      this.list.appendChild(item);
    });
  }

  filter(f) {
    this.currentFilter = f;
    document.querySelectorAll('.filter').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === f);
    });
    document.querySelectorAll('.diff-item').forEach(item => {
      item.classList.toggle('hidden', f !== 'all' && item.dataset.kind !== f);
    });
  }

  exportHTML() {
    if (!this.report) return;
    const html = this.genHTML(this.report);
    this.download(new Blob([html], { type: 'text/html' }), 'reporte.html');
  }

  exportJSON() {
    if (!this.report) return;
    const data = { generatedAt: new Date().toISOString(), ...this.report };
    const json = JSON.stringify(data, null, 2);
    this.download(new Blob([json], { type: 'application/json;charset=utf-8' }), 'reporte.json');
  }

  genHTML(report) {
    const diffs = report.differences.map(d => {
      const kind = { CHANGED: 'Modificada', ADDED: 'Agregada', REMOVED: 'Removida' }[d.kind];
      let content = '';
      if (d.original && d.evaluated) {
        content = `
          <div style="background: #fee2e2; padding: 0.5rem; margin: 0.5rem 0;">
            <strong>Antes:</strong> ${this.esc(d.original)}
          </div>
          <div style="background: #d1fae5; padding: 0.5rem; margin: 0.5rem 0;">
            <strong>Ahora:</strong> ${this.esc(d.evaluated)}
          </div>
        `;
      } else if (d.evaluated) {
        content = `<div style="background: #d1fae5; padding: 0.5rem;">${this.esc(d.evaluated)}</div>`;
      } else if (d.original) {
        content = `<div style="background: #fee2e2; padding: 0.5rem;">${this.esc(d.original)}</div>`;
      }
      return `
        <div style="border: 1px solid #ccc; padding: 1rem; margin: 1rem 0;">
          <div><strong>Página ${d.page} - ${kind}</strong></div>
          ${content}
        </div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html><head><meta charset="UTF-8"><title>Reporte</title></head>
      <body style="font-family: sans-serif; max-width: 900px; margin: 0 auto; padding: 2rem;">
        <h1>Reporte de Comparación</h1>
        <p>✅ ${report.summary.diffs} diferencias</p>
        ${diffs}
      </body></html>
    `;
  }

  download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  showError(msg) {
    this.errorMsg.textContent = msg;
    this.error.hidden = false;
    this.uploadSection.hidden = true;
    this.results.hidden = true;
  }

  hideError() {
    this.error.hidden = true;
    this.uploadSection.hidden = false;
  }

  reset() {
    this.fileA_data = null;
    this.fileB_data = null;
    this.report = null;
    this.currentFilter = 'all';
    this.fileA.value = '';
    this.fileB.value = '';
    this.nameA.textContent = '';
    this.nameB.textContent = '';
    this.dropA.classList.remove('has-file');
    this.dropB.classList.remove('has-file');
    this.btnCompare.disabled = true;
    this.uploadSection.hidden = false;
    this.results.hidden = true;
    this.error.hidden = true;
  }

  esc(txt) {
    const div = document.createElement('div');
    div.textContent = txt;
    return div.innerHTML;
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  new PdfComparatorApp();
});
