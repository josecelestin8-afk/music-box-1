import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const DATA_DIR = path.join(process.cwd(), "data");
const JSON_DB_PATH = path.join(DATA_DIR, "db.json");

// Define interfaces
export interface User {
  id: number;
  nom: string;
  email: string;
  mdp: string;
  role: "admin" | "visiteur";
}

export interface Music {
  id: number;
  titre: string;
  artiste: string;
  image: string; // File path or URL
  file: string;  // File path or URL
}

interface JsonDatabase {
  users: User[];
  music: Music[];
  userAutoId: number;
  musicAutoId: number;
}

// Database Connection Pools or Local Configs
let pool: mysql.Pool | null = null;
let useLocalFallback = true;

// Pre-seeded Demo Data
const DEFAULT_DEMO_MUSIC: Omit<Music, "id">[] = [
  {
    titre: "Midnight Drive",
    artiste: "Synthwave Horizon",
    image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60",
    file: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  },
  {
    titre: "Summer Chillout",
    artiste: "Acoustic Sunset",
    image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60",
    file: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  },
  {
    titre: "Cyberpunk Alley",
    artiste: "Neon Grid",
    image: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=60",
    file: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
  }
];

// Initialize MySQL Pool
export async function initializeDatabase() {
  // Use requested MySQL credentials with potential env file overrides
  const host = process.env.DB_HOST || process.env.MYSQL_HOST || "localhost";
  const user = process.env.DB_USER || process.env.MYSQL_USER || "root";
  const password = process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || "";
  const database = process.env.DB_NAME || process.env.MYSQL_DATABASE || "cloudmusic";
  const port = parseInt(process.env.DB_PORT || "3306", 10);

  try {
    console.log("🔄 Tentative de connexion à la base de données MySQL...");
    pool = mysql.createPool({
      host,
      user,
      password,
      database,
      port,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    // Test Connection
    const conn = await pool.getConnection();
    console.log("✅ MySQL connecté");
    conn.release();

    // Create Tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nom VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        mdp VARCHAR(255) NOT NULL,
        role ENUM('admin', 'visiteur') DEFAULT 'visiteur'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS music (
        id INT AUTO_INCREMENT PRIMARY KEY,
        titre VARCHAR(255) NOT NULL,
        artiste VARCHAR(255) NOT NULL,
        image VARCHAR(255),
        file VARCHAR(255) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    useLocalFallback = false;

    // Seed if empty
    const [users] = await pool.query<any[]>("SELECT id FROM users LIMIT 1");
    if (users.length === 0) {
      console.log("🌱 Base de données MySQL vide. Seeding des utilisateurs de démo...");
      const adminMdp = await bcrypt.hash("admin123", 10);
      const userMdp = await bcrypt.hash("user123", 10);

      await pool.query("INSERT INTO users (nom, email, mdp, role) VALUES (?, ?, ?, ?)", [
        "Administrateur",
        "admin@musicbox.fr",
        adminMdp,
        "admin",
      ]);
      await pool.query("INSERT INTO users (nom, email, mdp, role) VALUES (?, ?, ?, ?)", [
        "Jean Visiteur",
        "user@musicbox.fr",
        userMdp,
        "visiteur",
      ]);
    }

    const [music] = await pool.query<any[]>("SELECT id FROM music LIMIT 1");
    if (music.length === 0) {
      console.log("🌱 Base de donnée MySQL vide. Seeding des morceaux de démo...");
      for (const track of DEFAULT_DEMO_MUSIC) {
        await pool.query("INSERT INTO music (titre, artiste, image, file) VALUES (?, ?, ?, ?)", [
          track.titre,
          track.artiste,
          track.image,
          track.file,
        ]);
      }
    }

    return;
  } catch (err: any) {
    console.log("DB ERROR", err);
    console.warn("⚠️ Utilisation de la base locale intégrée (files/JSON) en raison de l'erreur ci-dessus.");
  }

  // Set up local file-based fallbacks
  // useLocalFallback = true;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(JSON_DB_PATH)) {
    const adminMdp = await bcrypt.hash("admin123", 10);
    const userMdp = await bcrypt.hash("user123", 10);

    const initialDb: JsonDatabase = {
      users: [
        {
          id: 1,
          nom: "Administrateur",
          email: "admin@musicbox.fr",
          mdp: adminMdp,
          role: "admin",
        },
        {
          id: 2,
          nom: "Jean Visiteur",
          email: "user@musicbox.fr",
          mdp: userMdp,
          role: "visiteur",
        },
      ],
      music: DEFAULT_DEMO_MUSIC.map((track, idx) => ({
        id: idx + 1,
        ...track,
      })),
      userAutoId: 3,
      musicAutoId: 4,
    };

    fs.writeFileSync(JSON_DB_PATH, JSON.stringify(initialDb, null, 2), "utf8");
    console.log("🌱 Base locale JSON initialisée et pré-remplie.");
  } else {
    console.log("📂 Base locale JSON chargée.");
  }
}

// Helpers for Local Database Reading/Writing
function readLocalDB(): JsonDatabase {
  try {
    const raw = fs.readFileSync(JSON_DB_PATH, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    return { users: [], music: [], userAutoId: 1, musicAutoId: 1 };
  }
}

function writeLocalDB(db: JsonDatabase) {
  fs.writeFileSync(JSON_DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

/* --- Exported API Methods to be used by Express Routes --- */

export async function getUserByEmail(email: string): Promise<User | null> {
  if (!useLocalFallback && pool) {
    const [rows] = await pool.query<any[]>("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
    if (rows.length === 0) return null;
    return rows[0] as User;
  } else {
    const db = readLocalDB();
    const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    return user || null;
  }
}

export async function getUserById(id: number): Promise<User | null> {
  if (!useLocalFallback && pool) {
    const [rows] = await pool.query<any[]>("SELECT id, nom, email, role FROM users WHERE id = ? LIMIT 1", [id]);
    if (rows.length === 0) return null;
    return rows[0] as User;
  } else {
    const db = readLocalDB();
    const user = db.users.find((u) => u.id === id);
    if (!user) return null;
    // return without password for safety or keep it
    return user;
  }
}

export async function createUser(nom: string, email: string, mdpClair: string, role: "admin" | "visiteur" = "visiteur"): Promise<User> {
  const hash = await bcrypt.hash(mdpClair, 10);
  
  if (!useLocalFallback && pool) {
    const [result] = await pool.query<any>(
      "INSERT INTO users (nom, email, mdp, role) VALUES (?, ?, ?, ?)",
      [nom, email, hash, role]
    );
    return {
      id: result.insertId,
      nom,
      email,
      mdp: hash,
      role,
    };
  } else {
    const db = readLocalDB();
    
    // Check uniqueness manually
    if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error("Cet email est déjà enregistré !");
    }

    const newUser: User = {
      id: db.userAutoId,
      nom,
      email,
      mdp: hash,
      role,
    };
    
    db.users.push(newUser);
    db.userAutoId += 1;
    writeLocalDB(db);
    return newUser;
  }
}

export async function getAllMusic(): Promise<Music[]> {
  if (!useLocalFallback && pool) {
    const [rows] = await pool.query<any[]>("SELECT * FROM music ORDER BY id DESC");
    return rows as Music[];
  } else {
    const db = readLocalDB();
    // Return newest first
    return [...db.music].reverse();
  }
}

export async function addMusic(titre: string, artiste: string, imagePath: string, filePath: string): Promise<Music> {
  if (!useLocalFallback && pool) {
    const [result] = await pool.query<any>(
      "INSERT INTO music (titre, artiste, image, file) VALUES (?, ?, ?, ?)",
      [titre, artiste, imagePath, filePath]
    );
    return {
      id: result.insertId,
      titre,
      artiste,
      image: imagePath,
      file: filePath,
    };
  } else {
    const db = readLocalDB();
    const newRecord: Music = {
      id: db.musicAutoId,
      titre,
      artiste,
      image: imagePath,
      file: filePath,
    };
    db.music.push(newRecord);
    db.musicAutoId += 1;
    writeLocalDB(db);
    return newRecord;
  }
}

export async function deleteMusic(id: number): Promise<boolean> {
  if (!useLocalFallback && pool) {
    const [result] = await pool.query<any>("DELETE FROM music WHERE id = ?", [id]);
    return result.affectedRows > 0;
  } else {
    const db = readLocalDB();
    const initialLength = db.music.length;
    db.music = db.music.filter((m) => m.id !== id);
    if (db.music.length < initialLength) {
      writeLocalDB(db);
      return true;
    }
    return false;
  }
}

export function isUsingLocalFallback(): boolean {
  return useLocalFallback;
}
