"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { get, onValue, onDisconnect, ref, set, update } from "firebase/database";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { firestore, realtimeDb } from "@/lib/firebase";

type Player = { name: string; joinedAt: number; score?: number; online?: boolean; position?: { x: number; z: number } };

export default function PlayPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joined, setJoined] = useState(false);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    queueMicrotask(() => {
      const queryRoom = new URLSearchParams(window.location.search).get("room");
      const savedName = window.localStorage.getItem("kyunika-player-name");
      const savedRoom = window.localStorage.getItem("kyunika-active-room");
      const targetRoom = (queryRoom || savedRoom || "").toUpperCase();

      if (savedName) setName(savedName);
      if (targetRoom) setRoomCode(targetRoom);
      if (savedName && targetRoom && !queryRoom) {
        setJoined(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!joined || !realtimeDb) return;
    const code = roomCode.trim().toUpperCase();
    const playerId = window.localStorage.getItem("kyunika-player-id") ?? crypto.randomUUID();
    window.localStorage.setItem("kyunika-player-id", playerId);
    const playersRef = ref(realtimeDb, `rooms/${code}/players`);
    const metaRef = ref(realtimeDb, `rooms/${code}/meta`);
    const playerRef = ref(realtimeDb, `rooms/${code}/players/${playerId}`);
    const onlineRef = ref(realtimeDb, `rooms/${code}/players/${playerId}/online`);
    const lastActiveRef = ref(realtimeDb, `rooms/${code}/players/${playerId}/lastActive`);
    const player = { name: name.trim(), joinedAt: Date.now(), score: 0, online: true, position: { x: 0, z: 0 } };
    let cleanup = () => {};
    let cancelled = false;
    async function connectToRoom() {
      try {
        const [metaSnapshot, firestoreSnapshot, playerSnapshot] = await Promise.all([
          get(metaRef),
          firestore ? getDoc(doc(firestore, "rooms", code)) : Promise.resolve(null),
          get(playerRef),
        ]);
        const status = metaSnapshot.val()?.status;
        if (cancelled) return;
        if (!metaSnapshot.exists()) throw new Error("Room tidak ditemukan atau sudah dihapus.");
        if (firestore && (!firestoreSnapshot || !firestoreSnapshot.exists())) throw new Error("Room tidak ditemukan di database.");
        if (status === "finished") throw new Error("Room ini sudah dihentikan oleh admin.");
        
        window.localStorage.setItem("kyunika-player-name", name.trim());
        window.localStorage.setItem("kyunika-active-room", code);
        
        // Preserve existing score & answer history if player is rejoining or refreshed
        if (playerSnapshot.exists()) {
          await update(playerRef, {
            name: name.trim(),
            online: true,
            lastActive: Date.now(),
          });
        } else {
          await set(playerRef, player);
        }
        await onDisconnect(onlineRef).set(false);
        await onDisconnect(lastActiveRef).set(Date.now());
        if (cancelled) return;
        const unsubscribePlayers = onValue(playersRef, (snapshot) => setPlayers((snapshot.val() ?? {}) as Record<string, Player>), (error) => setError(`Gagal membaca lobby: ${error.message}`));
        const unsubscribeMeta = onValue(metaRef, (snapshot) => {
          const nextStatus = snapshot.val()?.status;
          if (nextStatus === "running") {
            window.localStorage.setItem("kyunika-player-name", name.trim());
            window.localStorage.setItem("kyunika-active-room", code);
            router.push(`/game?room=${code}`);
            return;
          }
          if (!snapshot.exists()) {
            setError("Room sudah dihapus oleh admin.");
            setJoined(false);
            window.localStorage.removeItem("kyunika-active-room");
          } else if (nextStatus === "finished") {
            // Keep player records intact for admin review; mark offline
            void update(playerRef, { online: false });
            setError("Room ini sudah dihentikan oleh admin.");
            setJoined(false);
            window.localStorage.removeItem("kyunika-active-room");
          }
        });
        const unsubscribeFirestore = firestore ? onSnapshot(doc(firestore, "rooms", code), (snapshot) => {
          if (!snapshot.exists()) {
            setError("Room sudah dihapus oleh admin.");
            setJoined(false);
            window.localStorage.removeItem("kyunika-active-room");
          }
        }, (error) => setError(`Gagal memantau room: ${error.message}`)) : () => {};
        cleanup = () => { unsubscribePlayers(); unsubscribeMeta(); unsubscribeFirestore(); };
      } catch (error) {
        if (!cancelled) {
          setError(error instanceof Error ? error.message : "Gagal masuk ke room.");
          setJoined(false);
          window.localStorage.removeItem("kyunika-active-room");
        }
      }
    }
    void connectToRoom();
    return () => { cancelled = true; cleanup(); };
  }, [joined, name, roomCode, router]);

  async function joinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!realtimeDb) { setError("Firebase Realtime Database belum terkonfigurasi."); return; }
    if (!name.trim() || roomCode.trim().length < 4) { setError("Isi nama dan kode room terlebih dahulu."); return; }
    const code = roomCode.trim().toUpperCase();
    try {
      const [snapshot, firestoreSnapshot] = await Promise.all([
        get(ref(realtimeDb, `rooms/${code}/meta`)),
        firestore ? getDoc(doc(firestore, "rooms", code)) : Promise.resolve(null),
      ]);
      if (!snapshot.exists() || (firestore && (!firestoreSnapshot || !firestoreSnapshot.exists()))) throw new Error("Room tidak ditemukan atau sudah dihapus.");
      if (snapshot.val()?.status === "finished") throw new Error("Room ini sudah dihentikan oleh admin.");
      window.localStorage.setItem("kyunika-player-name", name.trim());
      window.localStorage.setItem("kyunika-active-room", code);
      setError(""); setJoined(true);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Gagal memeriksa room.");
    }
  }

  if (joined) { const validPlayers = Object.entries(players).filter(([, player]) => typeof player?.name === "string" && player.name.trim().length > 0); return <main className="play-shell"><div className="play-card lobby-card"><div className="play-brand"><span className="brand-mark">K</span> Kyunika Games</div><div className="lobby-top"><div><div className="eyebrow">ROOM LOBBY</div><h1>{roomCode.toUpperCase()}</h1><p>Tunggu pemain lain masuk. Kota akan dimulai saat host membuka pertandingan.</p></div><span className="lobby-status">● LIVE</span></div><div className="player-count"><strong>{validPlayers.length}</strong><span>pemain sudah bergabung</span></div><div className="player-grid">{validPlayers.map(([id, player]) => <div className="player-chip" key={id}><span className="player-avatar">{player.name.slice(0, 1).toUpperCase()}</span><strong>{player.name}</strong>{id === window.localStorage.getItem("kyunika-player-id") && <small>Kamu</small>}</div>)}</div><button className="play-back" onClick={() => { const playerId = window.localStorage.getItem("kyunika-player-id"); if (realtimeDb && playerId) void update(ref(realtimeDb, `rooms/${roomCode.toUpperCase()}/players/${playerId}`), { online: false }); setJoined(false); setPlayers({}); window.localStorage.removeItem("kyunika-active-room"); }}>Keluar dari lobby</button></div></main>; }

  return <main className="play-shell"><div className="play-card join-card"><div className="play-brand"><span className="brand-mark">K</span> Kyunika Games</div><div className="eyebrow">MULTIPLAYER QUIZ RACE</div><h1>Masuk ke<br /><em>kota permainan.</em></h1><p>Masukkan kode room dari admin, pilih nama, lalu bersiap menjelajah dan menjawab paling cepat.</p><form onSubmit={joinRoom}><label>Nama pemain<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Budi" /></label><label>Kode room<input required value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} maxLength={8} placeholder="ABC123" /></label>{error && <div className="play-error">{error}</div>}<button className="primary-button full-button" type="submit">Masuk room <span>↗</span></button></form><small className="data-note">Terhubung real-time dengan Firebase</small><a href="/admin" className="host-admin-link">Host / Buat Room di Admin Dashboard ➔</a></div></main>;
}
