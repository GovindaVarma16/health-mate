import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  LineChart,
  Line,
} from "recharts";

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useNavigate,
} from "react-router-dom";

/* ---------------- BACKEND POST (Standard relative URL) ---------------- */
async function backendPost(payload) {
  // Standard relative URL expected by the environment
  const API_ENDPOINT = "/api/healthmate";
  const FETCH_TIMEOUT_MS = 20000;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(API_ENDPOINT, { // Use the standard relative URL
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 404 && payload?.type === "health_report") {
      let parsed;
      try {
        parsed = await response.json();
      } catch {
        parsed = { error: "Profile not found." };
      }
      return { __notFound: true, ...parsed };
    }

    if (!response.ok) {
      let parsed;
      try {
        // Attempt to parse JSON error body
        parsed = await response.json();
      } catch {
        // If JSON parsing fails, read the response as text for better debugging
        const errorText = await response.text();
        // Return structured error message including the response text if available
        parsed = { error: errorText || "Unknown backend error", status: response.status };
      }
      throw new Error(JSON.stringify(parsed));
    }

    return await response.json();
  } catch (err) {
    console.error("❌ Backend error:", err);
    throw err;
  }
}

/* ---------------- UI HELPERS (unchanged) ---------------- */
const CARD_BASE = "bg-white rounded-2xl p-3 shadow-sm";
function cardClass(extra = "") {
  return `${CARD_BASE} ${extra}`.trim();
}

/* ----------------------------------------------------------
   BACKEND STATUS (unchanged)
----------------------------------------------------------- */
function BackendStatus({ employeeId }) {
  const [ok, setOk] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await backendPost({
          employee_id: employeeId,
          type: "health_report",
        });

        if (!mounted) return;

        if (r?.__notFound) return setOk(true);

        setOk(!!r && !!r.profile);
      } catch (e) {
        if (mounted) setOk(false);
      }
    })();

    return () => (mounted = false);
  }, [employeeId]);

  if (ok === null) return <div className="text-xs text-gray-400">Backend: checking…</div>;
  return ok ? <div className="text-xs text-green-600"></div> : <div className="text-xs text-red-600">Backend: error</div>;
}

/* =========================
   BreathingWidget (unchanged)
   ========================= */
function BreathingWidget() {
  const MODE_CYCLES = {
    Calm: { inhale: 4, hold: 4, exhale: 6 },
    Relax: { inhale: 4, hold: 6, exhale: 6 },
    Focus: { inhale: 3, hold: 3, exhale: 3 },
  };

  const [breathingRunning, setBreathingRunning] = useState(false);
  const [breathingMode, setBreathingMode] = useState("Calm");
  const [breathingStep, setBreathingStep] = useState("idle");
  const [breathElapsedSec, setBreathElapsedSec] = useState(0);

  const breathTimerRef = useRef(null);
  const breathStartRef = useRef(null);

  function startBreathing(mode = "Calm") {
    if (breathingRunning) return;
    setBreathingMode(mode);
    setBreathingRunning(true);
    setBreathElapsedSec(0);
    setBreathingStep("inhale");
    breathStartRef.current = Date.now();
    if (breathTimerRef.current) clearInterval(breathTimerRef.current);

    const cycle = MODE_CYCLES[mode] || MODE_CYCLES.Calm;
    const cycleTotal = cycle.inhale + cycle.hold + cycle.exhale;

    breathTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - breathStartRef.current) / 1000);
      setBreathElapsedSec(elapsed);
      const offset = elapsed % cycleTotal;
      if (offset < cycle.inhale) setBreathingStep("inhale");
      else if (offset < cycle.inhale + cycle.hold) setBreathingStep("hold");
      else setBreathingStep("exhale");
    }, 1000);
  }

  function stopBreathing() {
    setBreathingRunning(false);
    setBreathingStep("idle");
    setBreathElapsedSec(0);
    if (breathTimerRef.current) {
      clearInterval(breathTimerRef.current);
      breathTimerRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      if (breathTimerRef.current) {
        clearInterval(breathTimerRef.current);
        breathTimerRef.current = null;
      }
    };
  }, []);

  const circleScale = breathingStep === "inhale" ? 1.15 : breathingStep === "hold" ? 1.05 : breathingStep === "exhale" ? 0.85 : 1;

  return (
    <div>
      <div className="mt-4 text-center p-5">
        <div
          style={{
            width: 140,
            height: 140,
            margin: "0 auto",
            borderRadius: "50%",
            background: "#eef2ff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${circleScale})`,
            transition: "transform 400ms ease",
            boxShadow: "inset 0 6px 18px rgba(99,102,241,0.08)",
          }}
        >
          <div className="text-sm text-gray-700">{breathingStep === "idle" ? "Ready" : breathingStep.toUpperCase()}</div>
        </div>

        <div className="mt-3 text-sm text-gray-600">{breathingRunning ? `Elapsed: ${breathElapsedSec}s` : "Tap Start to begin"}</div>

        <div className="mt-3 flex gap-2 justify-center">
          {!breathingRunning ? (
            <>
              <button onClick={() => startBreathing("Calm")} className="px-4 py-2 bg-indigo-600 text-white rounded">Start</button>
              <button onClick={() => startBreathing("Relax")} className="px-3 py-2 border rounded">Relax</button>
              <button onClick={() => startBreathing("Focus")} className="px-3 py-2 border rounded">Focus</button>
            </>
          ) : (
            <button onClick={stopBreathing} className="px-4 py-2 bg-red-500 text-white rounded">Stop</button>
          )}
        </div>

        <div className="mt-2 text-xs text-gray-400">Simple guided breathing — cycle lengths depend on mode.</div>
        </div>
    </div>
  );
}

