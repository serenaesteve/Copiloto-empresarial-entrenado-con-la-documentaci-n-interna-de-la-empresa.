from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import sqlite3, os, requests, json

app = Flask(__name__)
app.secret_key = 'copiloto-secret-2025'

UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'txt', 'md'}
OLLAMA_URL = 'http://localhost:11434/api/generate'
OLLAMA_MODEL = 'llama3'

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ── Base de datos ──────────────────────────────────────────
def get_db():
    db = sqlite3.connect('copiloto.db')
    db.row_factory = sqlite3.Row
    return db

def init_db():
    db = get_db()
    db.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            company TEXT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
    ''')
    db.commit()
    db.close()

init_db()

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'No autenticado'}), 401
    return decorated

# ── Rutas principales ──────────────────────────────────────
@app.route('/')
def index():
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    return render_template('app.html', user=session)

@app.route('/login')
def login_page():
    if 'user_id' in session:
        return redirect(url_for('index'))
    return render_template('auth.html')

# ── Auth API ───────────────────────────────────────────────
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    name    = data.get('name', '').strip()
    company = data.get('company', '').strip()
    email   = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not all([name, email, password]):
        return jsonify({'error': 'Faltan campos obligatorios'}), 400
    if len(password) < 6:
        return jsonify({'error': 'La contraseña debe tener al menos 6 caracteres'}), 400

    db = get_db()
    try:
        db.execute(
            'INSERT INTO users (name, company, email, password) VALUES (?, ?, ?, ?)',
            (name, company, email, generate_password_hash(password))
        )
        db.commit()
        user = db.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
        session['user_id'] = user['id']
        session['name']    = user['name']
        session['company'] = user['company'] or 'Mi Empresa'
        session['email']   = user['email']
        return jsonify({'ok': True, 'name': user['name']})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Ese correo ya está registrado'}), 409
    finally:
        db.close()

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    email    = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Rellena todos los campos'}), 400

    db = get_db()
    user = db.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
    db.close()

    if not user or not check_password_hash(user['password'], password):
        return jsonify({'error': 'Correo o contraseña incorrectos'}), 401

    session['user_id'] = user['id']
    session['name']    = user['name']
    session['company'] = user['company'] or 'Mi Empresa'
    session['email']   = user['email']
    return jsonify({'ok': True, 'name': user['name']})

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'ok': True})

# ── Documentos API ─────────────────────────────────────────
@app.route('/api/documents', methods=['GET'])
def get_documents():
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401
    db = get_db()
    docs = db.execute(
        'SELECT id, name, created_at FROM documents WHERE user_id = ? ORDER BY created_at DESC',
        (session['user_id'],)
    ).fetchall()
    db.close()
    return jsonify([dict(d) for d in docs])

@app.route('/api/documents', methods=['POST'])
def add_document():
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401

    # Subida de archivo
    if 'file' in request.files:
        file = request.files['file']
        if file and allowed_file(file.filename):
            content = file.read().decode('utf-8', errors='ignore')
            name = secure_filename(file.filename)
            db = get_db()
            db.execute(
                'INSERT INTO documents (user_id, name, content) VALUES (?, ?, ?)',
                (session['user_id'], name, content)
            )
            db.commit()
            doc_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]
            db.close()
            return jsonify({'ok': True, 'id': doc_id, 'name': name})
        return jsonify({'error': 'Formato no permitido (usa .txt o .md)'}), 400

    # Texto pegado
    data = request.get_json()
    name    = data.get('name', 'Texto sin título')
    content = data.get('content', '').strip()
    if not content:
        return jsonify({'error': 'El contenido está vacío'}), 400

    db = get_db()
    db.execute(
        'INSERT INTO documents (user_id, name, content) VALUES (?, ?, ?)',
        (session['user_id'], name, content)
    )
    db.commit()
    doc_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]
    db.close()
    return jsonify({'ok': True, 'id': doc_id, 'name': name})

@app.route('/api/documents/<int:doc_id>', methods=['DELETE'])
def delete_document(doc_id):
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401
    db = get_db()
    db.execute(
        'DELETE FROM documents WHERE id = ? AND user_id = ?',
        (doc_id, session['user_id'])
    )
    db.commit()
    db.close()
    return jsonify({'ok': True})

# ── Chat API con Ollama ────────────────────────────────────
@app.route('/api/chat', methods=['POST'])
def chat():
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401

    data = request.get_json()
    question = data.get('question', '').strip()
    history  = data.get('history', [])

    if not question:
        return jsonify({'error': 'Pregunta vacía'}), 400

    # Cargar documentación del usuario
    db = get_db()
    docs = db.execute(
        'SELECT name, content FROM documents WHERE user_id = ?',
        (session['user_id'],)
    ).fetchall()
    db.close()

    doc_context = '\n\n'.join(
        f'--- DOCUMENTO: {d["name"]} ---\n{d["content"]}' for d in docs
    ) or '[Sin documentación cargada. Indica al usuario que añada documentos.]'

    # Construir historial como texto
    history_text = ''
    for msg in history[-6:]:  # últimos 6 mensajes para no saturar contexto
        role = 'Usuario' if msg['role'] == 'user' else 'Copiloto'
        history_text += f'{role}: {msg["content"]}\n'

    prompt = f"""Eres CopilotoPRO, un copiloto empresarial inteligente. Responde SOLO basándote en la documentación interna proporcionada. Si la información no está en los documentos, dilo claramente. Sé conciso y profesional. Responde siempre en español.

DOCUMENTACIÓN INTERNA:
{doc_context}

HISTORIAL DE CONVERSACIÓN:
{history_text}
Usuario: {question}
Copiloto:"""

    try:
        response = requests.post(OLLAMA_URL, json={
            'model': OLLAMA_MODEL,
            'prompt': prompt,
            'stream': False
        }, timeout=60)

        if response.status_code != 200:
            return jsonify({'error': f'Error de Ollama: {response.status_code}'}), 500

        result = response.json()
        answer = result.get('response', '').strip()
        return jsonify({'answer': answer})

    except requests.exceptions.ConnectionError:
        return jsonify({'error': 'No se puede conectar con Ollama. ¿Está ejecutándose? Prueba: ollama serve'}), 503
    except requests.exceptions.Timeout:
        return jsonify({'error': 'Ollama tardó demasiado en responder. Intenta de nuevo.'}), 504
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
