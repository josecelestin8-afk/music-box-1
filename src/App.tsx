import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Upload,
  Trash2,
  Music,
  User,
  LogOut,
  Plus,
  Search,
  Lock,
  Mail,
  FolderOpen,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Disc,
  Database,
  Volume1,
  Sparkles,
  Info
} from "lucide-react";

interface UserType {
  id: number;
  nom: string;
  email: string;
  role: "admin" | "visiteur";
}

interface MusicType {
  id: number;
  titre: string;
  artiste: string;
  image: string;
  file: string;
}

export default function App() {
  // Database status fetched from back-end
  const [dbStatus, setDbStatus] = useState({ localFallback: true, databaseName: "" });

  // Authentication states
  const [user, setUser] = useState<UserType | null>(null);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({ nom: "", email: "", mdp: "" });
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Music storage state
  const [musicList, setMusicList] = useState<MusicType[]>([]);
  const [filteredMusic, setFilteredMusic] = useState<MusicType[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Playback Control states
  const [currentTrack, setCurrentTrack] = useState<MusicType | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);

  // Admin section file upload states
  const [uploadForm, setUploadForm] = useState({ titre: "", artiste: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [adminMode, setAdminMode] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Ref tags
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  // On mount check auth and fetch tracks
  useEffect(() => {
    checkAuthentication();
    fetchMusicDatabase();
    fetchDbStatus();
  }, []);

  // Filter music on search changes
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredMusic(musicList);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredMusic(
        musicList.filter(
          (m) =>
            m.titre.toLowerCase().includes(query) ||
            m.artiste.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, musicList]);

  // Audio effect synchronized sync
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch((err) => {
          console.log("Audio reproduction interrupted:", err);
          setIsPlaying(false);
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentTrack]);

  // Handle Volume change
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const fetchDbStatus = async () => {
    try {
      const res = await fetch("/api/db-status");
      if (res.ok) {
        const data = await res.json();
        setDbStatus(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const checkAuthentication = async () => {
    try {
      const res = await fetch("/check-auth");
      if (res.ok) {
        const data = await res.json();
        if (data.loggedIn) {
          setUser(data.user);
        }
      }
    } catch (err) {
      console.error("Auth check failed:", err);
    }
  };

  const fetchMusicDatabase = async () => {
    try {
      const res = await fetch("/music");
      if (res.ok) {
        const data = await res.json();
        setMusicList(data);
        setFilteredMusic(data);
        // Autoplay initial track setup if empty
        if (data.length > 0 && !currentTrack) {
          setCurrentTrack(data[0]);
        }
      }
    } catch (err) {
      console.error("Music load error:", err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    setIsLoading(true);

    try {
      const res = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authForm.email, mdp: authForm.mdp }),
      });

      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        setAuthSuccess("Connexion réussie !");
        setAuthForm({ nom: "", email: "", mdp: "" });
      } else {
        setAuthError(data.error || "Échec d'authentification.");
      }
    } catch (err) {
      setAuthError("Erreur lors de la connexion au serveur.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    setIsLoading(true);

    try {
      const res = await fetch("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authForm),
      });

      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        setAuthSuccess("Inscription complétée !");
        setAuthForm({ nom: "", email: "", mdp: "" });
      } else {
        setAuthError(data.error || "Échec d'inscription.");
      }
    } catch (err) {
      setAuthError("Erreur lors de la connexion au serveur.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const res = await fetch("/logout", { method: "POST" });
      if (res.ok) {
        setUser(null);
        setAdminMode(false);
        setCurrentTrack(null); // Reset current track on logout
        setIsPlaying(false);
        setAuthSuccess("Vous avez été déconnecté.");
        setTimeout(() => setAuthSuccess(""), 5000);
      }
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Music upload
  const handleMusicUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError("");
    setUploadSuccess("");

    if (!uploadForm.titre || !uploadForm.artiste) {
      setUploadError("Le titre et l'artiste sont obligatoires.");
      return;
    }
    if (!musicFile) {
      setUploadError("Un fichier audio (.mp3) est obligatoire.");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("titre", uploadForm.titre);
    formData.append("artiste", uploadForm.artiste);
    if (imageFile) {
      formData.append("image", imageFile);
    }
    formData.append("file", musicFile);

    try {
      const res = await fetch("/music", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setUploadSuccess("Musique ajoutée avec succès au catalogue !");
        setUploadForm({ titre: "", artiste: "" });
        setImageFile(null);
        setMusicFile(null);
        setImagePreview(null);
        fetchMusicDatabase(); // Refresh track catalogue
      } else {
        setUploadError(data.error || "Erreur de chargement.");
      }
    } catch (err) {
      setUploadError("Erreur de connexion serveur pour l'upload.");
    } finally {
      setIsUploading(false);
    }
  };

  // Track deletion
  const handleDeleteTrack = async (id: number) => {
    if (!confirm("Voulez-vous vraiment supprimer cette musique définitivement ?")) {
      return;
    }

    try {
      const res = await fetch(`/music/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        fetchMusicDatabase();
        if (currentTrack?.id === id) {
          setCurrentTrack(null);
          setIsPlaying(false);
        }
      } else {
        alert(data.error || "Impossible de supprimer.");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur de connexion lors de la tentative de suppression.");
    }
  };

  // Select track to play
  const selectTrack = (track: MusicType) => {
    if (currentTrack?.id === track.id) {
      // If same track, just toggle play/pause
      setIsPlaying(!isPlaying);
    } else {
      setCurrentTrack(track);
      setIsPlaying(true);
    }
  };

  // Custom audio playback events
  const onTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const onLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (timelineRef.current && audioRef.current && duration > 0) {
      const rect = timelineRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const progressPercent = Math.max(0, Math.min(1, clickX / rect.width));
      audioRef.current.currentTime = progressPercent * duration;
      setCurrentTime(progressPercent * duration);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Navigation track cycle commands
  const playNextTrack = () => {
    if (musicList.length === 0) return;
    const currentIndex = musicList.findIndex((m) => m.id === currentTrack?.id);
    let nextIndex = currentIndex - 1; // Since list is reversed (newest first)
    if (nextIndex < 0) nextIndex = musicList.length - 1;
    setCurrentTrack(musicList[nextIndex]);
    setIsPlaying(true);
  };

  const playPrevTrack = () => {
    if (musicList.length === 0) return;
    const currentIndex = musicList.findIndex((m) => m.id === currentTrack?.id);
    let prevIndex = currentIndex + 1;
    if (prevIndex >= musicList.length) prevIndex = 0;
    setCurrentTrack(musicList[prevIndex]);
    setIsPlaying(true);
  };

  // Render Player Component (shared between Visitor and Admin)
  const AudioPlayer = () => (
    <div id="side-player-column" className="w-full lg:w-80 flex-shrink-0">
      <div className="sticky top-28 bg-neutral-900/60 border border-neutral-800/80 rounded-2xl p-6 shadow-xl flex flex-col items-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 via-indigo-500 to-cyan-500" />

        {currentTrack ? (
          <div className="w-full flex flex-col items-center">

            {/* Mode Subtitle indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-950/40 text-purple-400 border border-purple-900/50 text-[10px] uppercase font-mono tracking-wider font-semibold mb-6">
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span>Lecture Premium</span>
            </div>

            {/* Cover disc circle spinner animation */}
            <div className="relative w-44 h-44 rounded-2xl overflow-hidden shadow-2xl shadow-purple-950/50 mb-6 group border border-neutral-800">
              <img
                src={currentTrack.image}
                alt={currentTrack.titre}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className={`absolute inset-0 bg-neutral-950/20 backdrop-blur-[2px] transition-opacity duration-300 ${isPlaying ? "opacity-0" : "opacity-100"
                }`} />

              {/* Rotating center record decoration */}
              <div className={`absolute bottom-3 right-3 w-8 h-8 bg-neutral-950/80 border border-neutral-800/60 rounded-full flex items-center justify-center ${isPlaying ? "animate-spin [animation-duration:4s]" : ""
                }`}>
                <Disc className="w-5 h-5 text-indigo-400" />
              </div>
            </div>

            {/* Track Details text */}
            <div className="text-center w-full px-2 mb-6">
              <h3 className="text-lg font-bold text-white truncate leading-tight tracking-tight">
                {currentTrack.titre}
              </h3>
              <p className="text-xs text-neutral-400 truncate mt-1">
                {currentTrack.artiste}
              </p>
            </div>

            {/* Timeline slide progress controller bar */}
            <div className="w-full space-y-2 mb-6">
              <div
                ref={timelineRef}
                onClick={handleSeek}
                className="h-1.5 w-full bg-neutral-800 rounded-full cursor-pointer relative overflow-hidden group/timeline"
              >
                <div
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full group-hover/timeline:from-purple-400 group-hover/timeline:to-indigo-400"
                />
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono text-neutral-500">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Player Controls Buttons */}
            <div className="flex items-center justify-center gap-6 mb-8">
              <button
                onClick={playPrevTrack}
                className="text-neutral-400 hover:text-white hover:scale-105 active:scale-95 transition-all p-2 cursor-pointer"
                title="Précédent"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 6h2v12H6zm3.5 6L18 6v12z" />
                </svg>
              </button>

              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-12 h-12 rounded-full bg-white hover:scale-105 active:scale-95 text-neutral-950 flex items-center justify-center shadow-lg hover:shadow-white/20 transition-all cursor-pointer"
                title={isPlaying ? "Pause" : "Lecture"}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-current text-neutral-950" />
                ) : (
                  <Play className="w-5 h-5 fill-current text-neutral-950 translate-x-0.5" />
                )}
              </button>

              <button
                onClick={playNextTrack}
                className="text-neutral-400 hover:text-white hover:scale-105 active:scale-95 transition-all p-2 cursor-pointer"
                title="Suivant"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 18l8.5-6L6 6zm9-12h2v12h-2z" />
                </svg>
              </button>
            </div>

            {/* Volume audio controllers */}
            <div className="w-full flex items-center gap-3 border-t border-neutral-800/80 pt-5">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="text-neutral-400 hover:text-white transition-all cursor-pointer"
                title={isMuted ? "Rétablir le son" : "Couper le son"}
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4 text-red-400" />
                ) : volume < 0.3 ? (
                  <Volume1 className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => {
                  setVolume(parseFloat(e.target.value));
                  setIsMuted(false);
                }}
                className="flex-1 h-1 bg-neutral-800 rounded-full appearance-none accent-purple-500 cursor-pointer"
              />
            </div>

          </div>
        ) : (
          // Empty player display placeholder
          <div className="py-12 text-center text-neutral-500 w-full flex flex-col items-center">
            <div className="w-20 h-20 rounded-full border border-neutral-800 flex items-center justify-center mb-4 text-neutral-600 bg-neutral-950">
              <Music className="w-8 h-8" />
            </div>
            <h4 className="text-sm font-semibold text-neutral-300">Aucun morceau actif</h4>
            <p className="text-xs text-neutral-400 mt-2 px-6">
              Sélectionnez une musique dans la liste pour l'écouter.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans flex flex-col selection:bg-purple-600/30 selection:text-purple-300">

      {/* Dynamic Native Audio Element */}
      {currentTrack && (
        <audio
          ref={audioRef}
          src={currentTrack.file}
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          onEnded={playNextTrack}
        />
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800/60 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-purple-900/40">
              <Music className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
                Music Box
              </h1>
              <p className="text-xs text-neutral-400 font-mono">Maestro Premium Sound v1.2</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono self-start md:self-auto">
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-neutral-300">
                  Rôle: <strong className={`uppercase ${user.role === "admin" ? "text-purple-400" : "text-cyan-400"}`}>{user.role}</strong>
                </span>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 hover:bg-red-950 hover:text-red-300 border border-neutral-800 hover:border-red-900 rounded-lg transition-all text-neutral-300 group cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  <span>Se déconnecter</span>
                </button>
              </div>
            ) : (
              <span className="text-neutral-500">Non connecté</span>
            )}
          </div>

        </div>
      </header>

      {/* Main content - Centered when not logged in */}
      <main className={`flex-1 w-full max-w-7xl mx-auto px-6 py-8 flex flex-col ${!user ? 'items-center justify-center' : 'lg:flex-row'} gap-8`}>

        {/* When NOT logged in - Centered auth form */}
        {!user ? (
          <div className="w-full max-w-md mx-auto">
            <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800/80 p-8 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full filter blur-3xl -z-10" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/10 rounded-full filter blur-3xl -z-10" />

              <div className="flex border-b border-neutral-800 mb-6">
                <button
                  onClick={() => { setAuthTab("login"); setAuthError(""); }}
                  className={`flex-1 pb-4 text-center font-medium border-b-2 text-sm transition-all cursor-pointer ${authTab === "login"
                    ? "border-purple-500 text-purple-400 font-semibold"
                    : "border-transparent text-neutral-400 hover:text-neutral-200"
                    }`}
                >
                  Connexion Sécurisée
                </button>
                <button
                  onClick={() => { setAuthTab("register"); setAuthError(""); }}
                  className={`flex-1 pb-4 text-center font-medium border-b-2 text-sm transition-all cursor-pointer ${authTab === "register"
                    ? "border-purple-500 text-purple-400 font-semibold"
                    : "border-transparent text-neutral-400 hover:text-neutral-200"
                    }`}
                >
                  Créer un Compte
                </button>
              </div>

              {authError && (
                <div className="mb-4 p-4 rounded-xl bg-red-950/40 text-red-400 text-sm border border-red-900/50 flex items-center gap-3">
                  <XCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{authError}</span>
                </div>
              )}
              {authSuccess && (
                <div className="mb-4 p-4 rounded-xl bg-emerald-950/40 text-emerald-400 text-sm border border-emerald-900/50 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <span>{authSuccess}</span>
                </div>
              )}

              <form onSubmit={authTab === "login" ? handleLogin : handleRegister} className="space-y-4">

                {authTab === "register" && (
                  <div>
                    <label className="block text-xs uppercase font-mono tracking-wider text-neutral-400 mb-1.5 font-medium">Nom complet</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                      <input
                        type="text"
                        required
                        placeholder="Ex: Jean Dupont"
                        value={authForm.nom}
                        onChange={(e) => setAuthForm({ ...authForm, nom: e.target.value })}
                        className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm text-neutral-200 transition-all placeholder:text-neutral-600"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs uppercase font-mono tracking-wider text-neutral-400 mb-1.5 font-medium">Adresse Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input
                      type="email"
                      required
                      placeholder="votre-adresse@email.com"
                      value={authForm.email}
                      onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                      className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm text-neutral-200 transition-all placeholder:text-neutral-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase font-mono tracking-wider text-neutral-400 mb-1.5 font-medium">Mot de passe</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={authForm.mdp}
                      onChange={(e) => setAuthForm({ ...authForm, mdp: e.target.value })}
                      className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm text-neutral-200 transition-all placeholder:text-neutral-600"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-500 text-white font-medium text-sm hover:opacity-95 active:scale-99 transition-all shadow-md shadow-purple-900/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? "Veuillez patienter..." : authTab === "login" ? "Se Connecter" : "Créer mon Compte"}
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* USER IS LOGGED IN - Show Dashboard with left and right columns */
          <>
            {/* LEFT COLUMN: Dashboard */}
            <div className="flex-1 space-y-8 lg:max-w-2xl xl:max-w-3xl">
              {/* Profile Card */}
              <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-center">
                    {user.role === "admin" ? (
                      <ShieldCheck className="w-6 h-6 text-purple-400" />
                    ) : (
                      <User className="w-6 h-6 text-cyan-400" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Salut, {user.nom} !</h2>
                    <p className="text-xs text-neutral-400">
                      Connecté en tant que{" "}
                      <span className={`font-mono font-medium ${user.role === "admin" ? "text-purple-400" : "text-cyan-400"}`}>
                        {user.role === "admin" ? "Administrateur" : "Visiteur standard"}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Admin mode toggle - Only visible for admin */}
                {user.role === "admin" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAdminMode(false)}
                      className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all border cursor-pointer ${!adminMode
                        ? "bg-purple-600 text-white border-purple-500"
                        : "bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white"
                        }`}
                    >
                      Mode Écoute
                    </button>
                    <button
                      onClick={() => setAdminMode(true)}
                      className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all border cursor-pointer ${adminMode
                        ? "bg-purple-600 text-white border-purple-500"
                        : "bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white"
                        }`}
                    >
                      Console Admin ({musicList.length})
                    </button>
                  </div>
                )}
              </div>

              {/* Search Bar - Visible for both roles */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Rechercher par titre ou artiste..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-neutral-900/60 border border-neutral-800/80 hover:border-neutral-700/80 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm text-neutral-200 transition-all placeholder:text-neutral-500"
                />
              </div>

              {/* Conditional Display: Admin Mode OR Listener Mode */}
              {adminMode && user.role === "admin" ? (
                /* ADMIN DASHBOARD - Upload and Management */
                <div className="space-y-6">

                  {/* Music Upload card */}
                  <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800/80 p-6">
                    <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                      <Plus className="w-5 h-5 text-purple-400" />
                      Ajouter une Nouvelle Musique
                    </h3>

                    {uploadError && (
                      <div className="mb-4 p-4 rounded-xl bg-red-950/40 text-red-400 text-xs border border-red-900/50 flex items-center gap-2">
                        <XCircle className="w-4 h-4" />
                        <span>{uploadError}</span>
                      </div>
                    )}

                    {uploadSuccess && (
                      <div className="mb-4 p-4 rounded-xl bg-emerald-950/40 text-emerald-400 text-xs border border-emerald-900/50 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{uploadSuccess}</span>
                      </div>
                    )}

                    <form onSubmit={handleMusicUpload} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1.5 font-medium">Titre</label>
                          <input
                            type="text"
                            required
                            placeholder="Ex: Moonlight Sonata"
                            value={uploadForm.titre}
                            onChange={(e) => setUploadForm({ ...uploadForm, titre: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm text-neutral-200 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1.5 font-medium">Artiste</label>
                          <input
                            type="text"
                            required
                            placeholder="Ex: Ludwig van Beethoven"
                            value={uploadForm.artiste}
                            onChange={(e) => setUploadForm({ ...uploadForm, artiste: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm text-neutral-200 transition-all"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1.5 font-medium">
                            Pochette <span className="text-neutral-500">(Optionnel)</span>
                          </label>
                          <label className="flex flex-col items-center justify-center px-4 py-5 bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 rounded-xl cursor-pointer transition-all">
                            <Upload className="w-5 h-5 text-neutral-500 mb-1" />
                            <span className="text-xs text-neutral-400 text-center">
                              {imageFile ? imageFile.name : "PNG/JPG"}
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const f = e.target.files?.[0] || null;
                                setImageFile(f);
                                setImagePreview(f ? URL.createObjectURL(f) : null);
                              }}
                              className="hidden"
                            />
                          </label>
                        </div>
                        <div>
                          <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1.5 font-medium">
                            Fichier Audio <span className="text-red-500">*</span>
                          </label>
                          <label className="flex flex-col items-center justify-center px-4 py-5 bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 rounded-xl cursor-pointer transition-all">
                            <FolderOpen className="w-5 h-5 text-indigo-400 mb-1" />
                            <span className="text-xs text-neutral-400 text-center">
                              {musicFile ? musicFile.name : "MP3/WAV/OGG"}
                            </span>
                            <input
                              type="file"
                              required
                              accept="audio/*"
                              onChange={(e) => setMusicFile(e.target.files?.[0] || null)}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isUploading}
                        className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55"
                      >
                        <Upload className="w-4 h-4" />
                        {isUploading ? "Upload en cours..." : "Publier"}
                      </button>
                    </form>
                  </div>

                  {/* Track Management Table */}
                  <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800/80 p-6 overflow-hidden">
                    <h3 className="text-base font-semibold text-white mb-4">
                      Gestion du Catalogue ({musicList.length})
                    </h3>

                    {musicList.length === 0 ? (
                      <p className="text-sm text-neutral-500 py-4">Aucune musique dans le système.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            {/* </td> */}
                            <tr className="border-b border-neutral-800 text-xs font-mono text-neutral-400 uppercase">
                              <th className="pb-3 pr-4">Visuel</th>
                              <th className="pb-3 px-4">Titre / Artiste</th>
                              <th className="pb-3 pl-4 text-right">Actions</th>
                            </tr>
                            {/* </td> */}
                          </thead>
                          <tbody className="divide-y divide-neutral-800/60 text-sm">
                            {musicList.map((track) => (
                              <tr key={track.id} className="hover:bg-neutral-900/40">
                                <td className="py-3 pr-4">
                                  <div className="w-10 h-10 rounded-lg overflow-hidden border border-neutral-800/80">
                                    <img src={track.image} alt={track.titre} className="w-full h-full object-cover" />
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-semibold text-neutral-100">{track.titre}</div>
                                  <div className="text-xs text-neutral-400">{track.artiste}</div>
                                </td>
                                <td className="py-3 pl-4 text-right">
                                  <button
                                    onClick={() => handleDeleteTrack(track.id)}
                                    className="p-2 bg-neutral-950 border border-neutral-800 rounded-lg text-red-400 hover:text-white hover:bg-red-950/80 transition-all cursor-pointer"
                                    title="Supprimer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* ADMIN ALSO SEES MUSIC LIST (for quick playback) */}
                  <div className="space-y-3">
                    <h3 className="text-sm uppercase tracking-wider font-mono text-neutral-400 font-medium">
                      Bibliothèque Musicale ({filteredMusic.length} morceaux)
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      {filteredMusic.map((track) => (
                        <div
                          key={track.id}
                          onClick={() => selectTrack(track)}
                          className={`p-4 rounded-xl border flex gap-4 transition-all cursor-pointer ${currentTrack?.id === track.id
                            ? "bg-purple-950/25 border-purple-500/80"
                            : "bg-neutral-900/40 hover:bg-neutral-900/80 border-neutral-800/80"
                            }`}
                        >
                          <div className="w-12 h-12 rounded-lg overflow-hidden border border-neutral-800 flex-shrink-0">
                            <img src={track.image} alt={track.titre} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className={`text-sm font-semibold truncate ${currentTrack?.id === track.id ? "text-purple-300" : "text-neutral-100"}`}>
                              {track.titre}
                            </h4>
                            <p className="text-xs text-neutral-400 truncate">{track.artiste}</p>
                          </div>
                          <div className="flex items-center">
                            <div className={`w-8 h-8 rounded-full border flex items-center justify-center ${currentTrack?.id === track.id && isPlaying
                              ? "bg-purple-600 border-purple-500 text-white"
                              : "bg-neutral-950 border-neutral-800 text-neutral-400"
                              }`}>
                              {currentTrack?.id === track.id && isPlaying ? (
                                <Pause className="w-3.5 h-3.5" />
                              ) : (
                                <Play className="w-3.5 h-3.5 translate-x-0.5" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              ) : (
                /* LISTENER MODE (Visitor OR Admin in listener mode) - Music Library */
                <div className="space-y-3">
                  <h3 className="text-sm uppercase tracking-wider font-mono text-neutral-400 font-medium flex items-center justify-between">
                    <span>Bibliothèque Musicale</span>
                    <span className="text-neutral-600 text-xs font-normal">
                      ({filteredMusic.length} morceaux)
                    </span>
                  </h3>

                  {filteredMusic.length === 0 ? (
                    <div className="py-12 text-center rounded-2xl bg-neutral-900/20 border border-neutral-800/50">
                      <Music className="w-8 h-8 text-neutral-700 mx-auto mb-2" />
                      <p className="text-sm text-neutral-400">Aucun résultat trouvé.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {filteredMusic.map((track) => (
                        <div
                          key={track.id}
                          onClick={() => selectTrack(track)}
                          className={`p-4 rounded-xl border flex gap-4 transition-all cursor-pointer ${currentTrack?.id === track.id
                            ? "bg-purple-950/25 border-purple-500/80"
                            : "bg-neutral-900/40 hover:bg-neutral-900/80 border-neutral-800/80"
                            }`}
                        >
                          <div className="w-14 h-14 rounded-lg overflow-hidden border border-neutral-800 flex-shrink-0">
                            <img src={track.image} alt={track.titre} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className={`text-sm font-semibold truncate ${currentTrack?.id === track.id ? "text-purple-300" : "text-neutral-100"}`}>
                              {track.titre}
                            </h4>
                            <p className="text-xs text-neutral-400 truncate">{track.artiste}</p>
                          </div>
                          <div className="flex items-center justify-center">
                            <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${currentTrack?.id === track.id && isPlaying
                              ? "bg-purple-600 border-purple-500 text-white"
                              : "bg-neutral-950 border-neutral-800 text-neutral-400 group-hover:border-purple-500/80"
                              }`}>
                              {currentTrack?.id === track.id && isPlaying ? (
                                <Pause className="w-3.5 h-3.5" />
                              ) : (
                                <Play className="w-3.5 h-3.5 translate-x-0.5" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Audio Player - ONLY SHOW WHEN USER IS LOGGED IN */}
            <AudioPlayer />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-neutral-950 border-t border-neutral-800/40 py-6 px-6 text-center text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto">
          <p>© 2026 Music Box Studio. Tous droits réservés.</p>
        </div>
      </footer>
    </div >
  );
}