/* =========================
   HealthDashboard component (unchanged logic, hover glow etc.)
   ========================= */
function HealthDashboard({ employeeIdProp }) {
  const [employeeId] = useState(employeeIdProp || localStorage.getItem("employee_id") || "emp_001");

  const [profile, setProfile] = useState(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [personalizedTips, setPersonalizedTips] = useState([]);
  const [chartData, setChartData] = useState({
    healthTrend: [],
    vitalsTrend: [],
    consultationsByMonth: [],
    remindersAdherence: [],
  });

  // hydration
  const MAX_GLASSES = 8;
  const [waterGlasses, setWaterGlasses] = useState(() => {
    const s = localStorage.getItem("hm_water_glasses");
    return s ? Number(s) : 0;
  });
  const hydrationDebounceRef = useRef(null);
  const hydrationLockRef = useRef(false);

  // mood
  const [mood, setMood] = useState(() => localStorage.getItem("hm_mood") || "");

  // chat / bmi / misc
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState(null);
  const [chatLoading, setChatLoading] = useState(false);
  const replyRef = useRef(null);
  const [profileEditing, setProfileEditing] = useState(false);
  const [draftProfile, setDraftProfile] = useState({});
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [bmi, setBmi] = useState(null);

  // active widget by hover/focus (no timeout)
  const [activeWidget, setActiveWidget] = useState(null);

  // Hover/focus handlers:
  const onEnter = (id) => setActiveWidget(id);
  const onLeave = () => setActiveWidget(null);
  // keyboard accessibility: focus/blur mirrors hover
  const onFocus = (id) => setActiveWidget(id);
  const onBlur = () => setActiveWidget(null);

  useEffect(() => {
    localStorage.setItem("hm_mood", mood);
  }, [mood]);
  useEffect(() => {
    localStorage.setItem("hm_water_glasses", String(waterGlasses));
  }, [waterGlasses]);

  const fetchHealthReport = useCallback(async () => {
    try {
      const data = await backendPost({
        employee_id: employeeId,
        type: "health_report",
      });

      if (data.__notFound) {
        setIsNewUser(true);
        return;
      }

      setIsNewUser(false);
      setProfile(data.profile || null);
      if (data.tips) {
        setPersonalizedTips(Array.isArray(data.tips) ? data.tips : [data.tips]);
      }

      if (data.hydration?.glasses !== undefined) setWaterGlasses(data.hydration.glasses);
    } catch (err) {
      console.error("fetchHealthReport", err);
    }
  }, [employeeId]);

  const fetchChartData = useCallback(async () => {
    try {
      const data = await backendPost({
        employee_id: employeeId,
        type: "chart_data",
      });

      console.info("fetchChartData -> backend returned:", data);

      const healthTrend = Array.isArray(data?.healthTrend) ? data.healthTrend : [];
      const vitalsTrend = Array.isArray(data?.vitalsTrend) ? data.vitalsTrend : [];
      const consultationsByMonth = Array.isArray(data?.consultationsByMonth) ? data.consultationsByMonth : [];
      const remindersAdherence = Array.isArray(data?.remindersAdherence) ? data.remindersAdherence : [];

      const demoHealthTrend = [
        { date: "2025-11-01", score: 72 },
        { date: "2025-11-05", score: 75 },
        { date: "2025-11-10", score: 68 },
        { date: "2025-11-15", score: 77 },
        { date: "2025-11-20", score: 82 },
      ];

      setChartData({
        healthTrend: healthTrend.length ? healthTrend : demoHealthTrend,
        vitalsTrend,
        consultationsByMonth,
        remindersAdherence,
      });

      if (!healthTrend.length) {
        console.warn("fetchChartData: backend returned empty healthTrend — showing demo data. Check your /api/healthmate chart_data response.");
      }
    } catch (err) {
      console.error("fetchChartData error", err);
      setChartData((prev) => ({
        ...prev,
        healthTrend: prev.healthTrend.length ? prev.healthTrend : [
          { date: "2025-11-01", score: 72 },
          { date: "2025-11-05", score: 75 },
          { date: "2025-11-10", score: 68 },
        ],
      }));
    }
  }, [employeeId]);

  useEffect(() => {
    if (!employeeId) return;
    localStorage.setItem("employee_id", employeeId);

    (async () => {
      await fetchHealthReport();
      await fetchChartData();
    })();

    return () => {
      if (hydrationDebounceRef.current) clearTimeout(hydrationDebounceRef.current);
    };
  }, [employeeId, fetchHealthReport, fetchChartData]);

  // hydration persistence (debounced)
  function persistHydrationToBackend(glasses) {
    if (!employeeId) return;
    if (hydrationLockRef.current) return;
    hydrationLockRef.current = true;
    backendPost({ employee_id: employeeId, type: "save_hydration", glasses })
      .catch((e) => console.warn("persistHydration error", e))
      .finally(() => {
        hydrationLockRef.current = false;
      });
  }
  function changeGlass(delta) {
    const next = Math.max(0, Math.min(MAX_GLASSES, waterGlasses + delta));
    setWaterGlasses(next);
    if (hydrationDebounceRef.current) clearTimeout(hydrationDebounceRef.current);
    hydrationDebounceRef.current = setTimeout(() => persistHydrationToBackend(next), 500);
  }

  // mood save
  async function saveMood(newMood) {
    setMood(newMood);
    if (!employeeId) return;
    try {
      await backendPost({ employee_id: employeeId, type: "save_mood", mood: newMood });
    } catch (err) {
      console.warn("saveMood error", err);
    }
  }

  // chat
  async function handleSendMessage(e) {
    e && e.preventDefault();
    if (!message.trim()) return;

    setChatLoading(true);
    setReply(null);

    try {
      const data = await backendPost({
        type: "symptom",
        employee_id: employeeId,
        message: message.trim(),
      });

      if (data?.reply) setReply(data.reply);
      await fetchHealthReport();
      await fetchChartData();
    } catch (err) {
      console.error(err);
      setReply("Failed to contact backend.");
    } finally {
      setChatLoading(false);
      setMessage("");
      setTimeout(() => replyRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  // profile editing
  function openProfileEditor() {
    setDraftProfile({
      name: profile?.name || "",
      email: profile?.email || "",
      age: profile?.age || "",
      gender: profile?.gender || "",
      blood_group: profile?.blood_group || "",
      allergies: profile?.allergies || "",
      chronic_conditions: profile?.chronic_conditions || "",
    });
    setProfileEditing(true);
  }
  async function handleSaveProfile(e) {
    e && e.preventDefault();
    try {
      await backendPost({
        employee_id: employeeId,
        type: "update_profile",
        ...draftProfile,
      });
      await fetchHealthReport();
      setProfileEditing(false);
    } catch (err) {
      console.error("save profile error", err);
    }
  }

  // BMI
  function computeBMIValue(wKg, hCm) {
    const h = Number(hCm) / 100;
    const w = Number(wKg);
    if (!h || !w) return null;
    return Number((w / (h * h)).toFixed(1));
  }
  async function handleCalculateAndSaveBMI(e) {
    e && e.preventDefault();
    const val = computeBMIValue(weight, height);
    setBmi(val);
    try {
      await backendPost({ employee_id: employeeId, type: "save_bmi", bmi: val, weight, height });
      await fetchHealthReport();
    } catch (err) {
      console.error("save bmi error", err);
    }
  }

  // new user creation (simple)
  async function handleCreateProfile(e) {
    e && e.preventDefault();
    try {
      await backendPost({
        employee_id: employeeId,
        type: "update_profile",
        name: profile?.name || "New User",
      });
      setIsNewUser(false);
      await fetchHealthReport();
      await fetchChartData();
    } catch (err) {
      console.error("create profile error", err);
    }
  }

  // UI fallback for new user
  if (isNewUser) {
    return (
      <div className="h-full w-full p-3 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-semibold mb-1">Welcome to HealthMate</h2>
          <p className="text-sm text-gray-600 mb-3">Please complete your basic profile.</p>
          <button onClick={handleCreateProfile} className="w-full bg-indigo-600 text-white py-2 rounded">Create sample profile</button>
        </div>
      </div>
    );
  }

  // ===== Styles for animated glow/pulse (single-color indigo ring) =====
  const HoverStyles = (
    <style>{`
      @keyframes hm-glow-pulse {
        0% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-6px) scale(1.04); }
        100% { transform: translateY(0) scale(1); }
      }
      @keyframes hm-ring {
        0% { transform: scale(0.95); opacity: 0.9; filter: blur(4px); }
        50% { transform: scale(1.03); opacity: 0.75; filter: blur(8px); }
        100% { transform: scale(0.95); opacity: 0.9; filter: blur(4px); }
      }
    `}</style>
  );

  function ActiveRing({ color = "rgba(59,130,246,0.20)" }) {
    return (
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: -10,
          borderRadius: 18,
          zIndex: 0,
          pointerEvents: "none",
          background: "transparent",
          boxShadow: `0 16px 40px ${color}, 0 0 30px ${color}`,
          border: `2px solid rgba(59,130,246,0.08)`,
          animation: "hm-ring 1.6s ease-in-out infinite",
        }}
      />
    );
  }

  function CardHover({ id, className = "", children, onClick }) {
    const isActive = activeWidget === id;
    return (
      <div
        onMouseEnter={() => onEnter(id)}
        onMouseLeave={() => onLeave()}
        onFocus={() => onFocus(id)}
        onBlur={() => onBlur()}
        role="button"
        tabIndex={0}
        onClick={onClick}
        className={`relative overflow-visible ${className} ${isActive ? "z-30" : ""}`}
        style={{ zIndex: isActive ? 30 : 1 }}
      >
        {isActive && <ActiveRing />}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            animation: isActive ? "hm-glow-pulse 1.2s ease-in-out infinite" : undefined,
            borderRadius: 12,
            transition: "transform 200ms ease, box-shadow 200ms ease",
            transform: isActive ? "translateY(-3px) scale(1.02)" : undefined,
            boxShadow: isActive ? "0 18px 50px rgba(59,130,246,0.16)" : undefined,
            backgroundClip: "padding-box",
          }}
        >
          {children}
        </div>
        </div>
    );
  }

  const visualCard = (id, extra = "") => `${CARD_BASE} ${extra} transition-all duration-150 cursor-pointer ${activeWidget === id ? " " : "hover:shadow-md"}`.trim();

  const visualBox = (id) => `bg-white rounded border p-3 flex flex-col transition-all duration-150 cursor-pointer`.trim();

  return (
    <div className="h-full w-full p-6 bg-gray-50">
      {HoverStyles}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-12 gap-6">
          {/* LEFT column */}
          <div className="col-span-3 space-y-4">
            {/* Profile card */}
            <CardHover id="profile" className={visualCard("profile")} onClick={() => openProfileEditor()}>
              <div className="flex items-start gap-4 p-5">
                <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold text-xl">
                  {(profile?.name || "NA").split(" ").map(n => n?.[0] || "").slice(0,2).join("")}
                </div>
                <div className="flex-1">
                  <div className="text-lg font-semibold">{profile?.name || "No Name"}</div>
                  <div className="text-sm text-gray-500">Age: {profile?.age ?? "-"}</div>
                  <div className="text-sm text-gray-500">Gender: {profile?.gender ?? "-"}</div>
                  <div className="text-sm text-gray-500">Blood Group: {profile?.blood_group ?? "-"}</div>
                  <div className="mt-2 text-sm text-gray-600">Allergies: {profile?.allergies || "-"}</div>
                  <div className="mt-1 text-sm text-gray-600">Chronic: {profile?.chronic_conditions || "-"}</div>
                  <div className="mt-3 text-sm">
                    <span className="text-green-600 font-semibold">Health score: {profile?.health_score ?? "—"}</span>
                  </div>
                </div>
              </div>
            </CardHover>

            {/* Mood Today */}
            <CardHover id="mood" className={visualCard("mood")}>
              <h4 className="text-sm font-semibold mb-2 p-3">Mood Today</h4>
              <div className="px-3 pb-3">
                <div className="flex gap-3">
                  {["😀","🙂","😐","😔"].map((m,i)=>{
                    const active = mood === m;
                    return (
                      <button key={i}
                        onClick={(e)=>{ e.stopPropagation(); saveMood(m); }}
                        className={`w-10 h-10 rounded-full border flex items-center justify-center text-lg ${active ? "ring-2 ring-indigo-300" : ""}`}>
                        {m}
                      </button>
                    );
                  })}
                </div>
                <div className="text-xs text-gray-400 mt-2">{mood ? `Logged mood: ${mood}` : "Hover & choose mood"}</div>
              </div>
            </CardHover>

            {/* Hydration */}
            <CardHover id="hydration" className={visualCard("hydration")}>
              <h4 className="text-sm font-semibold mb-2 p-3">Hydration</h4>
              <div className="px-3 pb-3">
                <div className="flex items-center gap-3">
                  <button onClick={(e)=>{ e.stopPropagation(); changeGlass(-1); }} className="w-8 h-8 rounded-full border" disabled={waterGlasses<=0}>-</button>
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 h-2 rounded-full">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(waterGlasses/MAX_GLASSES)*100}%` }} />
                    </div>
                  </div>
                  <button onClick={(e)=>{ e.stopPropagation(); changeGlass(1); }} className="w-8 h-8 rounded-full border" disabled={waterGlasses>=MAX_GLASSES}>+</button>
                </div>
                <div className="text-xs text-gray-400 mt-2">Tip: saved to backend after a short delay • {waterGlasses}/{MAX_GLASSES}</div>
              </div>
            </CardHover>

            {/* Health Tips */}
            <CardHover id="tips" className={visualCard("tips")}>
              <h4 className="font-semibold p-3">Health Tips</h4>
              <div className="px-3 pb-3">
                <ul className="mt-2 text-sm text-gray-700">
                  {(personalizedTips.length ? personalizedTips : ["Drink 2L water daily","30 mins of exercise"]).map((t,i)=><li key={i}>• {t}</li>)}
                </ul>
              </div>
            </CardHover>
          </div>

          {/* CENTER */}
          <div className="col-span-6 space-y-4">
            <div className={cardClass()}>
              <div className="flex items-start justify-between p-5">
                <div>
                  <h3 className="text-xl font-semibold">Health Dashboard</h3>
                  <div className="text-sm text-gray-500">Overview for {profile?.name || "User"}</div>
                </div>

                <div className="flex items-center gap-4">
                  <button onClick={() => { fetchHealthReport(); fetchChartData(); }} className="px-3 py-1 border rounded text-sm bg-white">Refresh</button>
                  <BackendStatus employeeId={employeeId} />
                </div>
              </div>

              {/* ===== 2x2 Equal Boxes Grid (all boxes same size) ===== */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
                <CardHover id="healthTrend" className={visualBox("healthTrend")} onClick={() => {}}>
                  <div className="text-xs text-gray-500 mb-2">Health Score (recent)</div>
                  <div className="flex-1" style={{ minHeight: 200 }}>
                    {(chartData.healthTrend || []).length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData.healthTrend}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Line dataKey="score" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-sm text-gray-400">No health trend data available.</div>
                    )}
                  </div>
                </CardHover>

                <CardHover id="consultations" className={visualBox("consultations")} onClick={() => {}}>
                  <div className="text-xs text-gray-500 mb-2">Consultations (last months)</div>
                  <div className="flex-1" style={{ minHeight: 200 }}>
                    {(chartData.consultationsByMonth || []).length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData.consultationsByMonth}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" barSize={14} fill="#6366f1" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-sm text-gray-400">No consultations data.</div>
                    )}
                  </div>
                </CardHover>

                <CardHover id="doctors" className={visualBox("doctors")} onClick={() => {}}>
                  <h4 className="text-sm font-semibold mb-2">Doctors</h4>
                  <div className="flex-1">
                    <div className="text-sm text-gray-700">Dr. Priya Sharma — General — <span className="text-green-600">Online</span></div>
                    <div className="text-sm text-gray-700 mt-2">Dr. Arun Rao — Cardiology — <span className="text-gray-400">Offline</span></div>
                    <div className="mt-4 text-sm text-gray-600">Use the chat or clinic to schedule appointments.</div>
                  </div>
                </CardHover>

                <CardHover id="notes" className={visualBox("notes")} onClick={() => {}}>
                  <h4 className="text-sm font-semibold mb-2">Recent Notes</h4>
                  <div className="flex-1">
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• Follow-up with Dr. Priya on 12 Nov — prescribed Vitamin D.</li>
                      <li>• Completed 3 workouts this week.</li>
                      <li>• Hydration streak: {waterGlasses} glasses today.</li>
                    </ul>
                  </div>
                </CardHover>
              </div>
              {/* ===== end equal boxes grid ===== */}
            </div>

            {/* Chat card removed earlier on request — still no UI here */}
          </div>

          {/* RIGHT */}
          <div className="col-span-3 space-y-4">
            <CardHover id="breathing" className={visualCard("breathing")}>
              <h4 className="text-sm font-semibold">Breathing Exercise</h4>
              <BreathingWidget />
            </CardHover>

            <CardHover id="bmi" className={visualCard("bmi")}>
              <h4 className="text-sm font-semibold">BMI Calculator</h4>
              <form onSubmit={handleCalculateAndSaveBMI} className="mt-3 space-y-2 p-3">
                <input value={weight} onChange={(e)=>setWeight(e.target.value)} placeholder="Weight (kg)" className="w-full border rounded p-2 text-sm" />
                <input value={height} onChange={(e)=>setHeight(e.target.value)} placeholder="Height (cm)" className="w-full border rounded p-2 text-sm" />
                <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded">Calculate</button>
              </form>
              <div className="mt-2 text-sm text-gray-600 p-3">BMI: {bmi || profile?.bmi || "-"}</div>
            </CardHover>

            <CardHover id="ambulance" className={visualCard("ambulance")}>
              <h4 className="text-sm font-semibold">Ambulance</h4>
              <div className="mt-3 text-sm text-gray-600">Call ambulance in case of emergency.</div>
              <button
                // Replaced window.confirm with custom modal trigger
                onClick={(e) => { e.stopPropagation(); document.getElementById('confirm_ambulance')?.showModal(); }}
                className="mt-3 w-full bg-red-600 text-white py-2 rounded"
              >
                Call Ambulance
              </button>
            </CardHover>
          </div>
        </div>
        <BackendStatus employeeId={employeeId} />
      </div>

      {/* Profile Edit Modal (unchanged) */}
      {profileEditing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h4 className="font-semibold mb-3">Edit Profile</h4>
            <form onSubmit={handleSaveProfile} className="space-y-3">
              <input value={draftProfile.name} onChange={(e)=>setDraftProfile({...draftProfile, name: e.target.value})} className="w-full border rounded p-2" placeholder="Full name" />
              <input value={draftProfile.email} onChange={(e)=>setDraftProfile({...draftProfile, email: e.target.value})} className="w-full border rounded p-2" placeholder="Email" />
              <div className="flex gap-2">
                <input value={draftProfile.age} onChange={(e)=>setDraftProfile({...draftProfile, age: e.target.value})} className="w-1/2 border rounded p-2" placeholder="Age" />
                <input value={draftProfile.gender} onChange={(e)=>setDraftProfile({...draftProfile, gender: e.target.value})} className="w-1/2 border rounded p-2" placeholder="Gender" />
              </div>
              <input value={draftProfile.blood_group} onChange={(e)=>setDraftProfile({...draftProfile, blood_group: e.target.value})} className="w-full border rounded p-2" placeholder="Blood Group" />
              <input value={draftProfile.allergies} onChange={(e)=>setDraftProfile({...draftProfile, allergies: e.target.value})} className="w-full border rounded p-2" placeholder="Allergies" />
              <input value={draftProfile.chronic_conditions} onChange={(e)=>setDraftProfile({...draftProfile, chronic_conditions: e.target.value})} className="w-full border rounded p-2" placeholder="Chronic Conditions" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={()=>setProfileEditing(false)} className="px-4 py-2 rounded border">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded bg-indigo-600 text-white">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================
  Profile Page
  ========================= */
function ProfilePage() {
  const [employeeId] = useState(localStorage.getItem("employee_id") || "emp_001");
  const [profile, setProfile] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await backendPost({ employee_id: employeeId, type: "health_report" });
        if (res.__notFound) setNotFound(true);
        else setProfile(res.profile);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [employeeId]);

  return (
    <div className="p-6 h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl p-6 shadow">
        <h2 className="text-xl font-semibold">Profile</h2>
        {notFound ? <div className="text-sm text-gray-500">No profile found.</div> : (
          <div className="mt-4 text-sm text-gray-700 space-y-2">
            <div>Name: {profile?.name || "-"}</div>
            <div>Age: {profile?.age || "-"}</div>
            <div>Gender: {profile?.gender || "-"}</div>
            <div>Blood group: {profile?.blood_group || "-"}</div>
            <div>BMI: {profile?.bmi || "-"}</div>
            <div>Allergies: {profile?.allergies || "-"}</div>
            <div>Chronic Conditions: {profile?.chronic_conditions || "-"}</div>
          </div>
        )}
      </div>
      <BackendStatus employeeId={employeeId} />
    </div>
  );
}

