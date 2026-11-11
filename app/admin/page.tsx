"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { onValue, ref, remove, set, update } from "firebase/database";
import { firebaseEnabled, firestore, realtimeDb } from "@/lib/firebase";

type QuestionType = "multiple-choice" | "short-answer";
type Question = { id: string; type: QuestionType; text: string; options: string[]; answer: string; points: number };
type Room = { code: string; title: string; cityTheme: string; layout: string; seed: number; duration: number; createdAt: string; questionIds: string[]; status?: "lobby" | "running" | "finished" };
type RoomPlayer = { name: string; joinedAt: number; score?: number };

const starterQuestions: Question[] = [
  { id: "q-1", type: "multiple-choice", text: "Planet terdekat dengan Matahari adalah?", options: ["Venus", "Mars", "Merkurius", "Bumi"], answer: "Merkurius", points: 100 },
  { id: "q-2", type: "short-answer", text: "Sebutkan ibu kota Indonesia.", options: [], answer: "Jakarta", points: 120 },
  { id: "q-3", type: "multiple-choice", text: "Berapa hasil dari 8 × 7?", options: ["54", "56", "64", "48"], answer: "56", points: 100 },
];
const layouts = ["Suburban Grid", "Park Loop", "Crossroad"];
const themes = ["Sunny Suburban", "Green District", "Warm Neighborhood"];
const createCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const randomItem = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];
function loadStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(key);
  return stored ? JSON.parse(stored) as T : fallback;
}

