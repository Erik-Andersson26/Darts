const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.db');

// Initialize database
db.serialize(() => { 
  db.run(`
    CREATE TABLE IF NOT EXISTS players (
      player_id INTEGER PRIMARY KEY, 
      first_name TEXT, 
      last_name TEXT, 
      walk_out_song TEXT, 
      dart_brand TEXT, 
      points INTEGER DEFAULT 0, 
      legs_won INTEGER DEFAULT 0, 
      legs_lost INTEGER DEFAULT 0, 
      leg_plus INTEGER DEFAULT 0, 
      matches_played INTEGER DEFAULT 0
    )`
  );

  db.run(`
    CREATE TABLE IF NOT EXISTS matches (
      match_id INTEGER PRIMARY KEY, 
      player1_id INTEGER, 
      player2_id INTEGER, 
      player1_legs INTEGER, 
      player2_legs INTEGER, 
      leg_plus INTEGER DEFAULT 0, 
      date TEXT, 
      FOREIGN KEY (player1_id) REFERENCES players(player_id), 
      FOREIGN KEY (player2_id) REFERENCES players(player_id)
    )`
  );

  // Insert sample players
  const players = [
    ["Erik", "Andersson", "Ring Of Fire", "Target"],
    ["Kasper", "Ljungström", "La Bamba", "Winmau"],
    ["Teodor", "Hellstrand", "Sex On Fire", "Red Dragon"],
    ["Oskar", "Axell", "", ""],
    ["David", "Bergsten", "", ""],
    ["David", "Ekblad", "", ""],
    ["Alfred", "Berger", "", ""]
  ];

  players.forEach(player => {
    db.run(`
      INSERT INTO players (first_name, last_name, walk_out_song, dart_brand) 
      VALUES (?, ?, ?, ?)`, player
    );
  });

  // Insert match results
  const matches = [
    // GW1
    [1, 6, 2, 3, '2025-02-01'], // Libbe vs Blau 2–3
    [5, 2, 0, 3, '2025-02-01'], // Dave vs Kappe 0–3
    [3, 7, 3, 0, '2025-02-01'], // Torre vs Affe 3–0
    // GW2
    [3, 1, 3, 2, '2025-02-08'], // Torre vs Libbe 3–2
    [6, 5, 1, 3, '2025-02-08'], // Blau vs Dave 1-3
    [2, 4, 1, 3, '2025-02-08'], // Kappe vs Snabben 1–3
    // GW3
    [6, 3, 3, 1, '2025-02-15'], // Blau vs Torre 3-1
    [4, 7, 3, 0, '2025-02-15'], // Snabben vs Affe 3-0
    [2, 1, 3, 1, '2025-02-15'], // Kappe vs Libbe 3–1
    // GW4
    [6, 7, 0, 3, '2025-02-22'], // Blau vs Affe 0-3
    [3, 2, 3, 1, '2025-02-22'], // Torre vs Kappe 3-1
    [5, 4, 3, 1, '2025-02-22']  // Dave vs Snabben 3-1
  ];

  matches.forEach(([player1_id, player2_id, player1_legs, player2_legs, date]) => {
    const leg_plus = player1_legs - player2_legs; // 🟢 Beräkna leg_plus

    db.run(`
      INSERT INTO matches (player1_id, player2_id, player1_legs, player2_legs, leg_plus, date) 
      VALUES (?, ?, ?, ?, ?, ?)`, 
      [player1_id, player2_id, player1_legs, player2_legs, leg_plus, date]
    );

    // Uppdatera statistik för spelare 1
    db.run(`
      UPDATE players 
      SET legs_won = legs_won + ?, 
          legs_lost = legs_lost + ?, 
          matches_played = matches_played + 1,
          leg_plus = leg_plus + ? 
      WHERE player_id = ?`,
      [player1_legs, player2_legs, leg_plus, player1_id]
    );

    // Uppdatera statistik för spelare 2
    db.run(`
      UPDATE players 
      SET legs_won = legs_won + ?, 
          legs_lost = legs_lost + ?, 
          matches_played = matches_played + 1,
          leg_plus = leg_plus - ? 
      WHERE player_id = ?`,
      [player2_legs, player1_legs, leg_plus, player2_id]
    );

    // Uppdatera poängsystem
    if (player1_legs > player2_legs) {
      db.run('UPDATE players SET points = points + 1 WHERE player_id = ?', [player1_id]);
    } else if (player2_legs > player1_legs) {
      db.run('UPDATE players SET points = points + 1 WHERE player_id = ?', [player2_id]);
    }
  });

  console.log("Database initialized with players and match results.");
});