/* =========================
  Reports Page
  ========================= */
function ReportsPage() {
  const [employeeId] = useState(localStorage.getItem("employee_id") || "emp_001");
  const [chartData, setChartData] = useState({ healthTrend: [] });

  useEffect(() => {
    (async () => {
      try {
        const res = await backendPost({ employee_id: employeeId, type: "chart_data" });
        const healthTrend = Array.isArray(res?.healthTrend) ? res.healthTrend : [];
        const demoHealthTrend = [
          { date: "2025-11-01", score: 72 },
          { date: "2025-11-05", score: 75 },
          { date: "2025-11-10", score: 68 },
        ];
        setChartData({ healthTrend: healthTrend.length ? healthTrend : demoHealthTrend });
      } catch (err) {
        console.error(err);
        setChartData({ healthTrend: [
          { date: "2025-11-01", score: 72 },
          { date: "2025-11-05", score: 75 },
          { date: "2025-11-10", score: 68 },
        ]});
      }
    })();
  }, [employeeId]);

  return (
    <div className="p-6 h-screen bg-gray-50 overflow-auto">
      <div className="max-w-6xl mx-auto grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-sm font-semibold">Health Trend</h3>
          <div style={{ height: 240 }}>
            {(chartData.healthTrend || []).length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData.healthTrend}><XAxis dataKey="date"/><YAxis/><Tooltip/><Line dataKey="score" stroke="#3b82f6" /></LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-400">No data</div>
            )}
          </div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-sm font-semibold">Medical Report (Bot)</h3>
          <div className="p-4 text-sm text-gray-700">
            <p><strong>Summary:</strong></p>
            <p>The bot composes a concise medical report using user data and recent activity. Use the chat to request a detailed report.</p>
          </div>
        </div>
        <BackendStatus employeeId={employeeId} />
      </div>
    </div>
  );
}

