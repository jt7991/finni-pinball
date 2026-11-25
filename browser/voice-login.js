import {storeSession} from './voice-session.js';

const form = document.getElementById('voice-login');
const status = document.getElementById('login-status');
const button = form.querySelector('button');
const password = document.getElementById('password');
form.addEventListener('submit', async event => {
  event.preventDefault();
  button.disabled = true;
  status.textContent = '';
  try {
    const response = await fetch('/api/voice-login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({name: document.getElementById('name').value, password: password.value}),
    });
    const session = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(session.message || 'Could not reach Voice Studio sign-in.');
    storeSession(session);
    location.replace('/voice');
  } catch (error) {
    password.value = '';
    password.focus();
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
