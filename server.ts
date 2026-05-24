import express from "express";
import path from "path";
import fs from "fs";
import session from "express-session";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import bcrypt from "bcryptjs";
import {
  initializeDatabase,
  getUserByEmail,
  getUserById,
  createUser,
  getAllMusic,
  addMusic,
  deleteMusic,
  isUsingLocalFallback
} from "./database";

// Extend express-session SessionData interface to support user roles and properties
declare module "express-session" {
  interface SessionData {
    user?: {
      id: number;
      nom: string;
      email: string;
      role: "admin" | "visiteur";
    };
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Ensure uploads directory and sub-directories exist
  const uploadsDir = path.join(process.cwd(), "uploads");
  const imagesDir = path.join(uploadsDir, "images");
  const musicDir = path.join(uploadsDir, "music");

  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
  if (!fs.existsSync(musicDir)) fs.mkdirSync(musicDir, { recursive: true });

  // Initialize Database (attempts MySQL, falls back to local JSON)
  await initializeDatabase();

  // Middleware for parsing JSON and urlencoded request bodies
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Session State Configuration
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "musicbox-super-secret-key-13579",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false, // In preview Cloud Run behind reverse proxy, false is standard for dev
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
        sameSite: "lax",
      },
    })
  );

  // Serve uploads folder as static files
  app.use("/uploads", express.static(uploadsDir));

  // Logger Middleware
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  /* Multer file upload setup */
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      if (file.fieldname === "image") {
        cb(null, imagesDir);
      } else if (file.fieldname === "file") {
        cb(null, musicDir);
      } else {
        cb(null, uploadsDir);
      }
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const nameWithoutExt = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, "-");
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, `${file.fieldname}-${nameWithoutExt}-${uniqueSuffix}${ext}`);
    },
  });

  const upload = multer({
    storage: storage,
    limits: {
      fileSize: 20 * 1024 * 1024, // 20 MB max file upload size
    },
    fileFilter: (req, file, cb) => {
      if (file.fieldname === "image") {
        // Accept only typical image types
        if (file.mimetype.startsWith("image/")) {
          cb(null, true);
        } else {
          cb(new Error("Le visuel doit être un fichier image (.png, .jpg, .jpeg, .webp, .gif)"));
        }
      } else if (file.fieldname === "file") {
        // Accept typical music types
        if (file.mimetype.startsWith("audio/")) {
          cb(null, true);
        } else {
          cb(new Error("Le fichier audio doit être une musique de format valide (.mp3, .wav, .ogg, .m4a)"));
        }
      } else {
        cb(null, true);
      }
    },
  });

  const uploadFilesMiddleware = upload.fields([
    { name: "image", maxCount: 1 },
    { name: "file", maxCount: 1 },
  ]);

  /* --- Authentication & Role Middlewares --- */

  const isAuthenticated = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.session && req.session.user) {
      next();
    } else {
      res.status(401).json({ error: "Non autorisé. Veuillez vous connecter." });
    }
  };

  const isAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.session && req.session.user && req.session.user.role === "admin") {
      next();
    } else {
      res.status(403).json({ error: "Accès interdit - Rôle administrateur requis." });
    }
  };

  /* --- API Endpoints --- */

  // POST /register : Inscription visiteur
  app.post("/register", async (req, res) => {
    try {
      const { nom, email, mdp } = req.body;

      // Validation
      if (!nom || !email || !mdp) {
        return res.status(400).json({ error: "Tous les champs (nom, email, mdp) sont requis." });
      }

      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail.includes("@")) {
        return res.status(400).json({ error: "Format de l'email invalide." });
      }

      if (mdp.length < 5) {
        return res.status(400).json({ error: "Le mot de passe doit faire au moins 5 caractères." });
      }

      // Check if user already exists
      const existingUser = await getUserByEmail(cleanEmail);
      if (existingUser) {
        return res.status(400).json({ error: "Cette adresse email est déjà enregistrée." });
      }

      // Create new visitor user
      const user = await createUser(nom.trim(), cleanEmail, mdp, "visiteur");

      // Log them in immediately via Session
      req.session.user = {
        id: user.id,
        nom: user.nom,
        email: user.email,
        role: user.role,
      };

      res.status(201).json({
        message: "Compte créé et connecté avec succès.",
        user: req.session.user,
      });
    } catch (err: any) {
      console.error("Erreur lors de l'inscription:", err);
      res.status(500).json({ error: "Une erreur interne s'est produite lors de l'inscription." });
    }
  });

  // POST /login : Authentification sécurisée
  app.post("/login", async (req, res) => {
    try {
      const { email, mdp } = req.body;

      if (!email || !mdp) {
        return res.status(400).json({ error: "L'email et le mot de passe sont requis." });
      }

      const cleanEmail = email.trim().toLowerCase();
      const user = await getUserByEmail(cleanEmail);

      if (!user) {
        return res.status(401).json({ error: "Identifiants invalides." });
      }

      // Validate bcrypt password
      const isMatch = await bcrypt.compare(mdp, user.mdp);
      if (!isMatch) {
        return res.status(401).json({ error: "Identifiants invalides." });
      }

      // Save user to session
      req.session.user = {
        id: user.id,
        nom: user.nom,
        email: user.email,
        role: user.role,
      };

      res.json({
        message: "Connexion réussie.",
        user: req.session.user,
      });
    } catch (err: any) {
      console.error("Erreur lors de la connexion:", err);
      res.status(500).json({ error: "Une erreur interne s'est produite lors de la connexion." });
    }
  });

  // POST /logout : Déconnexion
  app.post("/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Erreur lors de la déconnexion:", err);
        return res.status(500).json({ error: "Impossible de détruire la session." });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true, message: "Déconnexion réussie." });
    });
  });

  // GET /check-auth : Vérification de la session active
  app.get("/check-auth", (req, res) => {
    if (req.session && req.session.user) {
      res.json({ loggedIn: true, user: req.session.user });
    } else {
      res.json({ loggedIn: false });
    }
  });

  // GET /music : Contenu public
  app.get("/music", async (req, res) => {
    try {
      const list = await getAllMusic();
      res.json(list);
    } catch (err: any) {
      console.error("Erreur récupération de la musique:", err);
      res.status(500).json({ error: "Erreur lors du chargement des musiques." });
    }
  });

  // POST /music : Ajouter une musique (Admin uniquement) avec upload de fichiers
  app.post("/music", isAdmin, (req, res) => {
    uploadFilesMiddleware(req, res, async (err) => {
      if (err instanceof multer.MulterError) {
        console.error("Multer image/audio upload error:", err);
        return res.status(400).json({ error: `Erreur d'upload: ${err.message}` });
      } else if (err) {
        console.error("General upload error:", err);
        return res.status(400).json({ error: err.message });
      }

      try {
        const { titre, artiste } = req.body;

        if (!titre || !artiste) {
          return res.status(400).json({ error: "Le titre et l'artiste sont requis." });
        }

        // Handle uploaded files
        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
        const imageFile = files && files["image"] ? files["image"][0] : undefined;
        const mainFile = files && files["file"] ? files["file"][0] : undefined;

        if (!mainFile) {
          return res.status(400).json({ error: "Le fichier audio de la musique (.mp3) est requis." });
        }

        // Relative path URLs for client rendering
        const finalImagePath = imageFile
          ? `/uploads/images/${imageFile.filename}`
          : "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=60"; // fallback

        const finalFilePath = `/uploads/music/${mainFile.filename}`;

        const newMusic = await addMusic(
          titre.trim(),
          artiste.trim(),
          finalImagePath,
          finalFilePath
        );

        res.status(201).json({
          message: "Musique ajoutée avec succès.",
          music: newMusic,
        });
      } catch (dbErr: any) {
        console.error("Database save error:", dbErr);
        res.status(500).json({ error: "Erreur d'enregistrement en base de données." });
      }
    });
  });

  // DELETE /music/:id : Supprimer une musique (Admin uniquement)
  app.delete("/music/:id", isAdmin, async (req, res) => {
    try {
      const musicId = parseInt(req.params.id, 10);
      if (isNaN(musicId)) {
        return res.status(400).json({ error: "ID de musique invalide." });
      }

      // Check if files exist to clean them up (optional, nice-to-have clean development practice)
      const list = await getAllMusic();
      const trackToDelete = list.find((m) => m.id === musicId);

      const success = await deleteMusic(musicId);
      
      if (!success) {
        return res.status(404).json({ error: "Musique introuvable." });
      }

      // Cleanup files on disk if they are local
      if (trackToDelete) {
        if (trackToDelete.image && trackToDelete.image.startsWith("/uploads/")) {
          const imgLoc = path.join(process.cwd(), trackToDelete.image);
          if (fs.existsSync(imgLoc)) {
            fs.unlink(imgLoc, (err) => { if (err) console.error("Error unlinking cover image:", err); });
          }
        }
        if (trackToDelete.file && trackToDelete.file.startsWith("/uploads/")) {
          const fileLoc = path.join(process.cwd(), trackToDelete.file);
          if (fs.existsSync(fileLoc)) {
            fs.unlink(fileLoc, (err) => { if (err) console.error("Error unlinking audio track:", err); });
          }
        }
      }

      res.json({ success: true, message: "Musique supprimée avec succès." });
    } catch (err: any) {
      console.error("Erreur suppression musique:", err);
      res.status(500).json({ error: "Erreur lors de la suppression de la musique." });
    }
  });

  // Admin and Visiteur DB Mode Indicator Route
  app.get("/api/db-status", (req, res) => {
    res.json({
      localFallback: isUsingLocalFallback(),
      databaseName: isUsingLocalFallback() ? "In-Memory/JSON File Database" : "Production MySQL Server",
    });
  });

  /* --- Vite Integration or Static App Delivery --- */

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 [MusicBox Backend] Serveur démarré successfully sur le port ${PORT}`);
    console.log(`🌐 Mode: ${process.env.NODE_ENV || "development"}`);
  });
}

startServer().catch((error) => {
  console.error("❌ Échec critique lors du démarrage du serveur Express:", error);
});