export default function AdminPage() {
  const [questions, setQuestions] = useState<Question[]>(starterQuestions);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "questions" | "rooms">("overview");
  const [questionType, setQuestionType] = useState<QuestionType>("multiple-choice");
  const [questionText, setQuestionText] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [answer, setAnswer] = useState("");
  const [points, setPoints] = useState("100");
  const [roomTitle, setRoomTitle] = useState("Kuis Seru Hari Ini");
  const [roomDuration, setRoomDuration] = useState("10");
  const [roomCreated, setRoomCreated] = useState<Room | null>(null);
  const [dataSource, setDataSource] = useState(firebaseEnabled ? "Firebase" : "Local preview");
  const [hydrated, setHydrated] = useState(false);
  const [selectedRoomCode, setSelectedRoomCode] = useState("");
  const [selectedRoomStatus, setSelectedRoomStatus] = useState<Room["status"]>("lobby");
  const [roomPlayers, setRoomPlayers] = useState<Record<string, RoomPlayer>>({});

  useEffect(() => {
    queueMicrotask(() => {
      setQuestions(loadStored("kyunika-questions", starterQuestions));
      setRooms(loadStored("kyunika-rooms", []));
      setHydrated(true);
    });
  }, []);
  useEffect(() => {
    if (!firestore) return;
    const db = firestore;
    async function loadFirebaseData() {
      try {
        const [questionSnapshot, roomSnapshot] = await Promise.all([
          getDocs(collection(db, "questions")),
          getDocs(collection(db, "rooms")),
        ]);
        if (!questionSnapshot.empty) {
          setQuestions(questionSnapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Question)));
        }
        if (!roomSnapshot.empty) {
          setRooms(roomSnapshot.docs.map((item) => ({ id: item.id, ...item.data() } as unknown as Room)));
        }
        setDataSource("Firebase");
      } catch (error) {
        console.error("Firebase data load failed", error);
        setDataSource("Local fallback");
      }
    }
    void loadFirebaseData();
  }, []);
  useEffect(() => { if (hydrated) window.localStorage.setItem("kyunika-questions", JSON.stringify(questions)); }, [hydrated, questions]);
  useEffect(() => { if (hydrated) window.localStorage.setItem("kyunika-rooms", JSON.stringify(rooms)); }, [hydrated, rooms]);
  useEffect(() => {
    if (!selectedRoomCode && rooms[0]) queueMicrotask(() => setSelectedRoomCode(rooms[0].code));
  }, [rooms, selectedRoomCode]);
  useEffect(() => {
    if (!realtimeDb || !selectedRoomCode) return;
    const roomRef = ref(realtimeDb, `rooms/${selectedRoomCode}`);
    return onValue(roomRef, (snapshot) => {
      const value = snapshot.val() ?? {};
      setRoomPlayers((value.players ?? {}) as Record<string, RoomPlayer>);
      setSelectedRoomStatus(value.meta?.status ?? "lobby");
    }, (error) => console.error("Room monitor failed", error));
  }, [selectedRoomCode]);
  const totalPoints = useMemo(() => questions.reduce((sum, item) => sum + item.points, 0), [questions]);

  function resetQuestionForm() { setQuestionText(""); setOptions(["", "", "", ""]); setAnswer(""); setPoints("100"); }
  function handleQuestionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanText = questionText.trim();
    const cleanOptions = options.map((option) => option.trim()).filter(Boolean);
    if (!cleanText || !answer.trim() || (questionType === "multiple-choice" && cleanOptions.length < 2)) return;
    const newQuestion: Question = { id: createId("q"), type: questionType, text: cleanText, options: questionType === "multiple-choice" ? cleanOptions : [], answer: answer.trim(), points: Math.max(10, Number(points) || 100) };
    setQuestions((current) => [newQuestion, ...current]);
    if (firestore) void setDoc(doc(firestore, "questions", newQuestion.id), { ...newQuestion, createdAt: new Date().toISOString() }).catch((error) => console.error("Firebase question save failed", error));
    resetQuestionForm(); setActiveTab("questions");
  }
  function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const room: Room = { code: createCode(), title: roomTitle.trim() || "Kuis Kyunika", cityTheme: randomItem(themes), layout: randomItem(layouts), seed: Math.floor(Math.random() * 900000) + 100000, duration: Number(roomDuration) || 10, createdAt: new Date().toISOString(), questionIds: questions.map((question) => question.id), status: "lobby" };
    setRooms((current) => [room, ...current]);
    if (firestore) void setDoc(doc(firestore, "rooms", room.code), room).catch((error) => console.error("Firebase room save failed", error));
    if (realtimeDb) {
      void set(ref(realtimeDb, `rooms/${room.code}/meta`), { code: room.code, title: room.title, layout: room.layout, cityTheme: room.cityTheme, seed: room.seed, duration: room.duration, questionIds: room.questionIds, status: "lobby" }).catch((error) => console.error("Realtime Database room save failed", error));
      void set(ref(realtimeDb, `rooms/${room.code}/questions`), questions).catch((error) => console.error("Realtime Database questions save failed", error));
    }
    setRoomCreated(room); setSelectedRoomCode(room.code); setSelectedRoomStatus("lobby"); setActiveTab("rooms");
  }
  function setRoomLifecycle(status: Room["status"]) {
    if (!selectedRoomCode || !status) return;
    setSelectedRoomStatus(status);
    setRooms((current) => current.map((room) => room.code === selectedRoomCode ? { ...room, status } : room));
    if (firestore) void updateDoc(doc(firestore, "rooms", selectedRoomCode), { status }).catch((error) => console.error("Firebase room status update failed", error));
    if (realtimeDb) void update(ref(realtimeDb, `rooms/${selectedRoomCode}/meta`), { status }).catch((error) => console.error("Realtime room status update failed", error));
  }
  async function deleteRoom() {
    if (!selectedRoomCode || !window.confirm(`Hapus room ${selectedRoomCode}? Data room dan lobby pemain akan dihapus.`)) return;
    const code = selectedRoomCode;
    try {
      await Promise.all([
        firestore ? deleteDoc(doc(firestore, "rooms", code)) : Promise.resolve(),
        realtimeDb ? remove(ref(realtimeDb, `rooms/${code}`)) : Promise.resolve(),
      ]);
      setRooms((current) => current.filter((room) => room.code !== code));
      setRoomCreated((current) => current?.code === code ? null : current);
      setSelectedRoomCode(""); setSelectedRoomStatus("lobby"); setRoomPlayers({});
    } catch (error) {
      console.error("Room delete failed", error);
      window.alert("Room gagal dihapus dari Firebase. Periksa Security Rules dan coba lagi.");
    }
  }

  return <main className="admin-shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark">K</span><span>Kyunika<span className="brand-soft"> Games</span></span></div><div className="workspace-label">WORKSPACE</div><nav className="nav-list" aria-label="Navigasi admin">
      <button className={activeTab === "overview" ? "nav-item active" : "nav-item"} onClick={() => setActiveTab("overview")}><span>⌂</span> Overview</button>
      <button className={activeTab === "questions" ? "nav-item active" : "nav-item"} onClick={() => setActiveTab("questions")}><span>?</span> Bank soal <b>{questions.length}</b></button>
      <button className={activeTab === "rooms" ? "nav-item active" : "nav-item"} onClick={() => setActiveTab("rooms")}><span>♧</span> Room aktif <b>{rooms.length}</b></button>
    </nav><div className="sidebar-bottom"><div className="mini-profile"><div className="avatar">A</div><div><strong>Admin Kuis</strong><small>Workspace owner</small></div><span>•••</span></div><div className="version">Kyunika admin <span>v0.1</span></div></div></aside>
    <section className="content"><header className="topbar"><div className="crumb">Workspace <span>/</span> <strong>{activeTab === "overview" ? "Overview" : activeTab === "questions" ? "Bank soal" : "Room aktif"}</strong></div><div className="top-actions"><span className="live-dot">●</span> {dataSource} <button className="icon-button">⌘</button></div></header>
      {activeTab === "overview" && <div className="page-content"><div className="hero"><div><div className="eyebrow">CONTROL CENTER <span>•</span> MULTIPLAYER</div><h1>Siapkan kuis,<br /><em>biarkan kota bermain.</em></h1><p>Buat soal, acak kota, lalu bagikan kode room. Pemain tinggal masuk dan berlomba menyelesaikan tantangan.</p><div className="hero-actions"><button className="primary-button" onClick={() => setActiveTab("rooms")}>Buat room baru <span>↗</span></button><button className="text-button" onClick={() => setActiveTab("questions")}>Kelola bank soal <span>→</span></button></div></div><div className="hero-art"><div className="sun" /><div className="city-card"><div className="cloud cloud-one" /><div className="cloud cloud-two" /><div className="road" /><div className="house house-a" /><div className="house house-b" /><div className="tree tree-a">♣</div><div className="tree tree-b">♣</div><div className="pin pin-a">?</div><div className="pin pin-b">?</div><div className="player">●</div></div></div></div><div className="section-heading"><div><div className="eyebrow">RINGKASAN</div><h2>Semua siap dimainkan</h2></div><span className="muted">Data tersimpan di browser ini</span></div><div className="stat-grid"><Stat label="Total soal" value={String(questions.length).padStart(2, "0")} detail={`${totalPoints} total poin`} tone="yellow" /><Stat label="Room dibuat" value={String(rooms.length).padStart(2, "0")} detail="Siap dibagikan" tone="blue" /><Stat label="Variasi kota" value="03" detail="Preset layout aktif" tone="green" /></div><div className="lower-grid"><div className="panel activity-panel"><div className="panel-heading"><div><div className="eyebrow">AKTIVITAS TERBARU</div><h3>Room terakhir</h3></div><button className="small-button" onClick={() => setActiveTab("rooms")}>Lihat semua</button></div>{rooms.length === 0 ? <EmptyState text="Belum ada room. Buat room pertama untuk mulai bermain." /> : rooms.slice(0, 3).map((room) => <RoomRow key={room.code} room={room} />)}</div><div className="panel guide-panel"><div className="guide-icon">✦</div><div className="eyebrow">CARA KERJA</div><h3>Satu room,<br />satu kota baru.</h3><p>Setiap room mendapat seed kota yang berbeda. Soal tetap sama untuk semua pemain, tapi progress masing-masing tetap personal.</p><button className="text-button" onClick={() => setActiveTab("rooms")}>Mulai buat room <span>→</span></button></div></div></div>}
      {activeTab === "questions" && <div className="page-content"><PageTitle eyebrow="QUESTION BUILDER" title="Bangun bank soal" description="Campurkan pilihan ganda dan isian singkat untuk membuat perlombaan lebih seru." /><div className="question-layout"><form className="panel question-form" onSubmit={handleQuestionSubmit}><div className="panel-heading"><div><div className="eyebrow">SOAL BARU</div><h3>Tulis tantanganmu</h3></div><span className="step-pill">01 / 01</span></div><label>Pertanyaan<input required value={questionText} onChange={(event) => setQuestionText(event.target.value)} placeholder="Contoh: Apa ibu kota Indonesia?" /></label><div className="type-switch"><button type="button" className={questionType === "multiple-choice" ? "type-option selected" : "type-option"} onClick={() => setQuestionType("multiple-choice")}><span>☷</span><strong>Pilihan ganda</strong><small>Pemain memilih satu jawaban</small></button><button type="button" className={questionType === "short-answer" ? "type-option selected" : "type-option"} onClick={() => setQuestionType("short-answer")}><span>⌁</span><strong>Isian singkat</strong><small>Pemain mengetik jawaban</small></button></div>{questionType === "multiple-choice" && <div className="options-block"><div className="label-row"><label>Pilihan jawaban</label><span>Jawaban benar ditandai</span></div>{options.map((option, index) => <div className="option-input" key={index}><span className="option-letter">{String.fromCharCode(65 + index)}</span><input required value={option} onChange={(event) => setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`Pilihan ${String.fromCharCode(65 + index)}`} /><button type="button" className={answer === option && option ? "correct-toggle selected" : "correct-toggle"} aria-label={`Tandai pilihan ${index + 1} sebagai jawaban benar`} onClick={() => setAnswer(option)}>✓</button></div>)}</div>}{questionType === "short-answer" && <label>Jawaban benar<input required value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Tulis jawaban yang diterima" /></label>}{questionType === "multiple-choice" && <div className="answer-hint">{answer ? <>Jawaban benar: <strong>{answer}</strong></> : "Klik tanda centang pada pilihan yang benar"}</div>}<div className="form-row"><label>Nilai soal<input type="number" min="10" step="10" value={points} onChange={(event) => setPoints(event.target.value)} /></label><div className="points-note">Poin lebih tinggi memberi reward lebih besar di leaderboard.</div></div><button className="primary-button full-button" type="submit">Simpan soal <span>＋</span></button></form><div className="panel bank-panel"><div className="panel-heading"><div><div className="eyebrow">BANK SOAL</div><h3>{questions.length} pertanyaan</h3></div><span className="total-badge">{totalPoints} pts</span></div><div className="question-list">{questions.map((question, index) => <div className="question-row" key={question.id}><div className="question-number">{String(index + 1).padStart(2, "0")}</div><div className="question-copy"><div className="question-meta"><span className={question.type === "multiple-choice" ? "tag purple" : "tag orange"}>{question.type === "multiple-choice" ? "PILIHAN GANDA" : "ISIAN"}</span><span>{question.points} pts</span></div><strong>{question.text}</strong><small>Jawaban: {question.answer}</small></div><button className="delete-button" onClick={() => { setQuestions((current) => current.filter((item) => item.id !== question.id)); if (firestore) void deleteDoc(doc(firestore, "questions", question.id)).catch((error) => console.error("Firebase question delete failed", error)); }} aria-label="Hapus soal">×</button></div>)}</div></div></div></div>}
      {activeTab === "rooms" && <div className="page-content"><PageTitle eyebrow="ROOM MANAGER" title="Buat arena pertandingan" description="Bagikan kode room ke pemain. Kota, obstacle, dan titik soal akan diacak otomatis saat room dibuat." /><div className="room-layout"><form className="panel room-form" onSubmit={createRoom}><div className="panel-heading"><div><div className="eyebrow">ROOM BARU</div><h3>Atur pertandingan</h3></div><span className="room-live">● READY</span></div><label>Nama pertandingan<input value={roomTitle} onChange={(event) => setRoomTitle(event.target.value)} placeholder="Contoh: Kuis Kelas 8A" /></label><label>Durasi match<select value={roomDuration} onChange={(event) => setRoomDuration(event.target.value)}><option value="5">5 menit</option><option value="10">10 menit</option><option value="15">15 menit</option><option value="20">20 menit</option></select></label><div className="random-preview"><div><span className="preview-icon">✣</span><div><strong>Kota & obstacle</strong><small>Random otomatis setiap room</small></div></div><span className="shuffle">⤨</span></div><div className="city-chips"><span>Seed baru</span><span>Layout random</span><span>5–10 titik soal</span></div><button className="primary-button full-button" type="submit">Generate room code <span>↗</span></button></form><div className="panel room-list-panel"><div className="panel-heading"><div><div className="eyebrow">ROOM AKTIF</div><h3>Bagikan ke pemain</h3></div><span className="total-badge">{rooms.length} room</span></div>{roomCreated && <div className="new-room-card"><div><small>ROOM CODE BARU</small><strong>{roomCreated.code}</strong></div><button onClick={() => navigator.clipboard?.writeText(roomCreated.code)}>Salin kode</button><p>{roomCreated.title} · {roomCreated.layout} · seed {roomCreated.seed}</p></div>}{rooms.length === 0 ? <EmptyState text="Belum ada room aktif. Konfigurasi pertandingan di sebelah kiri." /> : <div className="room-list">{rooms.map((room) => <RoomRow key={room.code} room={room} detailed />)}</div>}</div></div></div>}
      {activeTab === "rooms" && <div className="page-content room-monitor-wrap"><RoomMonitor rooms={rooms} selectedRoomCode={selectedRoomCode} selectedRoomStatus={selectedRoomStatus} roomPlayers={roomPlayers} onSelect={setSelectedRoomCode} onLifecycle={setRoomLifecycle} onDelete={deleteRoom} /></div>}
    </section>
  </main>;
}

function Stat({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) { return <div className={`stat-card ${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small><i /></div>; }
function PageTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <div className="page-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div></div>; }
function RoomRow({ room, detailed = false }: { room: Room; detailed?: boolean }) { return <div className="room-row"><div className="room-symbol">⌁</div><div className="room-copy"><strong>{room.title}</strong><small>{room.layout} · {room.questionIds.length} soal · {room.duration} menit</small>{detailed && <small className="seed">seed {room.seed} · {room.cityTheme}</small>}</div><div className="room-code">{room.code}</div></div>; }
function RoomMonitor({ rooms, selectedRoomCode, selectedRoomStatus, roomPlayers, onSelect, onLifecycle, onDelete }: { rooms: Room[]; selectedRoomCode: string; selectedRoomStatus: Room["status"]; roomPlayers: Record<string, RoomPlayer>; onSelect: (code: string) => void; onLifecycle: (status: Room["status"]) => void; onDelete: () => void }) {
  const selectedRoom = rooms.find((room) => room.code === selectedRoomCode);
  const validPlayers = Object.entries(roomPlayers).filter(([, player]) => typeof player?.name === "string" && player.name.trim().length > 0);
  return <div className="panel room-monitor"><div className="panel-heading"><div><div className="eyebrow">LIVE MONITOR</div><h3>Kelola pertandingan</h3></div><span className={`room-state ${selectedRoomStatus}`}>● {selectedRoomStatus ?? "lobby"}</span></div>{rooms.length === 0 ? <EmptyState text="Buat room untuk melihat pemain dan mengelola status pertandingan." /> : <><label className="monitor-select">Pilih room<select value={selectedRoomCode} onChange={(event) => onSelect(event.target.value)}>{rooms.map((room) => <option key={room.code} value={room.code}>{room.code} — {room.title}</option>)}</select></label><div className="monitor-summary"><div><strong>{validPlayers.length}</strong><small>pemain online</small></div><div><strong>{selectedRoom?.questionIds.length ?? 0}</strong><small>soal tersedia</small></div><div><strong>{selectedRoomStatus === "finished" ? "Selesai" : selectedRoomStatus === "running" ? "Berjalan" : "Menunggu"}</strong><small>status room</small></div></div><div className="monitor-actions"><button className="small-button" onClick={() => onLifecycle("running")} disabled={selectedRoomStatus === "running" || selectedRoomStatus === "finished"}>Mulai room</button><button className="danger-button" onClick={() => onLifecycle("finished")} disabled={selectedRoomStatus === "finished"}>Stop room</button><button className="danger-button delete-room-button" onClick={onDelete}>Hapus room</button></div><div className="monitor-players"><div className="label-row"><label>Pemain yang bergabung</label><span>{validPlayers.length} online</span></div>{validPlayers.length === 0 ? <EmptyState text="Belum ada pemain di room ini." /> : validPlayers.map(([id, player]) => <div className="monitor-player" key={id}><span className="player-avatar">{player.name.slice(0, 1).toUpperCase()}</span><strong>{player.name}</strong><span className="player-score">{player.score ?? 0} pts</span></div>)}</div></>}</div>;
}
function EmptyState({ text }: { text: string }) { return <div className="empty-state"><span>○</span><p>{text}</p></div>; }
