# Guess Who Live

A one-board, bingo-style multiplayer Guess Who game.

## What it does
- Presenter creates a game.
- Presenter uploads real photos.
- Presenter enters names and answer-key order.
- Players join from their own computers using a game code.
- Players click photos in the order they think is correct.
- Presenter dashboard shows who got the most right.

## Run locally
```bash
npm install
npm start
```

Open:
- Presenter: http://localhost:3000/presenter.html
- Player: http://localhost:3000/player.html

## Notes
This is an MVP. Games are stored in memory, so restarting the server clears games. Uploaded photos are stored in `public/uploads`.
