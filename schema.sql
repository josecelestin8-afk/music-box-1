-- ==========================================================
-- SCRIPT SQL POUR CRÉATION DE LA BASE DE DONNÉES MUSICBOX
-- ==========================================================

-- Création de la base de données (si elle n'existe pas)
CREATE DATABASE IF NOT EXISTS musicbox CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE musicbox;

-- ----------------------------------------------------------
-- Table 'users'
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  mdp VARCHAR(255) NOT NULL, -- Mot de passe hashé (bcrypt)
  role ENUM('admin', 'visiteur') DEFAULT 'visiteur'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table 'music'
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS music (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titre VARCHAR(255) NOT NULL,
  artiste VARCHAR(255) NOT NULL,
  image VARCHAR(255), -- Chemin vers le fichier image ou URL (ex: /uploads/images/...)
  file VARCHAR(255) NOT NULL -- Chemin vers le fichier audio (ex: /uploads/music/...)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Insertion des comptes de test par défaut
-- Note: les mots de passe sont hashés avec bcrypt (sel de 10)
-- admin@musicbox.fr -> mdp: admin123
-- user@musicbox.fr -> mdp: user123
-- ----------------------------------------------------------
INSERT INTO users (nom, email, mdp, role) VALUES 
('Administrateur', 'admin@musicbox.fr', '$2a$10$wNOn9y99lPka.T3KzGWhrOBz7E.m76a0RorZ6Rfe58eDizZf4Tsh2', 'admin')
ON DUPLICATE KEY UPDATE id=id;

INSERT INTO users (nom, email, mdp, role) VALUES 
('Jean Visiteur', 'user@m.fr', '$2a$10$q2V7SreI7H0qAep3TOnZ3OOfgT7ZtEorR57jKz9W.rMhE/yqI8D2W', 'visiteur')
ON DUPLICATE KEY UPDATE id=id;
