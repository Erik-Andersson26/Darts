const express = require('express');
const app = express();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.db');
const exphbs = require('express-handlebars');
const session = require('express-session');

app.engine('handlebars', exphbs.engine({ 
  defaultLayout: 'main',
  layoutsDir: "views/layouts/",
  helpers: { 
    addOne: (value) => value + 1 
  }
}));

app.set('view engine', 'handlebars');
app.use(express.static('public'));

app.use(express.urlencoded({ extended: false }));

// Setup session
app.use(session({
  secret: 'sessionsecret',
  resave: false,
  saveUninitialized: false
}));


// Home Route
app.get(['/','/home'], (req, res) => {
  db.all('SELECT * FROM players ORDER BY points DESC', (err, players) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).send("Database error");
    }
    res.render('home', { title: "Darts Players Standings", players });
  });
});


// Players Route
app.get('/players', (req, res) => {
  db.all('SELECT * FROM players ORDER BY points DESC', (err, players) => {
    if (err) return res.status(500).send('Database error');
    res.render('players', { players });
  });
});

// Single Player Route
app.get('/players/:player_id', (req, res) => {
  const playerId = req.params.player_id;

  // Hämta spelarinformation
  db.get('SELECT * FROM players WHERE player_id = ?', [playerId], (err, player) => {
    if (err) return res.status(500).send('Database error');
    if (!player) return res.status(404).send('Player not found');

    // Hämta matchhistorik (inklusive motståndarens namn)
    db.all(`
      SELECT 
        p1.first_name || ' ' || p1.last_name AS player1_name,
        p2.first_name || ' ' || p2.last_name AS player2_name,
        m.player1_legs, 
        m.player2_legs, 
        m.date 
      FROM match m
      JOIN players p1 ON m.player1_id = p1.player_id
      JOIN players p2 ON m.player2_id = p2.player_id
      WHERE m.player1_id = ? OR m.player2_id = ?
      ORDER BY date DESC
    `, [playerId, playerId], (err, matches) => {
      if (err) return res.status(500).send('Database error');

      // Omvandla data så att det blir enklare att visa rätt motståndare
      const matchHistory = matches.map(match => ({
        opponent: match.player1_name === `${player.first_name} ${player.last_name}`
          ? match.player2_name
          : match.player1_name,
        result: match.player1_name === `${player.first_name} ${player.last_name}`
          ? `${match.player1_legs}-${match.player2_legs}`
          : `${match.player2_legs}-${match.player1_legs}`,
        date: match.date
      }));

      res.render('single-player', { player, matches: matchHistory });
    });
  });
});


// Register Match Route
app.get('/register/match', (req, res) => {
  db.all('SELECT player_id, first_name, last_name FROM players', (err, players) => {
    if (err) return res.status(500).send('Database error');
    res.render('addMatch', { players });
  });
});


// Add Match Route
app.post('/match/add', (req, res) => {
  const { player1_id, player2_id, result, date } = req.body;
  const [player1_legs, player2_legs] = result.split('-').map(Number);

  if (isNaN(player1_legs) || isNaN(player2_legs)) {
    return res.status(400).send("Invalid result format. Use 'X-Y' (e.g., 3-1)");
  }

  db.run(
    'INSERT INTO match(player1_id, player2_id, player1_legs, player2_legs, date) VALUES (?, ?, ?, ?, ?)', 
    [player1_id, player2_id, player1_legs, player2_legs, date]
  );

  db.run(
    'UPDATE players SET legs_won = legs_won + ?, legs_lost = legs_lost + ?, matches_played = matches_played + 1 WHERE player_id = ?', 
    [player1_legs, player2_legs, player1_id]
  );

  db.run(
    'UPDATE players SET legs_won = legs_won + ?, legs_lost = legs_lost + ?, matches_played = matches_played + 1 WHERE player_id = ?', 
    [player2_legs, player1_legs, player2_id]
  );

  if (player1_legs > player2_legs) {
    db.run('UPDATE players SET points = points + 1 WHERE player_id = ?', [player1_id]);
  } else if (player2_legs > player1_legs) {
    db.run('UPDATE players SET points = points + 1 WHERE player_id = ?', [player2_id]);
  }

  res.redirect('/players');
});


// Start Server
app.listen(3000, () => {
  console.log('Server is running at http://localhost:3000');
});
