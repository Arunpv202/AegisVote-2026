import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft,
    Search,
    Loader2,
    AlertCircle,
    FileText,
    Clock,
    Calendar,
    CheckCircle2,
    Globe,
    User,
    UserPlus
} from "lucide-react";
import useAuthStore from "../../store/useAuthStore";
import InlineMessage from "../../components/UI/InlineMessage";

export default function SearchElection() {
    const navigate = useNavigate();
    const { token } = useAuthStore();

    const [electionId, setElectionId] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [election, setElection] = useState(null);
    const [role, setRole] = useState('voter');

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!electionId.trim()) return;

        setLoading(true);
        setError(null);
        setElection(null);

        try {
            // getElection API
            const response = await fetch(`/api/elections/${electionId.trim()}`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error("Election not found with that ID.");
                }
                throw new Error("Failed to fetch election details.");
            }

            const data = await response.json();
            setElection(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const isPreElectionActive = () => {
        if (!election || !election.pre_election_start || !election.pre_election_end) return false;
        const now = Math.floor(Date.now() / 1000);
        return now >= election.pre_election_start && now <= election.pre_election_end;
    };

    return (
        <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-6 relative overflow-hidden font-sans">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" />
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-2xl relative z-10"
            >
                <button
                    onClick={() => navigate("/user/dashboard")}
                    className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-all group px-4 py-2 hover:bg-white/5 rounded-lg w-fit"
                >
                    <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-sm font-medium">Back to Dashboard</span>
                </button>

                <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 p-10 md:p-14 rounded-[3rem] shadow-2xl relative">
                    <div className="absolute -top-10 -left-10 w-40 h-40 bg-gradient-to-br from-indigo-500/20 to-transparent rounded-full blur-2xl pointer-events-none" />

                    <div className="text-center mb-10">
                        <div className="inline-flex p-5 bg-indigo-500/10 rounded-3xl text-indigo-400 mb-6 border border-indigo-500/20 shadow-lg shadow-indigo-500/10">
                            <Globe size={40} />
                        </div>
                        <h2 className="text-4xl font-black tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Search Election</h2>
                        <p className="text-gray-400 text-base leading-relaxed max-w-lg mx-auto">
                            Find an election to join by entering its unique Election ID reference.
                        </p>
                    </div>

                    <InlineMessage type="error" message={error} onClose={() => setError(null)} />

                    <form onSubmit={handleSearch} className="space-y-6 mb-8">
                        <div className="group">
                            <div className="relative transform transition-all group-focus-within:scale-[1.01]">
                                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-400 transition-colors" size={24} />
                                <input
                                    type="text"
                                    value={electionId}
                                    onChange={(e) => setElectionId(e.target.value)}
                                    placeholder="Enter Election Reference ID..."
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-6 pl-16 pr-6 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder:text-gray-700 font-medium font-mono text-lg text-white"
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={loading || !electionId.trim()}
                            className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg rounded-2xl shadow-xl shadow-indigo-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">
                            {loading ? <Loader2 className="animate-spin" size={24} /> : "Search"}
                        </button>
                    </form>

                    <AnimatePresence>
                        {election && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-black/40 border border-white/10 p-6 rounded-2xl"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-2xl font-bold mb-1 text-white">{election.election_name}</h3>
                                        <p className="text-sm text-gray-400">ID: <span className="font-mono text-indigo-400">{election.election_id}</span></p>
                                    </div>
                                    <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg flex items-center gap-2">
                                        <CheckCircle2 size={16} className="text-emerald-400" />
                                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Found</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 mb-6 text-sm text-gray-400">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={16} />
                                        <span>Pre-Election: {election.pre_election_start ? new Date(election.pre_election_start * 1000).toLocaleDateString() : 'N/A'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Clock size={16} />
                                        <span>Election: {election.start_time ? new Date(election.start_time * 1000).toLocaleDateString() : 'N/A'}</span>
                                    </div>
                                </div>

                                {isPreElectionActive() ? (
                                    <div className="space-y-4">
                                        <div className="flex bg-black/40 border border-white/10 rounded-xl p-1 gap-1">
                                            <button
                                                onClick={() => setRole('voter')}
                                                className={`flex-1 py-3 rounded-lg flex items-center justify-center gap-2 text-sm font-bold transition-all ${role === 'voter' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'
                                                    }`}
                                            >
                                                <User size={18} /> Voter
                                            </button>
                                            <button
                                                onClick={() => setRole('candidate')}
                                                className={`flex-1 py-3 rounded-lg flex items-center justify-center gap-2 text-sm font-bold transition-all ${role === 'candidate' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'
                                                    }`}
                                            >
                                                <UserPlus size={18} /> Candidate
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => navigate(role === 'voter' ? `/user/pre-election-form/${election.election_id}` : `/user/candidate-pre-election-form/${election.election_id}`)}
                                            className={`w-full py-4 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg ${role === 'voter' ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
                                                }`}
                                        >
                                            <FileText size={20} />
                                            Submit as {role === 'voter' ? 'Voter' : 'Candidate'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm flex items-center gap-3">
                                        <AlertCircle size={20} className="shrink-0" />
                                        <p>
                                            The pre-election phase is currently closed. You can only submit registration forms during the active pre-election window.
                                        </p>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                </div>
            </motion.div>
        </div>
    );
}
