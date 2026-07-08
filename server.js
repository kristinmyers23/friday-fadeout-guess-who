const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const uploadDir = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-z0-9._-]/gi, '_').toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safe}`);
  }
});
const upload = multer({ storage });

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const games = new Map();

function makeCode() {
  let code;
  do code = crypto.randomBytes(3).toString('hex').toUpperCase();
  while (games.has(code));
  return code;
}

function presenterPayload(game) {
  return {
    code: game.code,
    title: game.title,
    people: game.people,
    answerKey: game.answerKey,
    started: game.started,
    players: Array.from(game.players.values()).map(scorePlayer)
  };
}

function playerPayload(game) {
  return {
    code: game.code,
    title: game.title,
    people: game.people,
    started: game.started
  };
}

function scorePlayer(player) {
  const game = games.get(player.code);
  const key = game?.answerKey || [];
  let correct = 0;
  const details = player.picks.map((personId, index) => {
    const expected = key[index];
    const isCorrect = personId === expected;
    if (isCorrect) correct += 1;
    return { order: index + 1, personId, expected, isCorrect };
  });
  return {
    id: player.id,
    name: player.name,
    picks: player.picks,
    correct,
    total: key.length,
    submittedAt: player.submittedAt,
    details
  };
}

app.post('/api/games', upload.array('photos'), (req, res) => {
  try {
    const title = req.body.title || 'Guess Who Live';
    const names = JSON.parse(req.body.names || '[]');
    const answerOrder = JSON.parse(req.body.answerOrder || '[]');

    if (!req.files?.length) return res.status(400).json({ error: 'Upload at least one photo.' });
    if (names.length !== req.files.length) return res.status(400).json({ error: 'Each photo needs a matching name.' });

    const people = req.files.map((file, index) => ({
      id: crypto.randomUUID(),
      name: names[index] || `Person ${index + 1}`,
      photoUrl: `/uploads/${file.filename}`
    }));

    const answerKey = answerOrder.map(i => people[Number(i)]?.id).filter(Boolean);
    if (!answerKey.length) return res.status(400).json({ error: 'Create an answer key order.' });

    const code = makeCode();
    games.set(code, { code, title, people, answerKey, started: false, players: new Map() });
    res.json({ code });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Could not create game.' });
  }
});

io.on('connection', socket => {
  socket.on('presenter:join', ({ code }) => {
    const game = games.get(String(code || '').toUpperCase());
    if (!game) return socket.emit('errorMessage', 'Game not found.');
    socket.join(`presenter:${game.code}`);
    socket.emit('presenter:state', presenterPayload(game));
  });

  socket.on('game:start', ({ code }) => {
    const game = games.get(String(code || '').toUpperCase());
    if (!game) return;
    game.started = true;
    io.to(`game:${game.code}`).emit('game:state', playerPayload(game));
    io.to(`presenter:${game.code}`).emit('presenter:state', presenterPayload(game));
  });

  socket.on('player:join', ({ code, name }) => {
    const game = games.get(String(code || '').toUpperCase());
    if (!game) return socket.emit('errorMessage', 'Game not found.');
    const player = { id: socket.id, code: game.code, name: name || 'Player', picks: [], submittedAt: null };
    game.players.set(socket.id, player);
    socket.join(`game:${game.code}`);
    socket.emit('game:state', playerPayload(game));
    io.to(`presenter:${game.code}`).emit('presenter:state', presenterPayload(game));
  });

  socket.on('player:pick', ({ code, picks }) => {
    const game = games.get(String(code || '').toUpperCase());
    const player = game?.players.get(socket.id);
    if (!game || !player) return;
    const allowed = new Set(game.people.map(p => p.id));
    player.picks = Array.isArray(picks) ? picks.filter(id => allowed.has(id)) : [];
    io.to(`presenter:${game.code}`).emit('presenter:state', presenterPayload(game));
  });

  socket.on('player:submit', ({ code, picks }) => {
    const game = games.get(String(code || '').toUpperCase());
    const player = game?.players.get(socket.id);
    if (!game || !player) return;
    const allowed = new Set(game.people.map(p => p.id));
    player.picks = Array.isArray(picks) ? picks.filter(id => allowed.has(id)) : [];
    player.submittedAt = new Date().toISOString();
    socket.emit('player:result', scorePlayer(player));
    io.to(`presenter:${game.code}`).emit('presenter:state', presenterPayload(game));
  });

  socket.on('disconnect', () => {
    for (const game of games.values()) {
      if (game.players.delete(socket.id)) {
        io.to(`presenter:${game.code}`).emit('presenter:state', presenterPayload(game));
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Guess Who Live running at http://localhost:${PORT}`));
