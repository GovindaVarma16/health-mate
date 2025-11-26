// App.jsx - full file (paste into src/App.jsx)
import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line
} from "recharts";

import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';

// Base API
const API_BASE = (
  typeof process !== 'undefined' &&
  process &&
  process.env &&
  process.env.REACT_APP_HEALTH_API
) || window.__HEALTH_API_BASE__ || '/api/healthmate';

const api = axios.create({ baseURL: API_BASE, timeout: 20000 });
api.interceptors.request.use(cfg => {
  cfg.headers['Content-Type'] = 'application/json';
  return cfg;
});

async function backendPost(payload) {
  const res = await api.post('', payload);
  return res.data;
}

// ---------- Small reusable components ----------
function NavSidebar({ employeeId }) {
  return (
    <nav className="flex flex-col gap-2">
      <Link to="/" className="text-sm text-indigo-700">Dashboard</Link>
      <Link to="/profile" className="text-sm text-gray-700">Profile</Link>
      <Link to="/reports" className="text-sm text-gray-700">Reports</Link>
      <div className="text-xs text-gray-400 mt-4">ID: {employeeId}</div>
    </nav>
  );
}

// ---------- HealthDashboard (main) ----------
function HealthDashboard({ employeeIdProp }) {
  const [employeeId, setEmployeeId] = useState(employeeIdProp || localStorage.getItem('employee_id') || 'emp_001');
  const [profile, setProfile] = useState(null);
  const [personalizedTips, setPersonalizedTips] = useState([]);
  const [chartData, setChartData] = useState({ healthTrend: [], vitalsTrend: [], consultationsByMonth: [], remindersAdherence: [], sleepTrend: [] });
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [draftProfile, setDraftProfile] = useState({});
  const [bmi, setBmi] = useState(null);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [bmiSaving, setBmiSaving] = useState(false);
  const replyRef = useRef(null);
  const navigate = useNavigate();

  // New states for UI interactions
  const [refreshing, setRefreshing] = useState(false);
  const [collapsed, setCollapsed] = useState({
    overview: false,
    chartsGrid: false,
    talk: false,
    doctors: false,
    tips: false,
    bmi: false,
    profileCard: false
  });

  useEffect(() => {
    if (employeeId) {
      localStorage.setItem('employee_id', employeeId);
      fetchHealthReport();
      fetchChartData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  // Toggle collapse helpers
  function toggleCollapse(key) {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  }
  function toggleCollapseAll() {
    const anyExpanded = Object.values(collapsed).some(v => v === false);
    const next = {};
    Object.keys(collapsed).forEach(k => next[k] = anyExpanded); // true = collapsed
    setCollapsed(next);
  }

  async function refreshData() {
    setRefreshing(true);
    try {
      await fetchHealthReport();
      await fetchChartData();
    } catch (e) { /* ignore */ }
    finally { setRefreshing(false); }
  }

  async function fetchHealthReport() {
    try {
      const data = await backendPost({ employee_id: employeeId, type: 'health_report' });
      if (data.profile) setProfile(data.profile);
      if (data.personalized_tips) setPersonalizedTips(data.personalized_tips || []);
      if (data.bmi) setBmi(data.bmi);
    } catch (e) {
      // ignore
    }
  }

  async function fetchChartData() {
    try {
      const data = await backendPost({ employee_id: employeeId, type: 'chart_data' });
      if (data && (data.healthTrend || data.sleepTrend || data.vitalsTrend)) {
        setChartData({
          healthTrend: data.healthTrend || [],
          vitalsTrend: data.vitalsTrend || [],
          consultationsByMonth: data.consultationsByMonth || [],
          remindersAdherence: data.remindersAdherence || [],
          sleepTrend: data.sleepTrend || []
        });
        return;
      }
    } catch (e) { /* ignore */ }

    // Demo fallback
    const demoHealth = [];
    const demoVitals = [];
    const demoCons = [];
    const demoRem = [];
    const demoSleep = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i * 7);
      const date = `${d.getMonth() + 1}/${d.getDate()}`;
      demoHealth.push({ date, score: Math.round(70 + Math.random() * 20) });
      demoVitals.push({ date, bp_sys: 110 + Math.round(Math.random() * 20), hr: 65 + Math.round(Math.random() * 12), sugar: 85 + Math.round(Math.random() * 20) });
      demoSleep.push({ date, hours: Math.round(6 + Math.random() * 3) });
    }
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    for (let m = 5; m >= 0; m--) demoCons.push({ month: months[(today.getMonth() - m + 12) % 12], count: Math.floor(Math.random() * 4) });
    demoRem.push({ name: 'Paracetamol', takenPercent: 85 }, { name: 'Vitamin D', takenPercent: 60 });

    setChartData({ healthTrend: demoHealth, vitalsTrend: demoVitals, consultationsByMonth: demoCons, remindersAdherence: demoRem, sleepTrend: demoSleep });
  }

  async function handleSendMessage(e) {
    e && e.preventDefault();
    if (!message.trim()) return;
    setChatLoading(true);
    setReply(null);
    try {
      const data = await backendPost({ employee_id: employeeId, type: 'symptom', message: message.trim() });
      if (data.reply) setReply(data.reply);
      await fetchHealthReport();
      await fetchChartData();
      setTimeout(() => replyRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (err) {
      setReply('Failed to reach backend.');
    } finally {
      setChatLoading(false);
      setMessage('');
    }
  }

  function openProfileEditor() {
    setDraftProfile({ name: profile?.name || '', email: profile?.email || '', age: profile?.age || '', gender: profile?.gender || '', blood_group: profile?.blood_group || '', allergies: profile?.allergies || '', chronic_conditions: profile?.chronic_conditions || '' });
    setProfileEditing(true);
  }

  async function handleSaveProfile(e) {
    e && e.preventDefault();
    try {
      await backendPost({ employee_id: employeeId, type: 'update_profile', ...draftProfile });
      await fetchHealthReport();
      setProfileEditing(false);
    } catch (err) {}
  }

  function computeBMIValue(wKg, hCm) {
    const h = Number(hCm) / 100;
    const w = Number(wKg);
    if (!h || !w) return null;
    const val = w / (h * h);
    return Number(val.toFixed(1));
  }

  function bmiCategory(bmiVal) {
    if (!bmiVal && bmiVal !== 0) return 'Unknown';
    if (bmiVal < 18.5) return 'Underweight';
    if (bmiVal < 25) return 'Normal';
    if (bmiVal < 30) return 'Overweight';
    return 'Obese';
  }

  async function handleCalculateAndSaveBMI(e) {
    e && e.preventDefault();
    const val = computeBMIValue(weight, height);
    setBmi(val);
    setBmiSaving(true);
    try {
      await backendPost({ employee_id: employeeId, type: 'save_bmi', bmi: val, weight, height });
    } catch (err) {}
    finally { setBmiSaving(false); }
  }

  // CSV Export
  function exportCSV() {
    const rows = [];
    if (chartData.healthTrend?.length) {
      rows.push(['HealthTrend']);
      rows.push(['date','score']);
      chartData.healthTrend.forEach(r => rows.push([r.date, r.score]));
      rows.push([]);
    }
    if (chartData.sleepTrend?.length) {
      rows.push(['SleepTrend']);
      rows.push(['date','hours']);
      chartData.sleepTrend.forEach(r => rows.push([r.date, r.hours]));
      rows.push([]);
    }
    if (chartData.vitalsTrend?.length) {
      rows.push(['VitalsTrend']);
      const sample = chartData.vitalsTrend[0] || {};
      const keys = Object.keys(sample).filter(k => k !== 'date');
      rows.push(['date', ...keys]);
      chartData.vitalsTrend.forEach(r => {
        rows.push([r.date, ...keys.map(k => r[k])]);
      });
      rows.push([]);
    }

    if (!rows.length) {
      alert('No chart data to export.');
      return;
    }

    const csvLines = rows.map(r => r.map(col => `"${String(col ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvLines], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `healthmate_charts_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const PIE_COLORS = ['#60a5fa', '#34d399', '#f59e0b', '#f97316'];

  // ---------- Render ----------
  return (
    <div className="h-screen w-full bg-gray-50 p-4 overflow-hidden">
      <div className="h-full max-w-7xl mx-auto grid grid-cols-12 gap-4" style={{ gridTemplateRows: '1fr' }}>

        {/* Left column */}
        <div className="col-span-3 h-full flex flex-col gap-4">

          {/* Profile Card (clickable with hover glow) */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => toggleCollapse('profileCard')}
            onKeyDown={e => { if (e.key === 'Enter') toggleCollapse('profileCard') }}
            className={`bg-white rounded-2xl p-4 shadow-sm transform transition-transform duration-200 hover:scale-[1.02] hover:shadow-2xl hover:ring-4 hover:ring-indigo-200/50 cursor-pointer ${collapsed.profileCard ? 'opacity-80' : ''}`}
            style={{ minHeight: 120 }}
          >
            {!collapsed.profileCard ? (
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold">{(profile?.name||'GV').split(' ').map(n=>n[0]).slice(0,2).join('')}</div>
                  </div>
                  <div>
                    <button onClick={(e)=>{ e.stopPropagation(); openProfileEditor(); }} className="text-indigo-600 text-sm">Edit</button>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-base font-medium">{profile?.name || 'No name'}</div>
                  <div className="text-sm text-gray-500">{profile?.age || '-'} • {profile?.gender || '-'} • {profile?.blood_group || '-'}</div>
                  <div className="mt-2 text-sm text-green-600">Health score: {profile?.healthScore ?? profile?.health_score ?? '—'}</div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">Profile (collapsed). Click to expand.</div>
            )}
          </div>

          {/* Vitals snapshot (with mini sparklines) */}
          <div className={`bg-white rounded-2xl p-3 shadow-sm transform transition-transform duration-200 hover:scale-[1.02] hover:shadow-2xl hover:ring-4 hover:ring-indigo-200/50 cursor-default ${collapsed.overview ? 'opacity-80' : ''}`}>
            <h4 className="font-semibold text-sm">Vitals (snapshot)</h4>
            <div className="grid grid-cols-2 gap-2 mt-3 text-sm text-center">
              {/* BP */}
              <div className="p-2 border rounded">
                BP
                <div className="font-medium mt-1">{chartData.vitalsTrend?.[chartData.vitalsTrend.length-1]?.bp_sys ?? '120'}/78</div>
                <div style={{ height: 36 }} className="mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData.vitalsTrend}>
                      <XAxis dataKey="date" hide />
                      <YAxis hide />
                      <Line dataKey="bp_sys" dot={false} stroke="#ef4444" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Heart Rate */}
              <div className="p-2 border rounded">
                Heart
                <div className="font-medium mt-1">{chartData.vitalsTrend?.[chartData.vitalsTrend.length-1]?.hr ?? '76'} bpm</div>
                <div style={{ height: 36 }} className="mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData.vitalsTrend}>
                      <XAxis dataKey="date" hide />
                      <YAxis hide />
                      <Line dataKey="hr" dot={false} stroke="#f97316" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Sugar */}
              <div className="p-2 border rounded">
                Sugar
                <div className="font-medium mt-1">{chartData.vitalsTrend?.[chartData.vitalsTrend.length-1]?.sugar ?? '95'} mg/dL</div>
                <div style={{ height: 36 }} className="mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData.vitalsTrend}>
                      <XAxis dataKey="date" hide />
                      <YAxis hide />
                      <Line dataKey="sugar" dot={false} stroke="#10b981" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Sleep */}
              <div className="p-2 border rounded">
                Sleep
                <div className="font-medium mt-1">{chartData.sleepTrend?.[chartData.sleepTrend.length-1]?.hours ?? '7.2'} h</div>
                <div style={{ height: 36 }} className="mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData.sleepTrend}>
                      <XAxis dataKey="date" hide />
                      <YAxis hide />
                      <Line dataKey="hours" dot={false} stroke="#3b82f6" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Medicine reminders (adherence progress) */}
          <div className={`bg-white rounded-2xl p-3 shadow-sm transform transition-transform duration-200 hover:scale-[1.02] hover:shadow-2xl hover:ring-4 hover:ring-indigo-200/50 cursor-default ${collapsed.tips ? 'opacity-80' : ''}`}>
            <h4 className="font-semibold">Medicine reminders</h4>
            <div className="mt-2">
              <ul className="text-sm mt-2 space-y-2">
                { (chartData.remindersAdherence && chartData.remindersAdherence.length) ? (
                  chartData.remindersAdherence.map((m,i) => (
                    <li key={i} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <div className="truncate">{m.name}</div>
                        <div className="text-xs text-gray-500">{m.takenPercent ?? m.takenPercent === 0 ? `${m.takenPercent}%` : '—'}</div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div style={{ width: `${m.takenPercent ?? 0}%` }} className="h-2 rounded-full bg-indigo-400" />
                      </div>
                    </li>
                  ))
                ) : (
                  <>
                    <li className="flex justify-between">Paracetamol 500mg <span className="text-xs text-gray-500">08:00</span></li>
                    <li className="flex justify-between">Vitamin D <span className="text-xs text-gray-500">20:00</span></li>
                  </>
                )}
              </ul>
            </div>
          </div>

        </div>

        {/* Middle (main charts & talk) */}
        <div className="col-span-6 h-full flex flex-col gap-4">

          {/* Main charts card (clickable collapse) */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => toggleCollapse('chartsGrid')}
            onKeyDown={e => { if (e.key === 'Enter') toggleCollapse('chartsGrid') }}
            className={`bg-white rounded-2xl p-3 shadow-sm flex-1 transform transition-transform duration-200 hover:scale-[1.02] hover:shadow-2xl hover:ring-4 hover:ring-indigo-200/50 cursor-pointer ${collapsed.chartsGrid ? 'opacity-80' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Health Dashboard</h3>
                <div className="text-sm text-gray-500">Overview for {profile?.name || employeeId}</div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={e => { e.stopPropagation(); refreshData(); }}
                  className="px-3 py-1 rounded border text-sm bg-white"
                  disabled={refreshing}
                >
                  {refreshing ? 'Refreshing…' : 'Refresh Charts'}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); exportCSV(); }}
                  className="px-3 py-1 rounded border text-sm bg-white"
                  title="Export CSV"
                >
                  Export CSV
                </button>
                <div className="text-sm text-gray-500">Quick view</div>
              </div>
            </div>

            {!collapsed.chartsGrid && (
              <div className="mt-3 grid grid-cols-2 gap-3 h-full" style={{ height: 'calc(100% - 56px)' }}>
                <div className="bg-white rounded p-2 border h-full">
                  <div className="text-xs text-gray-500">Health Score (last 7 points)</div>
                  <div className="h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData.healthTrend} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis domain={[40, 100]} />
                        <Tooltip />
                        <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white rounded p-2 border h-full">
                  <div className="text-xs text-gray-500">Sleep hours (last 7 points)</div>
                  <div className="h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData.sleepTrend} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="hours" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white rounded p-2 border h-full">
                  <div className="text-xs text-gray-500">Consultations (last months)</div>
                  <div className="h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData.consultationsByMonth} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" barSize={16} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white rounded p-2 border h-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chartData.remindersAdherence} dataKey="takenPercent" nameKey="name" innerRadius={28} outerRadius={56} label>
                        {chartData.remindersAdherence.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Talk to HealthMate (collapsible) */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => toggleCollapse('talk')}
            onKeyDown={e => { if (e.key === 'Enter') toggleCollapse('talk') }}
            className={`bg-white rounded-2xl p-3 shadow-sm transform transition-transform duration-200 hover:scale-[1.02] hover:shadow-2xl hover:ring-4 hover:ring-indigo-200/50 cursor-pointer ${collapsed.talk ? 'opacity-80' : ''}`}
          >
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Talk to HealthMate</h4>
              <div className="text-xs text-gray-500">AI-powered guidance</div>
            </div>
            {!collapsed.talk && (
              <>
                <form onSubmit={handleSendMessage} className="mt-2 flex gap-2">
                  <input value={message} onChange={e=>setMessage(e.target.value)} placeholder="e.g. fever and sore throat" className="flex-1 border rounded p-2 text-sm" />
                  <button type="submit" className="bg-indigo-600 text-white px-3 py-2 rounded" disabled={chatLoading}>{chatLoading ? '...' : 'Ask'}</button>
                </form>
                {reply && <div ref={replyRef} className="mt-2 text-sm bg-gray-50 border rounded p-2 whitespace-pre-wrap">{reply}</div>}
              </>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="col-span-3 h-full flex flex-col gap-4">

          {/* Doctors */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => toggleCollapse('doctors')}
            onKeyDown={e => { if (e.key === 'Enter') toggleCollapse('doctors') }}
            className={`bg-white rounded-2xl p-3 shadow-sm transform transition-transform duration-200 hover:scale-[1.02] hover:shadow-2xl hover:ring-4 hover:ring-indigo-200/50 cursor-pointer ${collapsed.doctors ? 'opacity-80' : ''}`}
          >
            {!collapsed.doctors ? (
              <>
                <h4 className="font-semibold">Doctors</h4>
                <div className="mt-2 text-sm text-gray-600">Dr. Priya Sharma — General — <span className="text-green-600">Online</span></div>
                <div className="mt-2 text-sm text-gray-600">Dr. Arun Rao — Cardiology — <span className="text-gray-400">Offline</span></div>
              </>
            ) : <div className="text-sm text-gray-500">Doctors (collapsed)</div>}
          </div>

          {/* Health Tips */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => toggleCollapse('tips')}
            onKeyDown={e => { if (e.key === 'Enter') toggleCollapse('tips') }}
            className={`bg-white rounded-2xl p-3 shadow-sm transform transition-transform duration-200 hover:scale-[1.02] hover:shadow-2xl hover:ring-4 hover:ring-indigo-200/50 cursor-pointer ${collapsed.tips ? 'opacity-80' : ''}`}
          >
            {!collapsed.tips ? (
              <>
                <h4 className="font-semibold">Health Tips</h4>
                <ul className="text-sm mt-2 space-y-2 text-gray-700">
                  {(personalizedTips.length ? personalizedTips : ['Drink 2L water daily','30 mins of exercise','Sleep 7–8 hours']).map((t,i)=> <li key={i}>• {t}</li>)}
                </ul>
              </>
            ) : <div className="text-sm text-gray-500">Tips (collapsed)</div>}
          </div>

          {/* BMI Calculator */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => toggleCollapse('bmi')}
            onKeyDown={e => { if (e.key === 'Enter') toggleCollapse('bmi') }}
            className={`bg-white rounded-2xl p-3 shadow-sm transform transition-transform duration-200 hover:scale-[1.02] hover:shadow-2xl hover:ring-4 hover:ring-indigo-200/50 cursor-pointer ${collapsed.bmi ? 'opacity-80' : ''}`}
          >
            {!collapsed.bmi ? (
              <>
                <h4 className="font-semibold">BMI Calculator</h4>
                <div className="text-sm text-gray-600 mt-2">Enter weight (kg) and height (cm) to calculate BMI.</div>
                <form onSubmit={handleCalculateAndSaveBMI} className="mt-2 space-y-2">
                  <div className="flex gap-2">
                    <input value={weight} onChange={e=>setWeight(e.target.value)} placeholder="Weight kg" className="flex-1 border rounded p-2 text-sm" inputMode="decimal" />
                    <input value={height} onChange={e=>setHeight(e.target.value)} placeholder="Height cm" className="flex-1 border rounded p-2 text-sm" inputMode="numeric" />
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="submit" className="px-3 py-2 bg-indigo-600 text-white rounded text-sm" disabled={bmiSaving}>Calculate</button>
                    <div className="text-sm text-gray-500">{bmi ? `BMI: ${bmi} (${bmiCategory(bmi)})` : '—'}</div>
                  </div>
                </form>
                <div className="text-xs text-gray-400 mt-2">Saved BMI will be sent to backend if available.</div>
              </>
            ) : <div className="text-sm text-gray-500">BMI (collapsed)</div>}
          </div>

          {/* Emergency */}
          <div className="bg-white rounded-2xl p-3 shadow-sm">
            <h4 className="font-semibold">Emergency</h4>
            <div className="mt-2">
              <button className="w-full bg-red-600 text-white py-2 rounded" onClick={()=> window.open('tel:108')}>Call Emergency</button>
            </div>
          </div>

        </div>
      </div>

      {/* Profile Editor Modal */}
      {profileEditing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h4 className="font-semibold mb-3">Edit Profile</h4>
            <form onSubmit={handleSaveProfile} className="space-y-3">
              <input value={draftProfile.name} onChange={e=>setDraftProfile({...draftProfile, name: e.target.value})} placeholder="Full name" className="w-full border rounded p-2" />
              <input value={draftProfile.email} onChange={e=>setDraftProfile({...draftProfile, email: e.target.value})} placeholder="Email" className="w-full border rounded p-2" />
              <div className="flex gap-2">
                <input value={draftProfile.age} onChange={e=>setDraftProfile({...draftProfile, age: e.target.value})} placeholder="Age" className="w-1/2 border rounded p-2" />
                <input value={draftProfile.gender} onChange={e=>setDraftProfile({...draftProfile, gender: e.target.value})} placeholder="Gender" className="w-1/2 border rounded p-2" />
              </div>
              <input value={draftProfile.blood_group} onChange={e=>setDraftProfile({...draftProfile, blood_group: e.target.value})} placeholder="Blood group" className="w-full border rounded p-2" />
              <input value={draftProfile.allergies} onChange={e=>setDraftProfile({...draftProfile, allergies: e.target.value})} placeholder="Allergies" className="w-full border rounded p-2" />
              <input value={draftProfile.chronic_conditions} onChange={e=>setDraftProfile({...draftProfile, chronic_conditions: e.target.value})} placeholder="Chronic conditions" className="w-full border rounded p-2" />

              <div className="flex justify-end gap-2">
                <button type="button" className="px-4 py-2 rounded border" onClick={()=>setProfileEditing(false)}>Cancel</button>
                <button type="submit" className="px-4 py-2 rounded bg-indigo-600 text-white">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <div className="fixed right-6 bottom-6 z-50 flex flex-col items-end gap-3">
        <div className="flex flex-col gap-2 items-end">
          <button
            onClick={() => { exportCSV(); }}
            aria-label="Export CSV"
            className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-white transform transition-all duration-150 hover:scale-110 hover:shadow-2xl hover:ring-4 hover:ring-indigo-200/40"
            title="Export CSV"
          >
            📥
          </button>

          <button
            onClick={() => { refreshData(); }}
            aria-label="Refresh"
            className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-white transform transition-all duration-150 hover:scale-110 hover:shadow-2xl hover:ring-4 hover:ring-indigo-200/40"
            title="Refresh"
          >
            🔁
          </button>

          <button
            onClick={() => { toggleCollapseAll(); }}
            aria-label="Toggle collapse all"
            className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-white transform transition-all duration-150 hover:scale-110 hover:shadow-2xl hover:ring-4 hover:ring-indigo-200/40"
            title="Collapse / Expand"
          >
            ↕️
          </button>
        </div>

        {/* Main FAB */}
        <div className="mt-1">
          <button
            onClick={() => { /* optional quick action */ }}
            className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xl transform transition-all duration-200 hover:scale-105 hover:shadow-2xl"
            title="HealthMate quick actions"
          >
            ⚕️
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Profile full page ----------
function ProfilePage() {
  const [employeeId] = useState(localStorage.getItem('employee_id') || 'emp_001');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await backendPost({ employee_id, type: 'health_report' });
        if (data.profile) setProfile(data.profile);
      } catch (e) {}
      setLoading(false);
    }
    load();
  }, [employeeId]);

  return (
    <div className="p-6 h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl p-6 shadow">
        <h2 className="text-xl font-semibold">Profile</h2>
        {loading ? <div className="text-sm text-gray-500">Loading...</div> : (
          <div className="mt-4 text-sm text-gray-700">
            <div>Name: {profile?.name || '-'}</div>
            <div>Age: {profile?.age || '-'}</div>
            <div>Gender: {profile?.gender || '-'}</div>
            <div>Blood group: {profile?.blood_group || '-'}</div>
            <div>BMI: {profile?.bmi || '-'}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Reports page ----------
function ReportsPage() {
  const [employeeId] = useState(localStorage.getItem('employee_id') || 'emp_001');
  const [chartData, setChartData] = useState({ healthTrend: [], sleepTrend: [], vitalsTrend: [], consultationsByMonth: [], remindersAdherence: [] });

  useEffect(() => {
    async function load() {
      try {
        const data = await backendPost({ employee_id, type: 'chart_data' });
        if (data) setChartData({
          healthTrend: data.healthTrend || [],
          sleepTrend: data.sleepTrend || [],
          vitalsTrend: data.vitalsTrend || [],
          consultationsByMonth: data.consultationsByMonth || [],
          remindersAdherence: data.remindersAdherence || []
        });
      } catch (e) {
        // ignore
      }
    }
    load();
  }, [employeeId]);

  return (
    <div className="p-6 h-screen bg-gray-50 overflow-auto">
      <div className="max-w-6xl mx-auto grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-sm font-semibold">Health Trend</h3>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData.healthTrend}><XAxis dataKey="date"/><YAxis/><Tooltip/><Line dataKey="score"/></LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-sm font-semibold">Sleep Trend</h3>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData.sleepTrend}><XAxis dataKey="date"/><YAxis/><Tooltip/><Line dataKey="hours"/></LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- App wrapper ----------
export default function App() {
  const [employeeId, setEmployeeId] = useState(localStorage.getItem('employee_id') || 'emp_001');

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white shadow-sm p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-xl font-bold">HealthMate</div>
              <div className="hidden md:block"><NavSidebar employeeId={employeeId} /></div>
            </div>
            <div>
              <input defaultValue={employeeId} onBlur={e => { localStorage.setItem('employee_id', e.target.value); setEmployeeId(e.target.value); }} className="border rounded p-1 text-sm" />
            </div>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<HealthDashboard employeeIdProp={employeeId} />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/reports" element={<ReportsPage />} />
        </Routes>

      </div>
    </Router>
  );
}
