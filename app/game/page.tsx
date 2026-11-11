"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { onValue, ref, update } from "firebase/database";
import { collection, getDocs } from "firebase/firestore";
import { firestore, realtimeDb } from "@/lib/firebase";
import { Point, seededPoints } from "../../components/CityCanvas";
import VirtualJoystick, { JoystickVector } from "../../components/VirtualJoystick";

const CityCanvas = dynamic(() => import("../../components/CityCanvas"), {
  ssr: false,
  loading: () => <div className="city-3d-loading">Memuat city kit 3D…</div>,
});

type RoomMeta = {
  code: string;
  title: string;
  layout: string;
  cityTheme: string;
  seed: number;
  duration: number;
  questionIds: string[];
  status: "lobby" | "running" | "finished";
};

type Player = {
  name: string;
  joinedAt: number;
  score?: number;
  position?: { x: number; z: number };
  completedQuestions?: string[];
};

export type QuestionType = "multiple-choice" | "short-answer";
export type Question = {
  id: string;
  type: QuestionType;
  text: string;
  options: string[];
  answer: string;
  points: number;
};

// Rich default question bank used if room has no questions or offline preview
const defaultQuestions: Question[] = [
  { id: "q-1", type: "multiple-choice", text: "Planet terdekat dengan Matahari adalah?", options: ["Venus", "Mars", "Merkurius", "Bumi"], answer: "Merkurius", points: 100 },
  { id: "q-2", type: "short-answer", text: "Sebutkan ibu kota negara Indonesia.", options: [], answer: "Jakarta", points: 120 },
  { id: "q-3", type: "multiple-choice", text: "Berapa hasil dari perkalian 8 × 7?", options: ["54", "56", "64", "48"], answer: "56", points: 100 },
  { id: "q-4", type: "multiple-choice", text: "Gas apa yang paling banyak menyusun atmosfer Bumi?", options: ["Oksigen", "Nitrogen", "Karbon Dioksida", "Helium"], answer: "Nitrogen", points: 100 },
  { id: "q-5", type: "multiple-choice", text: "Monumen Nasional (Monas) berada di kota mana?", options: ["Bandung", "Surabaya", "Jakarta", "Semarang"], answer: "Jakarta", points: 80 },
  { id: "q-6", type: "multiple-choice", text: "Benua terbesar di dunia adalah?", options: ["Afrika", "Asia", "Amerika", "Eropa"], answer: "Asia", points: 100 },
  { id: "q-7", type: "short-answer", text: "Tuliskan simbol kimia untuk air murni.", options: [], answer: "H2O", points: 100 },
  { id: "q-8", type: "multiple-choice", text: "Berapa jumlah warna pada pelangi primer?", options: ["5", "6", "7", "8"], answer: "7", points: 90 },
  { id: "q-9", type: "multiple-choice", text: "Mamalia darat tercepat di dunia adalah?", options: ["Singa", "Cheetah", "Kuda", "Kancil"], answer: "Cheetah", points: 100 },
  { id: "q-10", type: "short-answer", text: "Apa judul lagu kebangsaan Indonesia?", options: [], answer: "Indonesia Raya", points: 120 },
];