/* =========================
  AppShell with Navigation
  ========================= */
function AppShell() {
  const [employeeId, setEmployeeId] = useState(localStorage.getItem("employee_id") || "");
  const [isMinimized, setIsMinimized] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [signInValue, setSignInValue] = useState("");
  const [botPopupOpen, setBotPopupOpen] = useState(false);
  const [creatingChannel, setCreatingChannel] = useState(false);

  // NEW: Modals state
  const [alertModal, setAlertModal] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  // NEW: Channel setup state
  const [savedChannelId, setSavedChannelId] = useState(localStorage.getItem("hm_channel_id") || "");
  const [channelNameDraft, setChannelNameDraft] = useState("HealthMate Alerts");

  // NEW: Access Channel modal & form fields
  const [accessChannelOpen, setAccessChannelOpen] = useState(false);
  const [formChannelName, setFormChannelName] = useState("");
  const [formChannelId, setFormChannelId] = useState("");
  const [formCreatedBy, setFormCreatedBy] = useState("");

  const botHoverTimeout = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onStorage(e) { if (e.key === "employee_id") setEmployeeId(e.newValue || ""); }
    window.addEventListener("storage", onStorage); return () => window.removeEventListener("storage", onStorage);
  }, []);

  function openSignIn() {
    setSignInValue(localStorage.getItem("employee_id") || "");
    setSignInOpen(true);
  }
  function closeSignIn() { setSignInOpen(false); setSignInValue(""); }

  function saveSignIn() {
    const v = (signInValue || "").trim();
    if (!v) return;
    localStorage.setItem("employee_id", v);
    setEmployeeId(v);
    setSignInOpen(false);
  }

  // create channel (defensive extraction + persist)
  async function createChannel() {
    if (!employeeId) {
      setAlertModal({ title: "Sign In Required", message: "Please sign in (set Employee ID) before creating a channel." });
      return;
    }

    // Prompt for channel name using the confirm modal structure as a quick input
    setConfirmModal({
      title: "Create Cliq Channel",
      message: (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">Enter a name for the new Zoho Cliq channel where alerts will be sent. (E.g., "Emergency Alerts")</p>
          <input
            value={channelNameDraft}
            onChange={(e) => setChannelNameDraft(e.target.value)}
            placeholder="Channel Name"
            className="w-full border rounded p-2 text-sm"
          />
        </div>
      ),
      confirmText: "Create",
      onConfirm: async () => {
        if (!channelNameDraft.trim()) {
          setAlertModal({ title: "Error", message: "Channel name cannot be empty." });
          return;
        }

        try {
          setCreatingChannel(true);
          // Send required channel_name in the payload
          const res = await backendPost({ 
            employee_id: employeeId, 
            type: "create_channel",
            channel_name: channelNameDraft.trim() // Pass the draft value
          });

          // Defensive extraction of channel id from backend response
          const maybeChannelId =
            res?.channel?.channel_id ||
            res?.channelId ||
            res?.channel?.id ||
            res?.channel?.data?.channel_id ||
            null;

          if (maybeChannelId) {
            try { localStorage.setItem("hm_channel_id", maybeChannelId); } catch {}
            setSavedChannelId(maybeChannelId);
            setAlertModal({ title: "Success", message: `Channel created and configured! ID: ${maybeChannelId}` });
            return;
          }

          if (res?.message) {
            setAlertModal({ title: "Channel Created", message: res.message + " (ID not explicitly returned, check Catalyst Config for persistence.)" });
            return;
          }

          setAlertModal({ title: "Success (No ID)", message: "Channel creation initiated. Check Catalyst console for status." });
        } catch (err) {
          console.error("createChannel error", err);
          // Attempt to parse the error message if possible
          let errMsg = "Failed to create channel due to server error.";
          try {
            const parsedError = JSON.parse(err.message);
            errMsg = parsedError?.error || JSON.stringify(parsedError);
          } catch {
            errMsg = err.message;
          }
          setAlertModal({ title: "Failure", message: errMsg });
        } finally {
          setCreatingChannel(false);
          setConfirmModal(null); // Close the input modal
        }
      }
    });
  }

  // NEW: Save channel details from Access Channel modal (calls backend type: "save_channel")
  async function handleSaveChannelDetails(e) {
    e && e.preventDefault();
    if (!employeeId) {
      setAlertModal({ title: "Sign In Required", message: "Please sign in (set Employee ID) before saving a channel." });
      return;
    }
    const payload = {
      employee_id: employeeId,
      type: "save_channel",
      channel_name: formChannelName,
      channel_id: formChannelId,
      created_by: formCreatedBy,
    };

    try {
      const res = await backendPost(payload);
      if (res && res.saved) {
        try { localStorage.setItem("hm_channel_id", formChannelId); } catch {}
        setSavedChannelId(formChannelId);
        setAccessChannelOpen(false);
        setAlertModal({ title: "Saved", message: "Channel saved successfully." });
      } else {
        // handle non-saved but successful response
        setAlertModal({ title: "Response", message: res?.message || "Channel saved (no explicit saved flag returned)." });
      }
    } catch (err) {
      console.error("save channel error", err);
      let errMsg = "Failed to save channel.";
      try {
        const parsed = JSON.parse(err.message);
        errMsg = parsed?.error || errMsg;
      } catch {}
      setAlertModal({ title: "Error", message: errMsg });
    }
  }

  // Hover behavior for floating bot
  function handleBotMouseEnter() {
    if (botHoverTimeout.current) { clearTimeout(botHoverTimeout.current); botHoverTimeout.current = null; }
    setBotPopupOpen(true);
  }
  function handleBotMouseLeave() {
    if (botHoverTimeout.current) clearTimeout(botHoverTimeout.current);
    botHoverTimeout.current = setTimeout(() => setBotPopupOpen(false), 350);
  }

  if (isClosed)
    return (
      <div className="h-screen flex items-end justify-end p-6 bg-gray-100">
        <button onClick={() => setIsClosed(false)} className="bg-indigo-600 text-white px-4 py-2 rounded-full">Open HealthMate</button>
        <BackendStatus employeeId={employeeId} />
      </div>
    );

  if (isMinimized)
    return (
      <div className="h-screen flex items-end justify-end p-6 bg-gray-100">
        <div
          className="bg-white px-4 py-2 rounded-full shadow cursor-pointer"
          onClick={() => setIsMinimized(false)}
        >
          <span className="text-indigo-600 font-semibold">HealthMate</span>
        </div>
        <BackendStatus employeeId={employeeId} />
      </div>
    );

  return (
    <div className="h-screen bg-gray-50">
      {/* HEADER */}
      <header className="h-16 bg-white border-b flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">HM</div>
          <div>
            <div className="font-semibold">HealthMate Widget</div>
            <div className="text-xs text-gray-500">Corporate Doctor · Smart dashboard</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-sm text-gray-600">Dashboard</button>
          <button onClick={() => navigate("/profile")} className="text-sm text-gray-600">Profile</button>
          <button onClick={() => navigate("/reports")} className="text-sm text-gray-600">Reports</button>

          <button
            onClick={() => window.open("https://cliq.zoho.com/bots/healthmatedoctor", "_blank")}
            className="px-3 py-1 rounded bg-indigo-600 text-white"
          >
            Access Bot
          </button>

          {/* NEW: Access Channel button opens the form modal */}
          <button
            onClick={() => setAccessChannelOpen(true)}
            className="px-3 py-1 rounded border text-sm bg-white"
            title="Access Channel"
          >
            Access Channel
          </button>

          {/* NOTE: "Create Channel" button intentionally removed from visible header as earlier request said — createChannel() still available */}
          {/* show saved Channel ID (if present) */}
          {savedChannelId ? (
            <div className="text-xs text-gray-500 ml-3">
              Channel: <span className="font-mono text-sm text-indigo-600">{savedChannelId}</span>
            </div>
          ) : (
            <div className="text-xs text-gray-400 ml-3"></div>
          )}

          {/* ===== REPLACED SIGN IN control to match your screenshot ===== */}
          <div className="ml-2">
            {employeeId ? (
              <div className="flex items-center gap-2">
                <div className="text-sm text-gray-700">Signed in: <span className="font-medium">{employeeId}</span></div>
                <button onClick={openSignIn} className="px-3 py-1 border rounded text-sm">Change</button>
              </div>
            ) : (
              // Prominent purple Sign In button (matches screenshot)
              <button
                onClick={openSignIn}
                className="px-4 py-2 rounded-md text-white font-medium"
                style={{ background: "#4f46e5", boxShadow: "0 6px 18px rgba(79,70,229,0.18)" }}
              >
                Sign In
              </button>
            )}
          </div>

          <button onClick={() => setIsMinimized(true)} className="w-8 h-8 rounded-full bg-yellow-300">─</button>
          <button onClick={() => setIsClosed(true)} className="w-8 h-8 rounded-full bg-red-500 text-white">×</button>
        </div>
      </header>

      <main className="h-[calc(100%-64px)] overflow-auto">
        <Routes>
          <Route path="/" element={<HealthDashboard employeeIdProp={employeeId} />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/reports" element={<ReportsPage />} />
        </Routes>
      </main>

      {/* Floating Bot button + popup (unchanged) */}
      <div
        className="fixed bottom-6 right-6 z-50 flex items-end justify-end"
        onMouseEnter={handleBotMouseEnter}
        onMouseLeave={handleBotMouseLeave}
      >
        {botPopupOpen && (
          <div
            className="mr-3 mb-2 w-56 bg-white rounded-xl shadow-xl p-3 ring-4 ring-indigo-200 animate-pulse"
            style={{ boxShadow: "0 10px 30px rgba(99,102,241,0.12)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 text-lg">🤖</div>
                <div>
                  <div className="font-semibold">HealthMate Bot</div>
                  <div className="text-xs text-gray-500">Open in Zoho Cliq</div>
                </div>
              </div>
              <button onClick={() => setBotPopupOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="mt-3">
              <button
                onClick={() => window.open("https://cliq.zoho.com/bots/healthmatedoctor", "_blank")}
                className="w-full bg-indigo-600 text-white py-2 rounded"
              >
                Open Bot
              </button>
              <button
                onClick={() => {
                  try {
                    window.location.href = "zohocliq://chat?bot=healthmatedoctor";
                  } catch (_) {}
                }}
                className="w-full mt-2 border rounded py-2 text-sm"
              >
                Open in App
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => window.open("https://cliq.zoho.com/bots/healthmatedoctor", "_blank")}
          title="Access HealthMate Bot"
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl transition-transform transform focus:outline-none
            ${botPopupOpen ? "ring-4 ring-indigo-200 scale-105" : "hover:scale-105"}
          `}
          style={{
            background: "linear-gradient(180deg,#6366f1,#4f46e5)",
            color: "white",
            boxShadow: botPopupOpen ? "0 12px 30px rgba(99,102,241,0.28)" : "0 8px 20px rgba(79,70,229,0.18)",
          }}
        >
          <span style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.15))" }}>🤖</span>
        </button>
      </div>

      {/* ===== Sign In Modal (styled to match screenshot) ===== */}
      {signInOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold mb-2">Sign In</h3>
            <p className="text-sm text-gray-600 mb-4">Enter your Employee ID</p>
            <input
              value={signInValue}
              onChange={(e) => setSignInValue(e.target.value)}
              placeholder="e.g. emp_1001"
              className="w-full border rounded p-3 mb-4 text-sm"
              style={{ background: "#fbfbfb" }}
            />
            <div className="flex justify-end items-center gap-3">
              <button onClick={closeSignIn} className="px-4 py-2 rounded border">Cancel</button>
              <button onClick={saveSignIn} className="px-4 py-2 rounded text-white" style={{ background: "#4f46e5" }}>
                Sign In
              </button>
            </div>
            <BackendStatus employeeId={employeeId} />
          </div>
        </div>
      )}

      {/* ===== Access Channel Modal (NEW) ===== */}
      {accessChannelOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold mb-2">Access Channel</h3>
            <p className="text-sm text-gray-600 mb-4">Enter channel details to save to the backend datastore.</p>
            <form onSubmit={handleSaveChannelDetails} className="space-y-3">
              <label className="text-xs text-gray-600">Created name</label>
              <input value={formChannelName} onChange={(e)=>setFormChannelName(e.target.value)} placeholder="Channel name" className="w-full border rounded p-2 text-sm" />
              <label className="text-xs text-gray-600">Created ID</label>
              <input value={formChannelId} onChange={(e)=>setFormChannelId(e.target.value)} placeholder="Channel ID" className="w-full border rounded p-2 text-sm" />
              <label className="text-xs text-gray-600">Created by</label>
              <input value={formCreatedBy} onChange={(e)=>setFormCreatedBy(e.target.value)} placeholder="Created by (user)" className="w-full border rounded p-2 text-sm" />

              <div className="flex justify-end gap-3">
                <button type="button" onClick={()=>setAccessChannelOpen(false)} className="px-4 py-2 rounded border">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded bg-indigo-600 text-white">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* ===== Custom Alert Modal (for alerts) ===== */}
      <dialog id="alert_modal" className="rounded-2xl shadow-2xl p-6 w-full max-w-sm backdrop:bg-black/40" open={!!alertModal}>
        {alertModal && (
          <div>
            <h3 className="text-lg font-semibold mb-2">{alertModal.title}</h3>
            <p className="text-sm text-gray-600 mb-4">{alertModal.message}</p>
            <div className="flex justify-end">
              <button onClick={() => setAlertModal(null)} className="px-4 py-2 rounded bg-indigo-600 text-white">
                Close
              </button>
            </div>
          </div>
        )}
      </dialog>

      {/* ===== Custom Confirm Modal (for ambulance) ===== */}
      <dialog id="confirm_ambulance" className="rounded-2xl shadow-2xl p-6 w-full max-w-md backdrop:bg-black/40">
        <h3 className="text-lg font-semibold mb-2">Emergency Call</h3>
        <p className="text-sm text-gray-600 mb-4">Are you sure you want to call the emergency number (108) now?</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => document.getElementById('confirm_ambulance')?.close()} className="px-4 py-2 rounded border">
            Cancel
          </button>
          <button 
            onClick={() => { 
              document.getElementById('confirm_ambulance')?.close(); 
              window.open("tel:108"); 
            }} 
            className="px-4 py-2 rounded bg-red-600 text-white"
          >
            Call 108
          </button>
        </div>
      </dialog>
      
    </div>
  );
}

/* =========================
  App Export
  ========================= */
export default function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}
