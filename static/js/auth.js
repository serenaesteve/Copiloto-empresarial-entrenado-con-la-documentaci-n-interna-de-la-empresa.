/* auth.js */
const authSp = document.getElementById('auth-spirals');
for (let i = 0; i < 18; i++) {
  const s = document.createElement('div');
  s.className = 'spiral';
  authSp.appendChild(s);
}

function switchTab(tab) {
  document.getElementById('form-login').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('form-register').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('tab-login').className = 'tab' + (tab === 'login' ? ' active' : '');
  document.getElementById('tab-register').className = 'tab' + (tab === 'register' ? ' active' : '');
  clearAlerts();
}

function clearAlerts() {
  ['login-error', 'register-error', 'register-success'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('visible'); el.textContent = ''; }
  });
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = '⚠️ ' + msg;
  el.classList.add('visible');
}

function showSuccess(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = '✅ ' + msg;
  el.classList.add('visible');
}

async function doLogin() {
  clearAlerts();
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  if (!email || !pass) { showError('login-error', 'Rellena todos los campos.'); return; }

  const btn = document.querySelector('#form-login .submit-btn');
  btn.disabled = true; btn.textContent = 'Entrando...';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass })
    });
    const data = await res.json();
    if (!res.ok) { showError('login-error', data.error); return; }
    window.location.href = '/';
  } catch {
    showError('login-error', 'Error de conexión con el servidor.');
  } finally {
    btn.disabled = false; btn.textContent = 'Entrar al cuaderno ✏️';
  }
}

async function doRegister() {
  clearAlerts();
  const name    = document.getElementById('reg-name').value.trim();
  const company = document.getElementById('reg-company').value.trim();
  const email   = document.getElementById('reg-email').value.trim();
  const pass    = document.getElementById('reg-pass').value;
  const pass2   = document.getElementById('reg-pass2').value;
  const terms   = document.getElementById('accept-terms').checked;

  if (!name || !email || !pass || !pass2) { showError('register-error', 'Rellena todos los campos obligatorios.'); return; }
  if (pass.length < 6) { showError('register-error', 'La contraseña debe tener al menos 6 caracteres.'); return; }
  if (pass !== pass2) { showError('register-error', 'Las contraseñas no coinciden.'); return; }
  if (!terms) { showError('register-error', 'Debes aceptar los términos y condiciones.'); return; }

  const btn = document.querySelector('#form-register .submit-btn');
  btn.disabled = true; btn.textContent = 'Creando cuenta...';

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, company, email, password: pass })
    });
    const data = await res.json();
    if (!res.ok) { showError('register-error', data.error); return; }
    showSuccess('register-success', '¡Cuenta creada! Accediendo...');
    setTimeout(() => window.location.href = '/', 1000);
  } catch {
    showError('register-error', 'Error de conexión con el servidor.');
  } finally {
    btn.disabled = false; btn.textContent = 'Crear mi cuenta 🚀';
  }
}
