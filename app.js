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
  const query = `
      SELECT 
          p.player_id, 
          p.first_name, 
          p.last_name, 
          p.points,
          COALESCE(COUNT(CASE WHEN (m.player1_id = p.player_id AND m.player1_legs > m.player2_legs) 
                      OR (m.player2_id = p.player_id AND m.player2_legs > m.player1_legs) 
                      THEN 1 END), 0) AS matches_won,
          COALESCE(COUNT(m.match_id), 0) AS matches_played,
          COALESCE(SUM(CASE WHEN m.player1_id = p.player_id THEN m.player1_legs ELSE m.player2_legs END), 0) AS legs_won,
          COALESCE(SUM(CASE WHEN m.player1_id = p.player_id THEN m.player2_legs ELSE m.player1_legs END), 0) AS legs_lost,
          COALESCE(SUM(CASE WHEN m.player1_id = p.player_id THEN m.player1_legs ELSE m.player2_legs END), 0) 
          - 
          COALESCE(SUM(CASE WHEN m.player1_id = p.player_id THEN m.player2_legs ELSE m.player1_legs END), 0) AS leg_plus
      FROM players p
      LEFT JOIN matches m ON p.player_id = m.player1_id OR p.player_id = m.player2_id
      GROUP BY p.player_id, p.first_name, p.last_name, p.points
      ORDER BY p.points DESC, leg_plus DESC, matches_won DESC, legs_won DESC, legs_lost ASC;
  `;

  db.all(query, [], (err, players) => {
      if (err) {
          console.error("Database error:", err);
          return res.status(500).send("Database error.");
      }
      res.render('home', { title: "Darts Players Standings", players });
  });
});


//Player Route
app.get('/players', (req, res) => {
  db.all(`
    SELECT *, (legs_won - legs_lost) AS leg_plus 
    FROM players 
    ORDER BY points DESC, leg_plus DESC, legs_won DESC, legs_lost ASC`, 
    (err, players) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).send('Database error');
      }
      res.render('players', { players });
  });
});


// Single-Players Route
app.get('/players/:player_id', (req, res) => {
  const playerId = req.params.player_id;

  // Hämta spelarens fullständiga information från databasen
  db.get(
    `SELECT * FROM players WHERE player_id = ?`, 
    [playerId], 
    (err, player) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).send('Database error');
      }
      if (!player) {
        return res.status(404).send('Player not found');
      }

      // Hämta spelarens matchhistorik
      db.all(`
        SELECT 
          p1.first_name || ' ' || p1.last_name AS player1_name,
          p2.first_name || ' ' || p2.last_name AS player2_name,
          m.player1_id,
          m.player2_id,
          m.player1_legs, 
          m.player2_legs, 
          m.date
        FROM matches m
        JOIN players p1 ON m.player1_id = p1.player_id
        JOIN players p2 ON m.player2_id = p2.player_id
        WHERE m.player1_id = ? OR m.player2_id = ?
        ORDER BY date DESC
      `, [playerId, playerId], (err, matches) => {
        if (err) {
          console.error("Match history error:", err);
          return res.status(500).send('Database error.');
        }

        // Skapa matchhistorik med korrekt "opponent" och "leg_plus"
        const matchHistory = matches.map(match => {
          const isPlayer1 = match.player1_id === parseInt(playerId);
          return {
            opponent: isPlayer1 ? match.player2_name : match.player1_name,
            result: isPlayer1
              ? `${match.player1_legs}-${match.player2_legs}`
              : `${match.player2_legs}-${match.player1_legs}`,
            leg_plus: isPlayer1 
              ? match.player1_legs - match.player2_legs 
              : match.player2_legs - match.player1_legs,
            date: match.date
          };
        });

        // Rendera spelarsidan med korrekt data
        res.render('single-player', { player, matches: matchHistory });
      });
  });
});


// Register Match Route
app.get('/register/match', (req, res) => {
  db.all('SELECT player_id, first_name, last_name FROM players', (err, players) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).send('Database error');
    }
    res.render('addMatch', { players });
  });
});

// Add Match Route
app.post('/match/add', (req, res) => {
  const { player1_id, player2_id, result, date } = req.body;

  // Validera att alla fält är ifyllda
  if (!player1_id || !player2_id || !result || !date) {
    return res.status(400).send("All fields are required!");
  }

  // Se till att spelarna inte är samma person
  if (player1_id === player2_id) {
    return res.status(400).send("A player cannot play against themselves.");
  }

  // Splitta resultatet ("3-1" → player1_legs = 3, player2_legs = 1)
  const [player1_legs, player2_legs] = result.split('-').map(Number);

  // Kontrollera att resultatet är numeriskt
  if (isNaN(player1_legs) || isNaN(player2_legs)) {
    return res.status(400).send("Invalid result format. Use 'X-Y' (e.g., 3-1)");
  }

  const leg_plus_player1 = player1_legs - player2_legs;
  const leg_plus_player2 = player2_legs - player1_legs;

  db.serialize(() => {
    db.run("BEGIN TRANSACTION"); // 🔴 Starta transaktion

    // Lägg till match i databasen
    db.run(
      `INSERT INTO matches (player1_id, player2_id, player1_legs, player2_legs, leg_plus, date) 
       VALUES (?, ?, ?, ?, ?, ?)`, 
      [player1_id, player2_id, player1_legs, player2_legs, leg_plus_player1, date], 
      function (err) {
        if (err) {
          console.error("Insert match error:", err);
          db.run("ROLLBACK");
          return res.status(500).send("Database error: Could not insert match.");
        }

        // Uppdatera statistik för spelare 1
        db.run(
          `UPDATE players 
           SET legs_won = legs_won + ?, 
               legs_lost = legs_lost + ?, 
               matches_played = matches_played + 1,
               leg_plus = leg_plus + ? 
           WHERE player_id = ?`,
          [player1_legs, player2_legs, leg_plus_player1, player1_id],
          function (err) {
            if (err) {
              console.error("Update player1 error:", err);
              db.run("ROLLBACK");
              return res.status(500).send("Database error: Could not update player 1.");
            }

            // Uppdatera statistik för spelare 2
            db.run(
              `UPDATE players 
               SET legs_won = legs_won + ?, 
                   legs_lost = legs_lost + ?, 
                   matches_played = matches_played + 1,
                   leg_plus = leg_plus + ? 
               WHERE player_id = ?`,
              [player2_legs, player1_legs, leg_plus_player2, player2_id],
              function (err) {
                if (err) {
                  console.error("Update player2 error:", err);
                  db.run("ROLLBACK");
                  return res.status(500).send("Database error: Could not update player 2.");
                }

                // Uppdatera poängsystem
                let winner_id = null;
                if (player1_legs > player2_legs) {
                  winner_id = player1_id;
                } else if (player2_legs > player1_legs) {
                  winner_id = player2_id;
                }

                if (winner_id) {
                  db.run(
                    "UPDATE players SET points = points + 1 WHERE player_id = ?", 
                    [winner_id], 
                    function (err) {
                      if (err) {
                        console.error("Update points error:", err);
                        db.run("ROLLBACK");
                        return res.status(500).send("Database error: Could not update points.");
                      }
                      db.run("COMMIT"); // 🟢 Slutför transaktionen
                      res.redirect('/players');
                    }
                  );
                } else {
                  db.run("COMMIT"); // 🟢 Slutför transaktionen om ingen vinner
                  res.redirect('/players');
                }
              }
            );
          }
        );
      }
    );
  });
});




// Start Server
app.listen(3000, () => {
  console.log('Server is running at http://localhost:3000');
});
