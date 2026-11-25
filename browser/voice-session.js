const sessionKey = 'finni-voice-session';

export function storeSession(session) {
  sessionStorage.setItem(sessionKey, JSON.stringify(session));
}

export function requireSession() {
  const saved = sessionStorage.getItem(sessionKey);
  if (saved) return JSON.parse(saved);
  location.replace('/voice-login');
}

export function connectSignOut(session) {
  document.getElementById('signed-in-name').textContent = session.name;
  document.getElementById('sign-out').addEventListener('click', () => {
    sessionStorage.removeItem(sessionKey);
    requireSession();
  });
}

export async function voiceRequest(session, path, options = {}) {
  const response = await fetch(path, {...options, headers: {Authorization: session.token}});
  const data = await response.json();
  if (response.status === 401 || response.status === 403) {
    sessionStorage.removeItem(sessionKey);
    requireSession();
  }
  if (!response.ok) throw Error(data.message || 'Voice Studio could not complete the request.');
  return data;
}