export default function GamePage() {
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState<RoomMeta | null>(null);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [error, setError] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [playerId, setPlayerId] = useState("");

  // Virtual Analog Controller refs (high performance, no React re-render lag)
  const joystickRef = useRef<JoystickVector>({ x: 0, y: 0 });
  const isBrakingRef = useRef<boolean>(false);

  // Leaderboard collapse state (especially useful on mobile)
  const [isLeaderboardMinimized, setIsLeaderboardMinimized] = useState(false);

  // Questions and player progress state
  const [questions, setQuestions] = useState<Question[]>(defaultQuestions);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [playerPos, setPlayerPos] = useState<Point>({ x: 0, z: 0 });
  const [nearQuestionIndex, setNearQuestionIndex] = useState<number | null>(null);

  // Active quiz modal state
  const [activeQuizIndex, setActiveQuizIndex] = useState<number | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [shortInput, setShortInput] = useState("");
  const [quizFeedback, setQuizFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);

  // Initial load: room and player id from storage / query
  useEffect(() => {
    queueMicrotask(() => {
      const queryRoom = new URLSearchParams(window.location.search).get("room");
      const savedRoom = window.localStorage.getItem("kyunika-active-room");
      const code = (queryRoom ?? savedRoom ?? "").toUpperCase();
      setRoomCode(code);

      const savedPlayerId = window.localStorage.getItem("kyunika-player-id") ?? "";
      setPlayerId(savedPlayerId);

      if (code) {
        const savedProgress = window.localStorage.getItem(`kyunika-completed-${code}`);
        if (savedProgress) {
          try {
            setCompletedIds(JSON.parse(savedProgress) as string[]);
          } catch {
            // ignore malformed storage
          }
        }
      }
    });
  }, []);

  // Listen to room data from Realtime Database
  useEffect(() => {
    if (!realtimeDb || !roomCode) return;
    const roomRef = ref(realtimeDb, `rooms/${roomCode}`);
    return onValue(
      roomRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setRoom(null);
          setError("Room sudah tidak tersedia.");
          return;
        }
        const value = snapshot.val();
        const meta = value.meta as RoomMeta;
        setRoom(meta);
        setRemainingSeconds(meta?.duration ? Number(meta.duration) * 60 : 0);
        const playersData = (value.players ?? {}) as Record<string, Player>;
        setPlayers(playersData);
        setError("");

        // Synchronize local player's completed questions list from Realtime Database
        if (playerId && playersData[playerId]?.completedQuestions) {
          const remoteList = playersData[playerId].completedQuestions;
          if (Array.isArray(remoteList)) {
            setCompletedIds((prev) => Array.from(new Set([...prev, ...remoteList])));
          }
        }

        // If room has questions saved in RTDB, prioritize them
        if (Array.isArray(value.questions) && value.questions.length > 0) {
          setQuestions(value.questions as Question[]);
        }
      },
      (firebaseError) => setError(firebaseError.message)
    );
  }, [roomCode, playerId]);

  // Fallback load questions from Firestore / localStorage if RTDB didn't have full questions list
  useEffect(() => {
    let cancelled = false;
    async function loadFallbackQuestions() {
      // Check localStorage first
      const stored = window.localStorage.getItem("kyunika-questions");
      let loaded: Question[] = [];
      if (stored) {
        try {
          loaded = JSON.parse(stored) as Question[];
        } catch {
          // ignore
        }
      }

      // If firestore is enabled and loaded questions is empty or incomplete
      if (firestore && loaded.length === 0) {
        try {
          const snapshot = await getDocs(collection(firestore, "questions"));
          if (!snapshot.empty) {
            loaded = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Question));
          }
        } catch {
          // ignore and fallback
        }
      }

      if (!cancelled && loaded.length > 0) {
        setQuestions(loaded);
      }
    }

    void loadFallbackQuestions();
    return () => {
      cancelled = true;
    };
  }, []);

  // Countdown timer for running match
  useEffect(() => {
    if (!room || room.status !== "running" || remainingSeconds <= 0) return;
    const timer = window.setInterval(
      () => setRemainingSeconds((current) => Math.max(current - 1, 0)),
      1000
    );
    return () => window.clearInterval(timer);
  }, [room, remainingSeconds]);

  // Save completed questions in localStorage for persistent session
  useEffect(() => {
    if (!roomCode) return;
    window.localStorage.setItem(`kyunika-completed-${roomCode}`, JSON.stringify(completedIds));
  }, [completedIds, roomCode]);

  // Deterministic question spots
  const questionCount = Math.max(questions.length, room?.questionIds?.length || 5);
  const questionPoints = useMemo(
    () => (room ? seededPoints(room.seed, questionCount) : []),
    [room, questionCount]
  );

  // Completed indices for 3D marker coloring
  const completedIndices = useMemo(() => {
    return questionPoints
      .map((_, i) => {
        const qId = questions[i]?.id ?? `q-${i}`;
        return completedIds.includes(qId) ? i : -1;
      })
      .filter((i) => i >= 0);
  }, [questionPoints, questions, completedIds]);

  // Target radar statistics (distance from player to each question)
  const targetStats = useMemo(() => {
    return questionPoints.map((pt, i) => {
      const q = questions[i] ?? defaultQuestions[i % defaultQuestions.length];
      const qId = q.id || `q-${i}`;
      const isCompleted = completedIds.includes(qId);
      const dist = Math.hypot(pt.x - playerPos.x, pt.z - playerPos.z);
      return { index: i, point: pt, question: q, isCompleted, dist };
    });
  }, [questionPoints, questions, completedIds, playerPos]);

  // Find nearest uncompleted target
  const nearestTarget = useMemo(() => {
    const uncompleted = targetStats.filter((t) => !t.isCompleted);
    if (uncompleted.length === 0) return null;
    return [...uncompleted].sort((a, b) => a.dist - b.dist)[0];
  }, [targetStats]);

  // Open Quiz Modal
  const openQuiz = useCallback(
    (index: number) => {
      const currentQ = questions[index] ?? defaultQuestions[index % defaultQuestions.length];
      const isAlreadyDone = completedIds.includes(currentQ.id);

      setActiveQuizIndex(index);
      setSelectedOption(null);
      setShortInput("");

      if (isAlreadyDone) {
        setIsAnswered(true);
        setQuizFeedback({
          correct: true,
          message: "Kamu sudah menyelesaikan soal ini sebelumnya! Jawaban tidak dapat diubah.",
        });
      } else {
        setIsAnswered(false);
        setQuizFeedback(null);
      }
    },
    [questions, completedIds]
  );

  // Close Quiz Modal
  const closeQuiz = useCallback(() => {
    setActiveQuizIndex(null);
    setSelectedOption(null);
    setShortInput("");
    setQuizFeedback(null);
    setIsAnswered(false);
  }, []);

  // Keyboard shortcut: Press Space to open question when near
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && nearQuestionIndex !== null && activeQuizIndex === null) {
        e.preventDefault();
        const currentQ = questions[nearQuestionIndex] ?? defaultQuestions[nearQuestionIndex % defaultQuestions.length];
        if (!completedIds.includes(currentQ.id)) {
          openQuiz(nearQuestionIndex);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nearQuestionIndex, activeQuizIndex, openQuiz, questions, completedIds]);

  // Handle Multiple Choice selection
  const handleSelectOption = (opt: string) => {
    if (isAnswered || activeQuizIndex === null) return;
    const currentQ = questions[activeQuizIndex] ?? defaultQuestions[activeQuizIndex % defaultQuestions.length];
    if (completedIds.includes(currentQ.id)) {
      setIsAnswered(true);
      return;
    }

    setSelectedOption(opt);
    setIsAnswered(true);

    const isCorrect = opt.trim().toLowerCase() === currentQ.answer.trim().toLowerCase();
    const currentScore = players[playerId]?.score ?? 0;
    const nextScore = isCorrect ? currentScore + currentQ.points : currentScore;
    const nextCompleted = Array.from(new Set([...completedIds, currentQ.id]));

    if (isCorrect) {
      setQuizFeedback({
        correct: true,
        message: `Hebat! Jawabanmu benar. Kamu mendapatkan +${currentQ.points} poin!`,
      });
    } else {
      setQuizFeedback({
        correct: false,
        message: `Jawaban belum tepat. Jawaban yang benar adalah: ${currentQ.answer}`,
      });
    }

    setCompletedIds(nextCompleted);

    // Persist score & completedQuestions strictly under this player's node
    if (realtimeDb && roomCode && playerId) {
      const updates: Record<string, unknown> = {
        completedQuestions: nextCompleted,
      };
      if (isCorrect) {
        updates.score = nextScore;
      }
      void update(ref(realtimeDb, `rooms/${roomCode}/players/${playerId}`), updates).catch((err) =>
        console.error("Failed to update player progress", err)
      );
    }
  };

  // Handle Short Answer submission
  const handleShortAnswerSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isAnswered || activeQuizIndex === null || !shortInput.trim()) return;
    const currentQ = questions[activeQuizIndex] ?? defaultQuestions[activeQuizIndex % defaultQuestions.length];
    if (completedIds.includes(currentQ.id)) {
      setIsAnswered(true);
      return;
    }

    setIsAnswered(true);
    const isCorrect = shortInput.trim().toLowerCase() === currentQ.answer.trim().toLowerCase();
    const currentScore = players[playerId]?.score ?? 0;
    const nextScore = isCorrect ? currentScore + currentQ.points : currentScore;
    const nextCompleted = Array.from(new Set([...completedIds, currentQ.id]));

    if (isCorrect) {
      setQuizFeedback({
        correct: true,
        message: `Luar biasa! Jawabanmu benar. Kamu mendapatkan +${currentQ.points} poin!`,
      });
    } else {
      setQuizFeedback({
        correct: false,
        message: `Jawaban belum tepat. Jawaban yang diterima adalah: ${currentQ.answer}`,
      });
    }

    setCompletedIds(nextCompleted);

    if (realtimeDb && roomCode && playerId) {
      const updates: Record<string, unknown> = {
        completedQuestions: nextCompleted,
      };
      if (isCorrect) {
        updates.score = nextScore;
      }
      void update(ref(realtimeDb, `rooms/${roomCode}/players/${playerId}`), updates).catch((err) =>
        console.error("Failed to update player progress", err)
      );
    }
  };

  const validPlayers = Object.entries(players).filter(
    ([, player]) => typeof player?.name === "string" && player.name.trim().length > 0
  );
  const safePlayers = Object.fromEntries(validPlayers);
  const leaderboard = validPlayers.sort(([, first], [, second]) => (second.score ?? 0) - (first.score ?? 0));

  const myRankIndex = leaderboard.findIndex(([id]) => id === playerId);
  const myPlayer = playerId && players[playerId] ? players[playerId] : null;
  const myScore = myPlayer?.score ?? 0;
  const myRank = myRankIndex >= 0 ? myRankIndex + 1 : "-";

  if (error) {
    return (
      <main className="game-shell">
        <div className="game-error">
          <span className="brand-mark">K</span>
          <h1>Room tidak siap</h1>
          <p>{error}</p>
          <a href="/play">Kembali ke join room</a>
        </div>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="game-shell">
        <div className="game-loading">
          <span className="brand-mark">K</span>
          <p>Menyiapkan kota permainan…</p>
        </div>
      </main>
    );
  }

  const minutes = Math.floor(remainingSeconds / 60).toString().padStart(2, "0");
  const seconds = (remainingSeconds % 60).toString().padStart(2, "0");
  const emitKey = (key: string, type: "keydown" | "keyup") =>
    window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));

  // Question currently open in modal
  const activeQuestion =
    activeQuizIndex !== null
      ? questions[activeQuizIndex] ?? defaultQuestions[activeQuizIndex % defaultQuestions.length]
      : null;

  // Question currently close to car
  const nearQuestion =
    nearQuestionIndex !== null
      ? questions[nearQuestionIndex] ?? defaultQuestions[nearQuestionIndex % defaultQuestions.length]
      : null;

  return (
    <main className="game-shell">
      {/* Game Header */}
      <header className="game-header">
        <div className="play-brand">
          <span className="brand-mark">K</span> Kyunika Games
        </div>
        <div className="game-room-label">
          <span>{room.title}</span>
          <strong>{room.code}</strong>
        </div>
        <div className="game-timer">
          {minutes}:{seconds}
        </div>
      </header>

      <section className="game-layout">
        <div className="city-stage">
          {/* Stage Top Title */}
          <div className="stage-top">
            <div>
              <div className="eyebrow">{room.cityTheme.toUpperCase()}</div>
              <h1>{room.layout}</h1>
            </div>
            <span className="match-state">
              ● {room.status === "running" ? "MATCH LIVE" : room.status.toUpperCase()}
            </span>
          </div>

          {/* Target Radar & Navigation HUD */}
          <div className="target-radar-hud">
            {nearestTarget && (
              <div className="nearest-target-card">
                <span className="target-icon">🎯</span>
                <span>
                  Target Terdekat: <strong>Soal #{nearestTarget.index + 1}</strong>
                </span>
                <span className="dist-badge">{Math.round(nearestTarget.dist)}m</span>
              </div>
            )}

            <div className="radar-chips-list">
              {targetStats.map((t) => (
                <button
                  key={t.index}
                  className={`radar-chip ${t.isCompleted ? "completed" : nearestTarget?.index === t.index ? "active" : ""}`}
                  onClick={() => openQuiz(t.index)}
                  title={`Klik untuk lihat soal #${t.index + 1}`}
                >
                  <span>{t.isCompleted ? "✓" : "📍"}</span>
                  <span>#{t.index + 1}</span>
                  <small>{t.isCompleted ? "Selesai" : `${Math.round(t.dist)}m`}</small>
                </button>
              ))}
            </div>
          </div>

          {/* 3D WebGL Canvas */}
          <div className="city-map city-3d-stage">
            <CityCanvas
              seed={room.seed}
              questionCount={questionPoints.length}
              roomCode={room.code}
              playerId={playerId}
              players={safePlayers}
              questionPoints={questionPoints}
              completedQuestionIndices={completedIndices}
              nearestQuestionIndex={nearestTarget?.index ?? null}
              isQuizOpen={activeQuizIndex !== null}
              joystickRef={joystickRef}
              isBrakingRef={isBrakingRef}
              onPlayerPosUpdate={setPlayerPos}
              onNearQuestion={setNearQuestionIndex}
            />
            <div className="map-label">CITY KIT 3D · SEED {room.seed}</div>

            {/* Mobile virtual touch Analog Joystick + Brake */}
            <div className="mobile-controls-layer">
              <div className="analog-stick-wrap">
                <VirtualJoystick
                  onMove={(v) => {
                    joystickRef.current = v;
                  }}
                  onStop={() => {
                    joystickRef.current = { x: 0, y: 0 };
                  }}
                />
              </div>

              <button
                type="button"
                className="mobile-brake-btn"
                onPointerDown={(e) => {
                  e.preventDefault();
                  isBrakingRef.current = true;
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  isBrakingRef.current = false;
                }}
                onPointerLeave={() => {
                  isBrakingRef.current = false;
                }}
                onPointerCancel={() => {
                  isBrakingRef.current = false;
                }}
                onContextMenu={(e) => e.preventDefault()}
                aria-label="Rem mobil"
              >
                <span className="brake-icon">🛑</span>
                <span className="brake-text">REM</span>
              </button>
            </div>
          </div>

          {/* Proximity Action Button (shown when car is inside question zone) */}
          {nearQuestion && activeQuizIndex === null && (
            completedIds.includes(nearQuestion.id) ? (
              <div className="proximity-prompt-banner completed">
                <span>✓</span>
                <span>
                  SOAL #{nearQuestionIndex! + 1} SUDAH KAMU SELESAIKAN
                </span>
                <kbd>Selesai</kbd>
              </div>
            ) : (
              <button
                className="proximity-prompt-banner"
                onClick={() => openQuiz(nearQuestionIndex!)}
              >
                <span>⚡</span>
                <span>
                  KERJAKAN SOAL #{nearQuestionIndex! + 1} (+{nearQuestion.points} pts)
                </span>
                <kbd>Spasi / Ketuk</kbd>
              </button>
            )
          )}

          {/* Controls Hint */}
          <div className="game-hint">
            Dekati pilar cahaya ungu untuk mengerjakan kuis. W/↑ Gas · S/↓ Rem/Mundur · A/D Setir · Spasi Buka Soal.
          </div>
          <div className="game-controls">
            <strong>Kontrol</strong>
            <span>W/A/S/D atau Arrow Keys · Swipe untuk sudut pandang</span>
          </div>
        </div>

        {/* Sidebar: Leaderboard & Match Summary (Desktop sidebar / Mobile compact top-right) */}
        <aside className={`game-sidebar ${isLeaderboardMinimized ? "minimized" : ""}`}>
          <div className="game-panel leaderboard-panel">
            <div className="panel-header-row">
              <div className="eyebrow">LEADERBOARD</div>
              <button
                type="button"
                className="leaderboard-toggle-btn"
                onClick={() => setIsLeaderboardMinimized((prev) => !prev)}
                aria-label={isLeaderboardMinimized ? "Perbesar leaderboard" : "Perkecil leaderboard"}
              >
                {isLeaderboardMinimized ? "▲ Buka" : "▼ Ciut"}
              </button>
            </div>

            {!isLeaderboardMinimized ? (
              <>
                <h2>Siapa terdepan?</h2>
                <div className="game-player-list">
                  {leaderboard.map(([id, player], index) => (
                    <div className={`game-player ${id === playerId ? "is-me" : ""}`} key={id}>
                      <span className="rank">{index + 1}</span>
                      <span className="player-avatar">{player.name.slice(0, 1).toUpperCase()}</span>
                      <strong>
                        {player.name} {id === playerId ? "(Kamu)" : ""}
                      </strong>
                      <b>{player.score ?? 0} pts</b>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div
                className="leaderboard-mini-summary"
                onClick={() => setIsLeaderboardMinimized(false)}
              >
                <span className="mini-trophy">🏆</span>
                <span>
                  <strong>#{myRank}</strong> {myPlayer?.name ?? "Kamu"}
                </span>
                <b>{myScore} pts</b>
              </div>
            )}
          </div>

          <div className="game-panel session-panel">
            <div className="eyebrow">MATCH INFO</div>
            <div className="info-line">
              <span>Soal selesai</span>
              <strong>
                {completedIds.length} / {questionPoints.length}
              </strong>
            </div>
            <div className="info-line">
              <span>Pemain online</span>
              <strong>{validPlayers.length}</strong>
            </div>
            <div className="info-line">
              <span>Seed kota</span>
              <strong>{room.seed}</strong>
            </div>
          </div>
        </aside>
      </section>

      {/* Interactive Quiz Modal */}
      {activeQuestion && activeQuizIndex !== null && (
        <div className="quiz-overlay" onClick={closeQuiz}>
          <div className="quiz-card" onClick={(e) => e.stopPropagation()}>
            <div className="quiz-card-top">
              <span className="quiz-badge">
                SOAL #{activeQuizIndex + 1} DARI {questionPoints.length}
              </span>
              <span className="quiz-points-pill">+{activeQuestion.points} POIN</span>
              <button className="quiz-close-btn" onClick={closeQuiz} aria-label="Tutup kuis">
                ✕
              </button>
            </div>

            <h2 className="quiz-title">{activeQuestion.text}</h2>

            {/* Multiple Choice Options */}
            {activeQuestion.type === "multiple-choice" && (
              <div className="quiz-options">
                {activeQuestion.options.map((opt, i) => {
                  const letter = String.fromCharCode(65 + i);
                  let stateClass = "";
                  if (isAnswered) {
                    if (opt.trim().toLowerCase() === activeQuestion.answer.trim().toLowerCase()) {
                      stateClass = "correct";
                    } else if (selectedOption === opt) {
                      stateClass = "wrong";
                    }
                  }
                  return (
                    <button
                      key={i}
                      className={`quiz-option-item ${stateClass}`}
                      onClick={() => handleSelectOption(opt)}
                      disabled={isAnswered}
                    >
                      <span className="quiz-opt-letter">{letter}</span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Short Answer Form */}
            {activeQuestion.type === "short-answer" && (
              <form onSubmit={handleShortAnswerSubmit} className="quiz-short-form">
                <input
                  type="text"
                  value={shortInput}
                  onChange={(e) => setShortInput(e.target.value)}
                  placeholder="Ketik jawabanmu..."
                  disabled={isAnswered}
                  autoFocus
                />
                <button type="submit" disabled={isAnswered || !shortInput.trim()}>
                  Kirim
                </button>
              </form>
            )}

            {/* Result Feedback Banner */}
            {quizFeedback && (
              <div className={`quiz-feedback ${quizFeedback.correct ? "success" : "failure"}`}>
                <span>{quizFeedback.correct ? "🎉" : "❌"}</span>
                <div>{quizFeedback.message}</div>
              </div>
            )}

            {/* Continue Exploration Button */}
            {isAnswered && (
              <button className="quiz-continue-button" onClick={closeQuiz}>
                Lanjut Jelajahi Kota ➔
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
