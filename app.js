// Year
document.getElementById('y') && (document.getElementById('y').textContent = new Date().getFullYear());

// Assistant panel
const dlg = document.getElementById('assistant');
const openBtn = document.getElementById('open-assistant');
const closeBtn = document.getElementById('close-assistant');
const mount = document.getElementById('assistant-body');

function ensureGradioMounted() {
  if (!mount.querySelector('gradio-app')) {
    const app = document.createElement('gradio-app');
    app.setAttribute('space', 'MANO066/Career-takAI'); // Your Space
    app.setAttribute('theme_mode', 'light');
    app.setAttribute('eager', 'true');
    app.setAttribute('container', 'false');
    app.setAttribute('info', 'false');
    mount.appendChild(app);
  }
}
function openAssistant(){ ensureGradioMounted(); if (!dlg.open) dlg.show(); }
function closeAssistant(){ if (dlg.open) dlg.close(); }

openBtn && openBtn.addEventListener('click', openAssistant);
closeBtn && closeBtn.addEventListener('click', closeAssistant);

// Restore open state if desired
if (localStorage.getItem('assistant-open') === '1') openAssistant();
dlg && dlg.addEventListener('close', () => localStorage.removeItem('assistant-open'));
