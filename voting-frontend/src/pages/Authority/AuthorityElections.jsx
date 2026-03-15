import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, PlayCircle, Timer, CheckCircle2, BarChart3, Clock, Calendar, Lock, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import useAuthStore from "../../store/useAuthStore";

export default function AuthorityElections() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("ongoing");
    const { username, role } = useAuthStore();
    const [elections, setElections] = useState({
        ongoing: [],
        upcoming: [],
        completed: []
    });
    const [loading, setLoading] = useState(true);

    // Protect Route & Fix Refresh Redirection
    useEffect(() => {
        if (!username || role !== "authority") {
            if (role === "admin") navigate("/admin/dashboard");
            else if (role === "user") navigate("/user/dashboard");
            else navigate("/login");
        }
    }, [username, role, navigate]);

    useEffect(() => {
        const fetchElections = async () => {
            if (!username) return;
            try {
                const res = await fetch(`/api/elections/authority/${username}`, {
                    headers: {
                        'Authorization': `Bearer ${useAuthStore.getState().token}`
                    }
                });

                if (res.ok) {
                    const data = await res.json();
                    const now = new Date();

                    const ongoing = [];
                    const upcoming = [];
                    const completed = [];

                    data.forEach(e => {
                        // API now strictly returns authority elections

                        const start = new Date(e.start_time);
                        const end = new Date(e.end_time);

                        let status = e.status || 'unknown';
                        if (!e.status) {
                            if (end < now) status = 'completed';
                            else if (start > now) status = 'upcoming';
                            else status = 'ongoing';
                        }

                        const uiElection = {
                            id: e.election_id,
                            name: e.election_name,
                            creator: e.creator_name,
                            info: "",
                            start_time: start,
                            end_time: end,
                            status: status,
                            authority_id: e.my_authority_id
                        };

                        if (status === 'completed') {
                            uiElection.info = e.end_time ? `Closed on ${end.toLocaleDateString()}` : 'Closed';
                            completed.push(uiElection);
                        } else if (status === 'upcoming') {
                            uiElection.info = e.start_time ? `Opens in ${Math.ceil((start - now) / (1000 * 60 * 60 * 24))} days` : 'Not yet scheduled';
                            upcoming.push(uiElection);
                        } else { // ongoing
                            uiElection.info = e.end_time ? `Ends in ${Math.ceil((end - now) / (1000 * 60 * 60))} hours` : 'Ongoing';
                            ongoing.push(uiElection);
                        }
                    });

                    setElections({ ongoing, upcoming, completed });
                }
            } catch (err) {
                console.error("Failed to fetch authority elections", err);
            } finally {
                setLoading(false);
            }
        };
        fetchElections();
    }, [username]);

    return (
        <div className="min-h-screen bg-[#020617] text-white p-6 md:p-12 font-sans relative overflow-hidden">
            <div className="absolute top-0 left-0 w-96 h-96 bg-red-600/5 rounded-full blur-[120px]" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-600/5 rounded-full blur-[120px]" />

            <div className="max-w-7xl mx-auto relative z-10">
                <header className="mb-12">
                    <button
                        onClick={() => navigate("/authority/dashboard")}
                        className="flex items-center gap-2 text-gray-500 hover:text-white mb-6 transition-colors group"
                    >
                        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="text-sm font-medium">Back to Portal</span>
                    </button>
                    <div className="text-center">
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Authority Elections</h1>
                        <p className="text-gray-400">Manage and oversee elections you are an authority for.</p>
                    </div>
                </header>

                <div className="flex justify-center mb-16">
                    <div className="flex gap-2 p-1.5 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/5 w-full max-w-xl shadow-2xl">
                        <TabButton active={activeTab === "ongoing"} onClick={() => setActiveTab("ongoing")} icon={<PlayCircle size={16} />} label="Ongoing" />
                        <TabButton active={activeTab === "upcoming"} onClick={() => setActiveTab("upcoming")} icon={<Timer size={16} />} label="Upcoming" />
                        <TabButton active={activeTab === "completed"} onClick={() => setActiveTab("completed")} icon={<CheckCircle2 size={16} />} label="Closed" />
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin text-red-500" size={40} /></div>
                ) : (
                    <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <AnimatePresence mode="popLayout">
                            {elections[activeTab].map((election) => (
                                <ElectionCard
                                    key={election.id}
                                    election={election}
                                    type={activeTab}
                                    navigate={navigate}
                                />
                            ))}
                            {elections[activeTab].length === 0 && (
                                <div className="col-span-1 border border-white/10 bg-white/5 rounded-3xl p-10 mt-10 w-full md:col-span-2 lg:col-span-3 text-center text-gray-400">
                                    No {activeTab} elections found.
                                </div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
            </div>
        </div>
    );
}

function TabButton({ active, onClick, icon, label }) {
    return (
        <button
            onClick={onClick}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${active ? "bg-red-600 text-white shadow-xl shadow-red-600/40 scale-[1.02]" : "text-gray-500 hover:text-gray-300"
                }`}
        >
            {icon} {label}
        </button>
    );
}

function ElectionCard({ election, type, navigate }) {
    const isOngoing = type === "ongoing";
    const isUpcoming = type === "upcoming";
    const isCompleted = type === "completed";
    const { authority_id } = election;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ y: -8 }}
            className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 p-7 rounded-[2.5rem] flex flex-col justify-between shadow-xl transition-all group"
        >
            <div>
                <div className="flex justify-between items-start mb-6">
                    <div className="p-3 rounded-2xl bg-white/5 text-red-400 group-hover:bg-red-600 group-hover:text-white transition-all duration-300">
                        <BarChart3 size={24} />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <span className={`text-[10px] font-black tracking-widest px-3 py-1 rounded-full border ${isOngoing ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' :
                            isUpcoming ? 'border-indigo-500/30 text-indigo-400 bg-indigo-500/5' :
                                'border-gray-500/30 text-gray-500 bg-gray-500/5'
                            }`}>
                            {type}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">ID: {election.id}</span>
                        <span className="text-[10px] text-red-400 font-mono mt-1">Auth ID: {authority_id}</span>
                    </div>
                </div>

                <h3 className="text-2xl font-bold mb-1 leading-tight">{election.name}</h3>
                <p className="text-gray-500 text-sm mb-6">{election.creator}</p>

                <div className="flex items-center gap-2 text-sm text-gray-400 mb-8 py-2 px-3 bg-white/5 rounded-lg w-fit">
                    {isOngoing ? <Clock size={16} className="text-emerald-400 animate-pulse" /> : <Calendar size={16} />}
                    <span className="font-mono">{election.info}</span>
                </div>
            </div>

            {isCompleted && (
                <div className="space-y-3">
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={() => navigate(`/authority/dkg/dashboard/${election.id}`, { state: { authorityId: authority_id } })}
                            className="w-full py-3 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-red-900/20"
                        >
                            Calculate Result
                        </button>
                        <button
                            onClick={() => navigate(`/results/${election.id}`)}
                            className="w-full py-3 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-all"
                        >
                            View Result
                        </button>
                    </div>
                </div>
            )}
        </motion.div>
    );
}
