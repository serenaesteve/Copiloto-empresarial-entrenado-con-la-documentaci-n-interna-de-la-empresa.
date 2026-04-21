/* app.js */
const appSp = document.getElementById('app-spirals');
for (let i = 0; i < 22; i++) {
  const s = document.createElement('div');
  s.className = 'spiral';
  appSp.appendChild(s);
}

let messages = [];
let isLoading = false;

// ── Logout ──
async function doLogout() {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login';
}

// ── Cargar documentos al iniciar ──
async function loadDocuments() {
  try {
    const res = await fetch('/api/documents');
    const docs = await res.json();
    renderDocList(docs);
    updateContext(docs.length);
  } catch {
    updateContext(0);
  }
}

function renderDocList(docs) {
  const list = document.getElementById('doc-list');
  document.getElementById('docs-count').textContent = docs.length;

  if (!docs.length) {
    list.innerHTML = '<div style="color:rgba(255,255,255,0.25);font-family:Caveat,cursive;font-size:12px;padding:6px 2px">Sin documentos aún</div>';
    return;
  }
  list.innerHTML = docs.map(doc => `
    <div class="doc-item">
      <span class="doc-icon">📝</span>
      <span class="doc-name" title="${doc.name}">${doc.name}</span>
      <button class="doc-remove" onclick="removeDoc(${doc.id})">✕</button>
    </div>
  `).join('');
}

function updateContext(count) {
  const ctx = document.getElementById('header-context');
  ctx.textContent = count
    ? `${count} documento${count > 1 ? 's' : ''} cargado${count > 1 ? 's' : ''} · LLaMA 3 listo`
    : 'Añade documentación para empezar';
}

// ── Subida de archivo ──
document.getElementById('file-input').addEventListener('change', async (e) => {
  for (const file of Array.from(e.target.files)) {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/documents', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { alert('Error: ' + data.error); continue; }
    } catch { alert('Error al subir el archivo.'); }
  }
  e.target.value = '';
  loadDocuments();
});

// ── Pegar texto ──
async function addPastedText() {
  const ta = document.getElementById('paste-text');
  const content = ta.value.trim();
  if (!content) return;
  const name = 'Texto-' + new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

  try {
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, content })
    });
    const data = await res.json();
    if (!res.ok) { alert('Error: ' + data.error); return; }
    ta.value = '';
    loadDocuments();
  } catch { alert('Error al guardar el texto.'); }
}

// ── Eliminar documento ──
async function removeDoc(id) {
  try {
    await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    loadDocuments();
  } catch { alert('Error al eliminar el documento.'); }
}

// ── Chat ──
function useSuggestion(el) {
  document.getElementById('question-input').value = el.textContent;
  sendMessage();
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
}

function appendMessage(role, content) {
  const area = document.getElementById('messages-area');
  const empty = document.getElementById('empty-state');
  if (empty) empty.remove();

  const div = document.createElement('div');
  div.className = 'msg ' + role;
  const avatar = role === 'user'
    ? (document.getElementById('app-avatar')?.textContent || '👤')
    : '🤖';

  div.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div class="msg-bubble">${formatContent(content)}</div>
  `;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

function formatContent(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

async function sendMessage() {
  if (isLoading) return;
  const input = document.getElementById('question-input');
  const question = input.value.trim();
  if (!question) return;

  input.value = ''; input.style.height = 'auto';
  messages.push({ role: 'user', content: question });
  appendMessage('user', question);

  const area = document.getElementById('messages-area');
  const td = document.createElement('div');
  td.className = 'msg bot'; td.id = 'typing';
  td.innerHTML = `<div class="msg-avatar">🤖</div><div class="msg-bubble"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;
  area.appendChild(td); area.scrollTop = area.scrollHeight;

  isLoading = true;
  document.getElementById('send-btn').disabled = true;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, history: messages.slice(-6) })
    });
    const data = await res.json();
    td.remove();

    if (!res.ok) {
      appendMessage('bot', '⚠️ ' + (data.error || 'Error desconocido'));
    } else {
      messages.push({ role: 'assistant', content: data.answer });
      appendMessage('bot', data.answer);
    }
  } catch {
    td.remove();
    appendMessage('bot', '⚠️ Error de conexión con el servidor Flask.');
  }

  isLoading = false;
  document.getElementById('send-btn').disabled = false;
}

// ── Init ──
loadDocuments();
