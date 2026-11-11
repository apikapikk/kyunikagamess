"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { onValue, ref, remove, set, update } from "firebase/database";
import { firebaseEnabled, firestore, realtimeDb } from "@/lib/firebase";

export type QuestionType = "multiple-choice" | "short-answer";

export type QuestionBank = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
};

export type Question = {
  id: string;
  bankId: string;
  type: QuestionType;
  text: string;
  options: string[];
  answer: string;
  points: number;
};

export type PlayerAnswer = {
  questionId: string;
  questionText: string;
  playerAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  pointsAwarded: number;
  answeredAt: number;
};

export type RoomPlayer = {
  name: string;
  joinedAt: number;
  score?: number;
  online?: boolean;
  lastActive?: number;
  completedQuestions?: string[];
  answers?: Record<string, PlayerAnswer>;
};

export type Room = {
  code: string;
  title: string;
  cityTheme: string;
  layout: string;
  seed: number;
  duration: number;
  createdAt: string;
  bankId?: string;
  bankTitle?: string;
  questionIds: string[];
  status?: "lobby" | "running" | "finished";
  startedAt?: number;
};

// ─── Starter Question Banks & Questions ──────────────────────────────────────
const starterBanks: QuestionBank[] = [
  {
    id: "bank-umum",
    title: "Pengetahuan Umum & Sains",
    description: "Soal-soal geografi, wawasan umum, dan sains dasar",
    createdAt: "2026-11-01T00:00:00.000Z",
  },
  {
    id: "bank-mtk-lanjutan",
    title: "Matematika Lanjutan",
    description: "Aljabar, perkalian cepat, geometri, dan logika hitung",
    createdAt: "2026-11-02T00:00:00.000Z",
  },
];

const starterQuestions: Question[] = [
  // Bank Umum
  { id: "q-1", bankId: "bank-umum", type: "multiple-choice", text: "Planet terdekat dengan Matahari adalah?", options: ["Venus", "Mars", "Merkurius", "Bumi"], answer: "Merkurius", points: 100 },
  { id: "q-2", bankId: "bank-umum", type: "short-answer", text: "Sebutkan ibu kota negara Indonesia.", options: [], answer: "Jakarta", points: 120 },
  { id: "q-3", bankId: "bank-umum", type: "multiple-choice", text: "Gas apa yang paling banyak menyusun atmosfer Bumi?", options: ["Oksigen", "Nitrogen", "Karbon Dioksida", "Helium"], answer: "Nitrogen", points: 100 },
  { id: "q-4", bankId: "bank-umum", type: "multiple-choice", text: "Benua terbesar di dunia adalah?", options: ["Afrika", "Asia", "Amerika", "Eropa"], answer: "Asia", points: 100 },
  { id: "q-5", bankId: "bank-umum", type: "short-answer", text: "Tuliskan simbol kimia untuk air murni.", options: [], answer: "H2O", points: 100 },

  // Bank MTK Lanjutan
  { id: "q-m1", bankId: "bank-mtk-lanjutan", type: "multiple-choice", text: "Berapa hasil dari 8 × 7?", options: ["54", "56", "64", "48"], answer: "56", points: 100 },
  { id: "q-m2", bankId: "bank-mtk-lanjutan", type: "short-answer", text: "Jika 3x + 6 = 21, berapakah nilai x?", options: [], answer: "5", points: 120 },
  { id: "q-m3", bankId: "bank-mtk-lanjutan", type: "multiple-choice", text: "Berapa akar kuadrat dari 144?", options: ["11", "12", "14", "16"], answer: "12", points: 100 },
  { id: "q-m4", bankId: "bank-mtk-lanjutan", type: "multiple-choice", text: "Sebuah persegi memiliki keliling 48 cm. Berapa luasnya?", options: ["144 cm²", "96 cm²", "120 cm²", "160 cm²"], answer: "144 cm²", points: 130 },
  { id: "q-m5", bankId: "bank-mtk-lanjutan", type: "short-answer", text: "Berapa hasil dari 15 × 12?", options: [], answer: "180", points: 110 },
];

const layouts = ["Suburban Grid", "Park Loop", "Crossroad"];
const themes = ["Sunny Suburban", "Green District", "Warm Neighborhood"];
const createCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const randomItem = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

function loadStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(key);
  return stored ? (JSON.parse(stored) as T) : fallback;
}

