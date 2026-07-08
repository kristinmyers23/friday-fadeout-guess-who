const socket = io();
let currentCode = null;
let currentState = null;

const photosInput = document.getElementById('photos');
const nameFields = document.getElementById('nameFields');
const setupError = document.getElementById('setupError');

photosInput.addEventListener('change', () => {
  nameFields.innerHTML = '';
  [...photosInput.files].forEach((file, index) => {
    const wrap = document.createElement('div');
    wrap.innerHTML = `<label>Photo ${index + 1} name</label><input class="personName" value="${file.name.replace(/\.[^.]+$/, '')}" />`;
    nameFields.appendChild(wrap);
  });
});

document.getElementById('createGame').addEventListener('click', async () => {
  setupError.textContent = '';
  const files = [...photosInput.files];
  const names = [...document.querySelectorAll('.personName')].map(i => i.value.trim());
  const answerOrder = document.getElementById('answerOrder').value
    .split(',')
    .map(v => Number(v.trim()) - 1)
    .filter(v => Number.isInteger(v) && v >= 0);

  const form = new FormData();
  form.append('title', document.getElementById('title').value.trim());
  form.append('names', JSON.stringify(names));
  form.append('answerOrder', JSON.stringify(answerOrder));
  files.forEach(file => form.append('photos', file));

  const response = await fetch('/api/games', { method: 'POST', body: form });
  const data = await response.json();
  if (!response.ok) {
    setupError.textContent = data.error || 'Could not create game.';
    return;
  }
  currentCode = data.code;
  socket.emit('presenter:join', { code: currentCode });
});

document.getElementById('startGame').addEventListener('click', () => {
  if (currentCode) socket.emit('game:start', { code: currentCode });
});

socket.on('presenter:state', state => {
  currentState = state;
  document.getElementById('setupPanel').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('dashTitle').textContent = state.title;
  document.getElementById('gameCode').textContent = state.code;
  renderAnswerKey(state);
  renderBoard(state);
  renderLeaderboard(state);
});

socket.on('errorMessage', msg => setupError.textContent = msg);

function personName(id) {
  return currentState?.people.find(p => p.id === id)?.name || 'Unknown';
}

function renderAnswerKey(state) {
  const list = document.getElementById('answerKey');
  list.innerHTML = '';
  state.answerKey.forEach(id => {
    const li = document.createElement('li');
    li.textContent = personName(id);
    list.appendChild(li);
  });
}

function renderBoard(state) {
  const board = document.getElementById('presenterBoard');
  board.innerHTML = '';
  state.people.forEach((person, index) => {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `<span class="badge">${index + 1}</span><img src="${person.photoUrl}" alt="${person.name}" /><strong>${person.name}</strong>`;
    board.appendChild(div);
  });
}

function renderLeaderboard(state) {
  const body = document.getElementById('leaderboard');
  body.innerHTML = '';
  const ranked = [...state.players].sort((a, b) => b.correct - a.correct || String(a.submittedAt || '').localeCompare(String(b.submittedAt || '')));
  ranked.forEach((player, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${index + 1}</td><td>${player.name}</td><td>${player.correct}/${player.total}</td><td>${player.submittedAt ? 'Submitted' : `${player.picks.length} picked`}</td>`;
    body.appendChild(tr);
  });
}
