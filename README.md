# 🤖 CopilotoPRO — Flask + SQLite + Ollama

Copiloto empresarial 100% local y gratuito.
Sin API de pago. Funciona con LLaMA 3 a través de Ollama.

---

## ⚙️ Requisitos previos

- Python 3.10+
- Ollama instalado: https://ollama.com/download

---

## 🚀 Instalación paso a paso

### 1. Instalar dependencias Python

```bash
pip install -r requirements.txt --break-system-packages
```

### 2. Instalar y arrancar Ollama

```bash
# Instalar LLaMA 3 (solo la primera vez, ~4GB)
ollama pull llama3

# Arrancar el servidor Ollama (en una terminal aparte)
ollama serve
```

### 3. Arrancar la app Flask

```bash
python app.py
```

### 4. Abrir en el navegador

```
http://localhost:5000
```

---

## 📁 Estructura

```
copiloto-flask/
├── app.py                  # Backend Flask
├── requirements.txt
├── copiloto.db             # Se crea automáticamente
├── uploads/                # Carpeta de archivos subidos
├── templates/
│   ├── auth.html           # Pantalla login/registro
│   └── app.html            # App principal
└── static/
    ├── css/style.css
    └── js/
        ├── auth.js
        └── app.js
```

---

## ✨ Características

- Login y registro con contraseñas hasheadas (Werkzeug)
- Documentos guardados en SQLite por usuario
- Subida de archivos .txt y .md
- Pegado directo de texto
- Chat con LLaMA 3 vía Ollama (100% local)
- Historial de conversación por sesión

---

## 🔧 Cambiar el modelo

Edita `app.py` línea 11:

```python
OLLAMA_MODEL = 'llama3'   # Cambia por llama3.2, mistral, etc.
```

---

## 🛑 Solución de errores

| Error | Solución |
|-------|----------|
| `ConnectionError` Ollama | Ejecuta `ollama serve` en otra terminal |
| `model not found` | Ejecuta `ollama pull llama3` |
| Puerto 5000 ocupado | Cambia el puerto en `app.py`: `app.run(port=5001)` |