export default function AdminPage() {
  const [banks, setBanks] = useState<QuestionBank[]>(starterBanks);
  const [questions, setQuestions] = useState<Question[]>(starterQuestions);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "questions" | "rooms">("overview");

  // Bank Soal management state
  const [selectedBankId, setSelectedBankId] = useState<string>("all");
  const [isCreatingBank, setIsCreatingBank] = useState(false);
  const [newBankTitle, setNewBankTitle] = useState("");
  const [newBankDesc, setNewBankDesc] = useState("");

  // Question form state
  const [targetBankId, setTargetBankId] = useState<string>("bank-umum");
  const [questionType, setQuestionType] = useState<QuestionType>("multiple-choice");
  const [questionText, setQuestionText] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [answer, setAnswer] = useState("");
  const [points, setPoints] = useState("100");

  // Room builder state
  const [roomTitle, setRoomTitle] = useState("Kuis Seru Hari Ini");
  const [roomDuration, setRoomDuration] = useState("10");
  const [selectedBankForRoom, setSelectedBankForRoom] = useState<string>("bank-umum");
  const [roomCreated, setRoomCreated] = useState<Room | null>(null);

  // Live monitor state
  const [dataSource, setDataSource] = useState(firebaseEnabled ? "Firebase" : "Local preview");
  const [hydrated, setHydrated] = useState(false);
  const [selectedRoomCode, setSelectedRoomCode] = useState("");
  const [selectedRoomStatus, setSelectedRoomStatus] = useState<Room["status"]>("lobby");
  const [roomPlayers, setRoomPlayers] = useState<Record<string, RoomPlayer>>({});
  const [roomQuestions, setRoomQuestions] = useState<Question[]>([]);

  // 1. Initial hydration from LocalStorage
  useEffect(() => {
    queueMicrotask(() => {
      setBanks(loadStored("kyunika-banks", starterBanks));
      const loadedQ = loadStored("kyunika-questions", starterQuestions).map((q: Question) => ({
        ...q,
        bankId: q.bankId || "bank-umum",
      }));
      setQuestions(loadedQ);
      setRooms(loadStored("kyunika-rooms", []));
      setHydrated(true);
    });
  }, []);

  // 2. Load data from Firestore if available
  useEffect(() => {
    if (!firestore) return;
    const db = firestore;
    async function loadFirebaseData() {
      try {
        const [bankSnap, questionSnap, roomSnap] = await Promise.all([
          getDocs(collection(db, "questionBanks")),
          getDocs(collection(db, "questions")),
          getDocs(collection(db, "rooms")),
        ]);

        if (!bankSnap.empty) {
          setBanks(bankSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as QuestionBank)));
        }
        if (!questionSnap.empty) {
          setQuestions(
            questionSnap.docs.map((doc) => {
              const data = doc.data();
              return {
                id: doc.id,
                bankId: data.bankId || "bank-umum",
                ...data,
              } as Question;
            })
          );
        }
        if (!roomSnap.empty) {
          setRooms(roomSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as unknown as Room)));
        }
        setDataSource("Firebase");
      } catch (error) {
        console.error("Firebase data load failed", error);
        setDataSource("Local fallback");
      }
    }
    void loadFirebaseData();
  }, []);

  // 3. Save to localStorage when changed
  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem("kyunika-banks", JSON.stringify(banks));
      window.localStorage.setItem("kyunika-questions", JSON.stringify(questions));
      window.localStorage.setItem("kyunika-rooms", JSON.stringify(rooms));
    }
  }, [hydrated, banks, questions, rooms]);

  // 4. Default selected room for monitor
  useEffect(() => {
    if (!selectedRoomCode && rooms[0]) {
      queueMicrotask(() => setSelectedRoomCode(rooms[0].code));
    }
  }, [rooms, selectedRoomCode]);

  // 5. Realtime Database listener for selected room (Players, Questions, Status)
  useEffect(() => {
    if (!realtimeDb || !selectedRoomCode) return;
    const roomRef = ref(realtimeDb, `rooms/${selectedRoomCode}`);
    return onValue(
      roomRef,
      (snapshot) => {
        const value = snapshot.val() ?? {};
        setRoomPlayers((value.players ?? {}) as Record<string, RoomPlayer>);
        setSelectedRoomStatus(value.meta?.status ?? "lobby");
        
        let qList: Question[] = [];
        if (Array.isArray(value.questions)) {
          qList = value.questions;
        } else if (value.questions && typeof value.questions === "object") {
          qList = Object.values(value.questions) as Question[];
        }

        if (qList.length > 0) {
          setRoomQuestions(qList);
        } else {
          const curRoom = rooms.find((r) => r.code === selectedRoomCode);
          if (curRoom) {
            const matched = questions.filter((q) => curRoom.questionIds.includes(q.id));
            setRoomQuestions(matched);
          }
        }
      },
      (error) => console.error("Room monitor failed", error)
    );
  }, [selectedRoomCode, rooms, questions]);

  // Filter questions based on selected bank
  const filteredQuestions = useMemo(() => {
    if (selectedBankId === "all") return questions;
    return questions.filter((q) => q.bankId === selectedBankId);
  }, [questions, selectedBankId]);

  const totalPoints = useMemo(
    () => filteredQuestions.reduce((sum, item) => sum + item.points, 0),
    [filteredQuestions]
  );

  // ─── Bank Soal Actions ─────────────────────────────────────────────────────
  function handleCreateBank(e: FormEvent) {
    e.preventDefault();
    if (!newBankTitle.trim()) return;
    const newBank: QuestionBank = {
      id: `bank-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: newBankTitle.trim(),
      description: newBankDesc.trim() || "Kumpulan soal kuis",
      createdAt: new Date().toISOString(),
    };
    setBanks((current) => [...current, newBank]);
    setSelectedBankId(newBank.id);
    setTargetBankId(newBank.id);
    if (firestore) {
      void setDoc(doc(firestore, "questionBanks", newBank.id), newBank).catch((err) =>
        console.error("Firebase bank save failed", err)
      );
    }
    setNewBankTitle("");
    setNewBankDesc("");
    setIsCreatingBank(false);
  }

  function handleDeleteBank(bankId: string) {
    const bank = banks.find((b) => b.id === bankId);
    if (!bank) return;
    if (
      !window.confirm(
        `Hapus Bank Soal "${bank.title}"? Pertanyaan di dalamnya akan dipindahkan ke Bank Umum.`
      )
    ) {
      return;
    }

    setBanks((current) => current.filter((b) => b.id !== bankId));
    setQuestions((current) =>
      current.map((q) => (q.bankId === bankId ? { ...q, bankId: "bank-umum" } : q))
    );

    if (selectedBankId === bankId) {
      setSelectedBankId("all");
    }
    if (targetBankId === bankId) {
      setTargetBankId("bank-umum");
    }
    if (selectedBankForRoom === bankId) {
      setSelectedBankForRoom("all");
    }

    if (firestore) {
      void deleteDoc(doc(firestore, "questionBanks", bankId)).catch((err) =>
        console.error("Firebase bank delete failed", err)
      );
    }
  }

  // ─── Question Submission ───────────────────────────────────────────────────
  function resetQuestionForm() {
    setQuestionText("");
    setOptions(["", "", "", ""]);
    setAnswer("");
    setPoints("100");
  }

  function handleQuestionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanText = questionText.trim();
    const cleanOptions = options.map((option) => option.trim()).filter(Boolean);
    if (!cleanText || !answer.trim() || (questionType === "multiple-choice" && cleanOptions.length < 2)) return;

    const bId = targetBankId || banks[0]?.id || "bank-umum";
    const newQuestion: Question = {
      id: createId("q"),
      bankId: bId,
      type: questionType,
      text: cleanText,
      options: questionType === "multiple-choice" ? cleanOptions : [],
      answer: answer.trim(),
      points: Math.max(10, Number(points) || 100),
    };

    setQuestions((current) => [newQuestion, ...current]);
    if (firestore) {
      void setDoc(doc(firestore, "questions", newQuestion.id), {
        ...newQuestion,
        createdAt: new Date().toISOString(),
      }).catch((error) => console.error("Firebase question save failed", error));
    }
    resetQuestionForm();
  }

  // ─── Room Creation with Bank Soal Import ────────────────────────────────────
  function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Select questions exclusively from chosen Question Bank
    const importedQuestions =
      selectedBankForRoom === "all"
        ? questions
        : questions.filter((q) => q.bankId === selectedBankForRoom);

    if (importedQuestions.length === 0) {
      window.alert("Bank soal yang dipilih belum memiliki pertanyaan. Silakan tambahkan soal terlebih dahulu.");
      return;
    }

    const bankObj = banks.find((b) => b.id === selectedBankForRoom);
    const bankName = bankObj ? bankObj.title : "Semua Bank Soal";

    const room: Room = {
      code: createCode(),
      title: roomTitle.trim() || `Kuis ${bankName}`,
      cityTheme: randomItem(themes),
      layout: randomItem(layouts),
      seed: Math.floor(Math.random() * 900000) + 100000,
      duration: Number(roomDuration) || 10,
      createdAt: new Date().toISOString(),
      bankId: selectedBankForRoom,
      bankTitle: bankName,
      questionIds: importedQuestions.map((q) => q.id),
      status: "lobby",
    };

    setRooms((current) => [room, ...current]);
    if (firestore) {
      void setDoc(doc(firestore, "rooms", room.code), room).catch((error) =>
        console.error("Firebase room save failed", error)
      );
    }
    if (realtimeDb) {
      void set(ref(realtimeDb, `rooms/${room.code}/meta`), room).catch((error) =>
        console.error("Realtime Database room save failed", error)
      );
      void set(ref(realtimeDb, `rooms/${room.code}/questions`), importedQuestions).catch((error) =>
        console.error("Realtime Database questions save failed", error)
      );
    }

    setRoomCreated(room);
    setSelectedRoomCode(room.code);
    setSelectedRoomStatus("lobby");
    setActiveTab("rooms");
  }

  function setRoomLifecycle(status: Room["status"]) {
    if (!selectedRoomCode || !status) return;
    const now = Date.now();
    setSelectedRoomStatus(status);
    const updates: Record<string, unknown> = { status };
    if (status === "running") {
      updates.startedAt = now;
    }
    setRooms((current) =>
      current.map((room) =>
        room.code === selectedRoomCode
          ? { ...room, status, ...(status === "running" ? { startedAt: now } : {}) }
          : room
      )
    );
    if (firestore) {
      void updateDoc(doc(firestore, "rooms", selectedRoomCode), updates).catch((error) =>
        console.error("Firebase room status update failed", error)
      );
    }
    if (realtimeDb) {
      void update(ref(realtimeDb, `rooms/${selectedRoomCode}/meta`), updates).catch((error) =>
        console.error("Realtime room status update failed", error)
      );
    }
  }

  async function deleteRoom() {
    if (!selectedRoomCode || !window.confirm(`Hapus room ${selectedRoomCode}? Data room dan lobby pemain akan dihapus.`))
      return;
    const code = selectedRoomCode;
    try {
      await Promise.all([
        firestore ? deleteDoc(doc(firestore, "rooms", code)) : Promise.resolve(),
        realtimeDb ? remove(ref(realtimeDb, `rooms/${code}`)) : Promise.resolve(),
      ]);
      setRooms((current) => current.filter((room) => room.code !== code));
      setRoomCreated((current) => (current?.code === code ? null : current));
      setSelectedRoomCode("");
      setSelectedRoomStatus("lobby");
      setRoomPlayers({});
      setRoomQuestions([]);
    } catch (error) {
      console.error("Room delete failed", error);
      window.alert("Room gagal dihapus dari Firebase.");
    }
  }

  return (
    <main className="admin-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">K</span>
          <span>
            Kyunika<span className="brand-soft"> Games</span>
          </span>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="nav-list" aria-label="Navigasi admin">
          <button
            className={activeTab === "overview" ? "nav-item active" : "nav-item"}
            onClick={() => setActiveTab("overview")}
          >
            <span>⌂</span> Overview
          </button>
          <button
            className={activeTab === "questions" ? "nav-item active" : "nav-item"}
            onClick={() => setActiveTab("questions")}
          >
            <span>?</span> Bank soal <b>{questions.length}</b>
          </button>
          <button
            className={activeTab === "rooms" ? "nav-item active" : "nav-item"}
            onClick={() => setActiveTab("rooms")}
          >
            <span>♧</span> Room aktif <b>{rooms.length}</b>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="mini-profile">
            <div className="avatar">A</div>
            <div>
              <strong>Admin Kuis</strong>
              <small>Workspace owner</small>
            </div>
            <span>•••</span>
          </div>
          <div className="version">
            Kyunika admin <span>v0.2</span>
          </div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div className="crumb">
            Workspace <span>/</span>{" "}
            <strong>
              {activeTab === "overview" ? "Overview" : activeTab === "questions" ? "Bank soal" : "Room aktif"}
            </strong>
          </div>
          <div className="top-actions">
            <span className="live-dot">●</span> {dataSource} <button className="icon-button">⌘</button>
          </div>
        </header>

        {activeTab === "overview" && (
          <div className="page-content">
            <div className="hero">
              <div>
                <div className="eyebrow">CONTROL CENTER • MULTIPLAYER</div>
                <h1>
                  Siapkan kuis,
                  <br />
                  <em>biarkan kota bermain.</em>
                </h1>
                <p>
                  Kelola bank soal per mata pelajaran, buat arena kota kuis, bagikan kode room, dan pantau
                  pengerjaan siswa secara realtime.
                </p>
                <div className="hero-actions">
                  <button className="primary-button" onClick={() => setActiveTab("rooms")}>
                    Buat room baru <span>↗</span>
                  </button>
                  <button className="text-button" onClick={() => setActiveTab("questions")}>
                    Kelola bank soal <span>→</span>
                  </button>
                </div>
              </div>
              <div className="hero-art">
                <div className="sun" />
                <div className="city-card">
                  <div className="cloud cloud-one" />
                  <div className="cloud cloud-two" />
                  <div className="road" />
                  <div className="house house-a" />
                  <div className="house house-b" />
                  <div className="tree tree-a">♣</div>
                  <div className="tree tree-b">♣</div>
                  <div className="pin pin-a">?</div>
                  <div className="pin pin-b">?</div>
                  <div className="player">●</div>
                </div>
              </div>
            </div>

            <div className="section-heading">
              <div>
                <div className="eyebrow">RINGKASAN</div>
                <h2>Semua siap dimainkan</h2>
              </div>
              <span className="muted">Sinkronisasi RTDB & Firestore aktif</span>
            </div>

            <div className="stat-grid">
              <Stat
                label="Bank Soal"
                value={String(banks.length).padStart(2, "0")}
                detail={`${questions.length} total soal`}
                tone="purple"
              />
              <Stat
                label="Total Soal"
                value={String(questions.length).padStart(2, "0")}
                detail={`${totalPoints} total poin`}
                tone="yellow"
              />
              <Stat
                label="Room dibuat"
                value={String(rooms.length).padStart(2, "0")}
                detail="Siap dibagikan"
                tone="blue"
              />
            </div>

            <div className="lower-grid">
              <div className="panel activity-panel">
                <div className="panel-heading">
                  <div>
                    <div className="eyebrow">AKTIVITAS TERBARU</div>
                    <h3>Room terakhir</h3>
                  </div>
                  <button className="small-button" onClick={() => setActiveTab("rooms")}>
                    Lihat semua
                  </button>
                </div>
                {rooms.length === 0 ? (
                  <EmptyState text="Belum ada room. Buat room pertama untuk mulai bermain." />
                ) : (
                  rooms.slice(0, 3).map((room) => <RoomRow key={room.code} room={room} />)
                )}
              </div>

              <div className="panel guide-panel">
                <div className="guide-icon">✦</div>
                <div className="eyebrow">BANK SOAL & LIVE MONITOR</div>
                <h3>Kuis terarah,<br />pantau detail siswa.</h3>
                <p>
                  Kelompokkan soal ke bank tertentu (misal: MTK-Lanjutan). Saat room dibuat, kuis hanya mengimpor
                  soal dari bank tersebut dan jawaban murid dapat dipantau butir per butir.
                </p>
                <button className="text-button" onClick={() => setActiveTab("rooms")}>
                  Mulai buat room <span>→</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "questions" && (
          <div className="page-content">
            <PageTitle
              eyebrow="QUESTION BUILDER"
              title="Kelola Bank Soal"
              description="Organisasikan pertanyaan per kategori/mata pelajaran, lalu impor langsung saat membuat room."
            />

            {/* Bank Soal Selection Bar */}
            <div className="bank-chips-bar">
              <button
                type="button"
                className={selectedBankId === "all" ? "bank-chip active" : "bank-chip"}
                onClick={() => setSelectedBankId("all")}
              >
                Semua Soal ({questions.length})
              </button>
              {banks.map((bank) => {
                const count = questions.filter((q) => q.bankId === bank.id).length;
                const isCustom = bank.id !== "bank-umum" && bank.id !== "bank-mtk-lanjutan";
                return (
                  <div key={bank.id} className="bank-chip-wrapper">
                    <button
                      type="button"
                      className={selectedBankId === bank.id ? "bank-chip active" : "bank-chip"}
                      onClick={() => setSelectedBankId(bank.id)}
                    >
                      📁 {bank.title} ({count})
                    </button>
                    {isCustom && (
                      <button
                        type="button"
                        className="bank-chip-del"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBank(bank.id);
                        }}
                        title={`Hapus bank ${bank.title}`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                className="bank-chip-add"
                onClick={() => setIsCreatingBank((prev) => !prev)}
              >
                ＋ Buat Bank Baru
              </button>
            </div>

            {/* Form Inline Buat Bank Soal Baru */}
            {isCreatingBank && (
              <div className="create-bank-modal">
                <h4>Buat Kategori / Bank Soal Baru</h4>
                <form onSubmit={handleCreateBank} className="create-bank-form">
                  <input
                    required
                    placeholder="Nama Bank Soal (contoh: MTK-Lanjutan, Biologi Sel, Kuis Sejarah)"
                    value={newBankTitle}
                    onChange={(e) => setNewBankTitle(e.target.value)}
                  />
                  <input
                    placeholder="Deskripsi singkat bank soal"
                    value={newBankDesc}
                    onChange={(e) => setNewBankDesc(e.target.value)}
                  />
                  <div className="create-bank-actions">
                    <button type="button" className="text-button" onClick={() => setIsCreatingBank(false)}>
                      Batal
                    </button>
                    <button type="submit" className="primary-button small-button">
                      Simpan Bank Soal
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="question-layout">
              <form className="panel question-form" onSubmit={handleQuestionSubmit}>
                <div className="panel-heading">
                  <div>
                    <div className="eyebrow">SOAL BARU</div>
                    <h3>Tulis tantanganmu</h3>
                  </div>
                  <span className="step-pill">01 / 01</span>
                </div>

                <label>
                  Simpan ke Bank Soal
                  <select value={targetBankId} onChange={(e) => setTargetBankId(e.target.value)}>
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Pertanyaan
                  <input
                    required
                    value={questionText}
                    onChange={(event) => setQuestionText(event.target.value)}
                    placeholder="Contoh: Berapa hasil dari 15 x 12?"
                  />
                </label>

                <div className="type-switch">
                  <button
                    type="button"
                    className={questionType === "multiple-choice" ? "type-option selected" : "type-option"}
                    onClick={() => setQuestionType("multiple-choice")}
                  >
                    <span>☷</span>
                    <strong>Pilihan ganda</strong>
                    <small>Pemain memilih satu jawaban</small>
                  </button>
                  <button
                    type="button"
                    className={questionType === "short-answer" ? "type-option selected" : "type-option"}
                    onClick={() => setQuestionType("short-answer")}
                  >
                    <span>⌁</span>
                    <strong>Isian singkat</strong>
                    <small>Pemain mengetik jawaban</small>
                  </button>
                </div>

                {questionType === "multiple-choice" && (
                  <div className="options-block">
                    <div className="label-row">
                      <label>Pilihan jawaban</label>
                      <span>Jawaban benar ditandai</span>
                    </div>
                    {options.map((option, index) => (
                      <div className="option-input" key={index}>
                        <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                        <input
                          required
                          value={option}
                          onChange={(event) =>
                            setOptions((current) =>
                              current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item))
                            )
                          }
                          placeholder={`Pilihan ${String.fromCharCode(65 + index)}`}
                        />
                        <button
                          type="button"
                          className={answer === option && option ? "correct-toggle selected" : "correct-toggle"}
                          aria-label={`Tandai pilihan ${index + 1} sebagai jawaban benar`}
                          onClick={() => setAnswer(option)}
                        >
                          ✓
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {questionType === "short-answer" && (
                  <label>
                    Jawaban benar
                    <input
                      required
                      value={answer}
                      onChange={(event) => setAnswer(event.target.value)}
                      placeholder="Tulis jawaban yang diterima"
                    />
                  </label>
                )}

                {questionType === "multiple-choice" && (
                  <div className="answer-hint">
                    {answer ? (
                      <>
                        Jawaban benar: <strong>{answer}</strong>
                      </>
                    ) : (
                      "Klik tanda centang pada pilihan yang benar"
                    )}
                  </div>
                )}

                <div className="form-row">
                  <label>
                    Nilai soal
                    <input
                      type="number"
                      min="10"
                      step="10"
                      value={points}
                      onChange={(event) => setPoints(event.target.value)}
                    />
                  </label>
                  <div className="points-note">Poin lebih tinggi memberi reward lebih besar di leaderboard.</div>
                </div>

                <button className="primary-button full-button" type="submit">
                  Simpan soal <span>＋</span>
                </button>
              </form>

              <div className="panel bank-panel">
                <div className="panel-heading">
                  <div>
                    <div className="eyebrow">
                      {selectedBankId === "all"
                        ? "SEMUA BANK SOAL"
                        : (banks.find((b) => b.id === selectedBankId)?.title ?? "BANK SOAL")}
                    </div>
                    <h3>{filteredQuestions.length} pertanyaan</h3>
                  </div>
                  <span className="total-badge">{totalPoints} pts</span>
                </div>

                <div className="question-list">
                  {filteredQuestions.length === 0 ? (
                    <EmptyState text="Belum ada soal pada bank ini. Buat pertanyaan di sebelah kiri." />
                  ) : (
                    filteredQuestions.map((question, index) => {
                      const bankTitle = banks.find((b) => b.id === question.bankId)?.title || "Umum";
                      return (
                        <div className="question-row" key={question.id}>
                          <div className="question-number">{String(index + 1).padStart(2, "0")}</div>
                          <div className="question-copy">
                            <div className="question-meta">
                              <span className="bank-tag-pill">{bankTitle}</span>
                              <span className={question.type === "multiple-choice" ? "tag purple" : "tag orange"}>
                                {question.type === "multiple-choice" ? "PILIHAN GANDA" : "ISIAN"}
                              </span>
                              <span>{question.points} pts</span>
                            </div>
                            <strong>{question.text}</strong>
                            <small>Jawaban: {question.answer}</small>
                          </div>
                          <button
                            className="delete-button"
                            onClick={() => {
                              setQuestions((current) => current.filter((item) => item.id !== question.id));
                              if (firestore) {
                                void deleteDoc(doc(firestore, "questions", question.id)).catch((error) =>
                                  console.error("Firebase question delete failed", error)
                                );
                              }
                            }}
                            aria-label="Hapus soal"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "rooms" && (
          <div className="page-content">
            <PageTitle
              eyebrow="ROOM MANAGER"
              title="Buat arena pertandingan"
              description="Pilih bank soal yang ingin diujikan ke peserta. Kota, obstacle, dan titik soal akan diacak otomatis saat room dibuat."
            />
            <div className="room-layout">
              <form className="panel room-form" onSubmit={createRoom}>
                <div className="panel-heading">
                  <div>
                    <div className="eyebrow">ROOM BARU</div>
                    <h3>Atur pertandingan</h3>
                  </div>
                  <span className="room-live">● READY</span>
                </div>

                {/* Import Dari Bank Soal */}
                <label>
                  Import Dari Bank Soal
                  <select
                    value={selectedBankForRoom}
                    onChange={(event) => setSelectedBankForRoom(event.target.value)}
                  >
                    <option value="all">Semua Bank Soal ({questions.length} soal)</option>
                    {banks.map((bank) => {
                      const count = questions.filter((q) => q.bankId === bank.id).length;
                      return (
                        <option key={bank.id} value={bank.id}>
                          {bank.title} ({count} soal)
                        </option>
                      );
                    })}
                  </select>
                </label>

                <label>
                  Nama pertandingan
                  <input
                    value={roomTitle}
                    onChange={(event) => setRoomTitle(event.target.value)}
                    placeholder="Contoh: Kuis Matematika Bab 1"
                  />
                </label>

                <label>
                  Durasi match
                  <select value={roomDuration} onChange={(event) => setRoomDuration(event.target.value)}>
                    <option value="5">5 menit</option>
                    <option value="10">10 menit</option>
                    <option value="15">15 menit</option>
                    <option value="20">20 menit</option>
                  </select>
                </label>

                <div className="random-preview">
                  <div>
                    <span className="preview-icon">✣</span>
                    <div>
                      <strong>Kota & obstacle</strong>
                      <small>Random otomatis setiap room</small>
                    </div>
                  </div>
                  <span className="shuffle">⤨</span>
                </div>
                <div className="city-chips">
                  <span>Seed baru</span>
                  <span>Layout random</span>
                  <span>Soal dari bank terpilih</span>
                </div>
                <button className="primary-button full-button" type="submit">
                  Generate room code <span>↗</span>
                </button>
              </form>

              <div className="panel room-list-panel">
                <div className="panel-heading">
                  <div>
                    <div className="eyebrow">ROOM AKTIF</div>
                    <h3>Bagikan ke pemain</h3>
                  </div>
                  <span className="total-badge">{rooms.length} room</span>
                </div>
                {roomCreated && (
                  <div className="new-room-card">
                    <div>
                      <small>ROOM CODE BARU</small>
                      <strong>{roomCreated.code}</strong>
                    </div>
                    <button onClick={() => navigator.clipboard?.writeText(roomCreated.code)}>Salin kode</button>
                    <p>
                      {roomCreated.title} · {roomCreated.bankTitle ?? "Semua bank"} · {roomCreated.layout} · seed{" "}
                      {roomCreated.seed}
                    </p>
                  </div>
                )}
                {rooms.length === 0 ? (
                  <EmptyState text="Belum ada room aktif. Konfigurasi pertandingan di sebelah kiri." />
                ) : (
                  <div className="room-list">
                    {rooms.map((room) => (
                      <RoomRow key={room.code} room={room} detailed />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "rooms" && (
          <div className="page-content room-monitor-wrap">
            <RoomMonitor
              rooms={rooms}
              selectedRoomCode={selectedRoomCode}
              selectedRoomStatus={selectedRoomStatus}
              roomPlayers={roomPlayers}
              roomQuestions={roomQuestions}
              allQuestions={questions}
              onSelect={setSelectedRoomCode}
              onLifecycle={setRoomLifecycle}
              onDelete={deleteRoom}
            />
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  return (
    <div className={`stat-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
      <i />
    </div>
  );
}

function PageTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="page-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );
}

function RoomRow({ room, detailed = false }: { room: Room; detailed?: boolean }) {
  return (
    <div className="room-row">
      <div className="room-symbol">⌁</div>
      <div className="room-copy">
        <strong>{room.title}</strong>
        <small>
          {room.bankTitle ? `Bank: ${room.bankTitle} · ` : ""}
          {room.questionIds.length} soal · {room.duration} menit
        </small>
        {detailed && (
          <small className="seed">
            seed {room.seed} · {room.cityTheme}
          </small>
        )}
      </div>
      <div className="room-code">{room.code}</div>
    </div>
  );
}

function RoomMonitor({
  rooms,
  selectedRoomCode,
  selectedRoomStatus,
  roomPlayers,
  roomQuestions,
  allQuestions,
  onSelect,
  onLifecycle,
  onDelete,
}: {
  rooms: Room[];
  selectedRoomCode: string;
  selectedRoomStatus: Room["status"];
  roomPlayers: Record<string, RoomPlayer>;
  roomQuestions: Question[];
  allQuestions: Question[];
  onSelect: (code: string) => void;
  onLifecycle: (status: Room["status"]) => void;
  onDelete: () => void;
}) {
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  const selectedRoom = rooms.find((room) => room.code === selectedRoomCode);
  const playerEntries = Object.entries(roomPlayers).filter(
    ([, player]) => typeof player?.name === "string" && player.name.trim().length > 0
  );

  const displayQuestions = useMemo(() => {
    if (roomQuestions.length > 0) return roomQuestions;
    if (selectedRoom?.questionIds && selectedRoom.questionIds.length > 0) {
      return allQuestions.filter((q) => selectedRoom.questionIds.includes(q.id));
    }
    return [];
  }, [roomQuestions, selectedRoom, allQuestions]);

  // Urutkan siswa berdasarkan skor tertinggi
  const sortedPlayers = [...playerEntries].sort((a, b) => (b[1].score ?? 0) - (a[1].score ?? 0));
  const onlineCount = playerEntries.filter(([, p]) => p.online !== false).length;
  const totalQuestions =
    displayQuestions.length > 0 ? displayQuestions.length : selectedRoom?.questionIds.length ?? 0;

  // Analisis kelas
  const totalAnswersGiven = playerEntries.reduce(
    (sum, [, p]) => sum + Object.keys(p.answers ?? {}).length,
    0
  );
  const totalCorrectGiven = playerEntries.reduce((sum, [, p]) => {
    return sum + Object.values(p.answers ?? {}).filter((a) => a.isCorrect).length;
  }, 0);
  const classAvgScore =
    playerEntries.length > 0
      ? Math.round(playerEntries.reduce((sum, [, p]) => sum + (p.score ?? 0), 0) / playerEntries.length)
      : 0;
  const accuracyPct = totalAnswersGiven > 0 ? Math.round((totalCorrectGiven / totalAnswersGiven) * 100) : 0;

  return (
    <div className="panel room-monitor">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">LIVE MONITOR & ANALISIS PENGERJAAN</div>
          <h3>Pantau Aktivitas Siswa</h3>
        </div>
        <span className={`room-state ${selectedRoomStatus}`}>● {selectedRoomStatus ?? "lobby"}</span>
      </div>

      {rooms.length === 0 ? (
        <EmptyState text="Buat room untuk melihat pemain dan mengelola status pertandingan." />
      ) : (
        <>
          <label className="monitor-select">
            Pilih room
            <select value={selectedRoomCode} onChange={(event) => onSelect(event.target.value)}>
              {rooms.map((room) => (
                <option key={room.code} value={room.code}>
                  {room.code} — {room.title} ({room.bankTitle ?? "Semua bank"})
                </option>
              ))}
            </select>
          </label>

          {/* Baris Analisis Kelas */}
          <div className="class-analytics-bar">
            <div className="analytics-card">
              <small>Total Siswa</small>
              <strong>
                {playerEntries.length}{" "}
                <span style={{ fontSize: "12px", fontWeight: "600", color: "#16a34a" }}>
                  ({onlineCount} online)
                </span>
              </strong>
            </div>
            <div className="analytics-card">
              <small>Rata-rata Skor</small>
              <strong>{classAvgScore} pts</strong>
            </div>
            <div className="analytics-card">
              <small>Akurasi Kelas</small>
              <strong>
                {accuracyPct}%{" "}
                <span style={{ fontSize: "12px", fontWeight: "600", color: "#64748b" }}>
                  ({totalCorrectGiven}/{totalAnswersGiven})
                </span>
              </strong>
            </div>
            <div className="analytics-card">
              <small>Soal Tersedia</small>
              <strong>{totalQuestions} butir</strong>
            </div>
          </div>

          <div className="monitor-actions">
            <button
              className="small-button"
              onClick={() => onLifecycle("running")}
              disabled={selectedRoomStatus === "running" || selectedRoomStatus === "finished"}
            >
              Mulai room
            </button>
            <button
              className="danger-button"
              onClick={() => onLifecycle("finished")}
              disabled={selectedRoomStatus === "finished"}
            >
              Stop room
            </button>
            <button className="danger-button delete-room-button" onClick={onDelete}>
              Hapus room
            </button>
          </div>

          <div className="monitor-players">
            <div className="label-row">
              <label>Progress & Lembar Jawaban Siswa</label>
              <span>{playerEntries.length} siswa terdaftar</span>
            </div>

            {playerEntries.length === 0 ? (
              <EmptyState text="Belum ada pemain yang bergabung di room ini. Bagikan kode room ke siswa." />
            ) : (
              sortedPlayers.map(([id, player]) => {
                const answers = player.answers ?? {};
                const correctCount = Object.values(answers).filter((a) => a.isCorrect).length;
                const wrongCount = Object.values(answers).filter((a) => !a.isCorrect).length;
                const completedCount =
                  player.completedQuestions?.length ?? Object.keys(answers).length;
                const isOnline = player.online !== false;
                const isExpanded = expandedPlayerId === id;

                return (
                  <div key={id} className={`monitor-player-card ${isExpanded ? "is-active" : ""}`}>
                    <div
                      className="monitor-player-header"
                      onClick={() => setExpandedPlayerId(isExpanded ? null : id)}
                    >
                      <span className="player-avatar">
                        {player.name ? player.name.slice(0, 1).toUpperCase() : "?"}
                      </span>
                      <div className="player-meta-info">
                        <div className="player-name-row">
                          <strong>{player.name}</strong>
                          <span className={`player-online-badge ${isOnline ? "online" : "offline"}`}>
                            <span className="online-dot" />
                            {isOnline ? "Online" : "Offline"}
                          </span>
                        </div>
                        <div className="player-stats-row">
                          <span className="stat-pill progress">
                            {completedCount}/{totalQuestions} Soal
                          </span>
                          <span className="stat-pill correct">✓ {correctCount} Benar</span>
                          <span className="stat-pill wrong">✗ {wrongCount} Salah</span>
                        </div>
                      </div>
                      <div className="monitor-player-right">
                        <span className="player-score">{player.score ?? 0} pts</span>
                        <button type="button" className="inspect-toggle-btn">
                          {isExpanded ? "Tutup detail ▲" : "Lihat pengerjaan ▼"}
                        </button>
                      </div>
                    </div>

                    {/* Drawer Jawaban Siswa per Butir Soal */}
                    {isExpanded && (
                      <div className="player-answers-drawer">
                        {displayQuestions.length === 0 ? (
                          <small style={{ color: "#64748b" }}>
                            Belum ada rincian butir soal untuk room ini.
                          </small>
                        ) : (
                          displayQuestions.map((question, qIdx) => {
                            const ans = answers[question.id];
                            if (ans) {
                              const isCorrect = ans.isCorrect;
                              return (
                                <div
                                  key={question.id}
                                  className={`student-answer-item ${isCorrect ? "correct" : "wrong"}`}
                                >
                                  <div className="answer-item-top">
                                    <span className="answer-item-num">Soal #{qIdx + 1}</span>
                                    <span className={`answer-status-pill ${isCorrect ? "correct" : "wrong"}`}>
                                      {isCorrect ? `✓ BENAR (+${ans.pointsAwarded} pts)` : "✗ SALAH (0 pts)"}
                                    </span>
                                  </div>
                                  <p className="answer-question-text">{question.text}</p>
                                  <div className="answer-details-row">
                                    <span className={`ans-given ${isCorrect ? "is-correct" : ""}`}>
                                      Jawaban siswa: <strong>{ans.playerAnswer || "(kosong)"}</strong>
                                    </span>
                                    <span className="ans-key">
                                      Kunci jawaban: <strong>{ans.correctAnswer || question.answer}</strong>
                                    </span>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div key={question.id} className="student-answer-item pending">
                                <div className="answer-item-top">
                                  <span className="answer-item-num">Soal #{qIdx + 1}</span>
                                  <span className="answer-status-pill pending">Belum dikerjakan</span>
                                </div>
                                <p className="answer-question-text">{question.text}</p>
                                <div className="answer-details-row">
                                  <span className="ans-key">
                                    Kunci jawaban: <strong>{question.answer}</strong>
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <span>○</span>
      <p>{text}</p>
    </div>
  );
}
