const socket = io();
let code = null;
let state = null;
let picks = [];

const joinPanel = document.getElementById('joinPanel');
const gamePanel = document.getElementById('gamePanel');
const joinError = document.getElementById('joinError');
const result = document.getElementById('result');

document.getElementById('joinGame').addEventListener('click', () => {
  code = document.getElementById('gameCodeInput').value.trim().toUpperCase();
  const name = document.getElementById('playerName').value.trim() || 'Player';
  socket.emit('player:join', { code, name });
});

document.getElementById('clearPicks').addEventListener('click', () => {
  picks = [];
  result.textContent = '';
  renderBoard();
  socket.emit('player:pick', { code, picks });
});

document.getElementById('submitPicks').addEventListener('click', () => {
  socket.emit('player:submit', { code, picks });
});

socket.on('game:state', newState => {
  state = newState;
  joinPanel.style.display = 'none';
  gamePanel.style.display = 'block';
  document.getElementById('gameTitle').textContent = state.title;
  renderBoard();
});

socket.on('player:result', score => {
  result.innerHTML = `<strong>You scored ${score.correct}/${score.total}.</strong>`;
});

socket.on('errorMessage', msg => joinError.textContent = msg);

function renderBoard() {
  const board = document.getElementById('playerBoard');
  board.innerHTML = '';
  state.people.forEach(person => {
    const selectedIndex = picks.indexOf(person.id);
    const div = document.createElement('div');
    div.className = `card ${selectedIndex >= 0 ? 'selected' : ''}`;
    div.innerHTML = `${selectedIndex >= 0 ? `<span class="badge">${selectedIndex + 1}</span>` : ''}<img src="${person.photoUrl}" alt="${person.name}" /><strong>${person.name}</strong>`;
    div.addEventListener('click', () => togglePick(person.id));
    board.appendChild(div);
  });
}

function togglePick(personId) {
  const existing = picks.indexOf(personId);
  if (existing >= 0) picks.splice(existing, 1);
  else picks.push(personId);
  result.textContent = '';
  renderBoard();
  socket.emit('player:pick', { code, picks });
}
