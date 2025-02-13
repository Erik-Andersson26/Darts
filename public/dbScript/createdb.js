const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.db');

// Initialize database
db.serialize(() => { 
  db.run('CREATE TABLE IF NOT EXISTS players(player_id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT, walk_out_song TEXT, dart_brand TEXT, points INTEGER, legs_won INTEGER, legs_lost INTEGER, matches_played INTEGER)');
  db.run('CREATE TABLE IF NOT EXISTS match(match_id INTEGER PRIMARY KEY, player1_id INTEGER, player2_id INTEGER, player1_legs INTEGER, player2_legs INTEGER, date TEXT, FOREIGN KEY (player1_id) REFERENCES players(player_id), FOREIGN KEY (player2_id) REFERENCES players(player_id))');

  // Insert sample players
  db.run('INSERT INTO players (first_name, last_name, walk_out_song, dart_brand, points, legs_won, legs_lost, matches_played) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ["Erik", "Andersson", "Ring Of Fire", "Target", 0, 0, 0, 0]);
  db.run('INSERT INTO players (first_name, last_name, walk_out_song, dart_brand, points, legs_won, legs_lost, matches_played) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ["Kasper", "Ljungström", "La Bamba", "Winmau", 0, 0, 0, 0]);
  db.run('INSERT INTO players (first_name, last_name, walk_out_song, dart_brand, points, legs_won, legs_lost, matches_played) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ["Teodor", "Hellstrand", "Sex On Fire", "Red Dragon", 0, 0, 0, 0]);
  db.run('INSERT INTO players (first_name, last_name, walk_out_song, dart_brand, points, legs_won, legs_lost, matches_played) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ["Oskar", "Axell", " ", " ", 0, 0, 0, 0]);
  db.run('INSERT INTO players (first_name, last_name, walk_out_song, dart_brand, points, legs_won, legs_lost, matches_played) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ["David", "Bergsten", " ", " ", 0, 0, 0, 0]);
  db.run('INSERT INTO players (first_name, last_name, walk_out_song, dart_brand, points, legs_won, legs_lost, matches_played) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ["David", "Ekblad", " ", " ", 0, 0, 0, 0]);
  db.run('INSERT INTO players (first_name, last_name, walk_out_song, dart_brand, points, legs_won, legs_lost, matches_played) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ["Alfred", "Berger", " ", " ", 0, 0, 0, 0]);
});