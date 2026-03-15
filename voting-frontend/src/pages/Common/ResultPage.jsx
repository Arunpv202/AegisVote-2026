import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
    ArrowLeft, Trophy, BarChart3, Medal, Share2, Award, 
    ShieldCheck, CheckCircle2 
} from "lucide-react";
import axios from "axios";
import { motion } from "framer-motion";

export default function ResultPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [election, setElection] = useState(null);
    const [candidates, setCandidates] = useState([]);
    const [totalVotes, setTotalVotes] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [resultsPending, setResultsPending] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const elecRes = await axios.get(`/api/elections/${id}`);
                setElection(elecRes.data);

                try {
                    const [resultRes, candRes] = await Promise.all([
                        axios.get(`/api/elections/${id}/final-result`),
                        axios.get(`/api/elections/${id}/candidates`)
                    ]);

                    // Merge blockchain vote counts with local DB data (CIDs, Party)
                    const candDataMap = {};
                    (candRes.data || []).forEach(c => { 
                        candDataMap[c.candidate_name] = {
                            photo_cid: c.photo_cid,
                            symbol_cid: c.symbol_cid,
                            symbol_name: c.symbol_name,
                            party: c.party || "" 
                        }; 
                    });

                    const merged = (resultRes.data || []).map(r => ({
                        ...r,
                        ...(candDataMap[r.candidate_name] || {})
                    }));

                    const sorted = merged.sort((a, b) => b.vote_count - a.vote_count);
                    setCandidates(sorted);

                    const total = sorted.reduce((sum, c) => sum + (c.vote_count || 0), 0);
                    setTotalVotes(total);
                } catch (resErr) {
                    if (resErr.response && resErr.response.status === 400 && resErr.response.data.status === 'pending') {
                        setResultsPending(true);
                    } else {
                        setError("Could not retrieve final results. They might still be computing.");
                        console.error(resErr);
                    }
                }

            } catch (e) {
                console.error("Failed to load election details", e);
                setError("Election not found or error loading details.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    if (loading) return (
        <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center text-white font-sans">
            <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
            <p className="text-gray-400 animate-pulse">Retrieving Secure Tally...</p>
        </div>
    );

    if (error) return (
        <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center text-white p-6">
            <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-[2rem] max-w-md text-center">
                <h2 className="text-2xl font-bold text-red-400 mb-4">Error</h2>
                <p className="text-gray-400 mb-6">{error}</p>
                <button onClick={() => navigate(-1)} className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors">Go Back</button>
            </div>
        </div>
    );

    if (resultsPending) return (
        <div className="min-h-screen bg-[#020617] text-white p-6 flex items-center justify-center relative overflow-hidden font-sans">
             <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px]" />
             <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px]" />
             
             <div className="text-center relative z-10 max-w-xl">
                <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8 border border-white/10">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }}>
                        <Share2 size={40} className="text-indigo-400" />
                    </motion.div>
                </div>
                <h1 className="text-4xl font-black mb-4 bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">Results are Pending</h1>
                <p className="text-gray-400 leading-relaxed mb-8">
                    The election has either not ended yet, or the authorities are currently performing the secure multi-party decryption to reveal the final tally.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button onClick={() => navigate(-1)} className="px-8 py-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/10 font-bold">Return to Dashboard</button>
                    <button onClick={() => window.location.reload()} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-2xl transition-all shadow-lg shadow-indigo-600/20 font-bold">Refresh Status</button>
                </div>
             </div>
        </div>
    );

    const winner = candidates[0];
    const isTie = candidates.length > 1 && candidates[0].vote_count === candidates[1].vote_count;

    return (
        <div className="min-h-screen bg-[#020617] text-white p-6 font-sans relative overflow-hidden">
            {/* Background Accents */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[140px]" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[140px]" />

            <div className="max-w-6xl mx-auto relative z-10">
                <header className="flex items-center justify-between mb-8 sm:mb-12">
                    <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors py-2 px-4 rounded-xl hover:bg-white/5">
                        <ArrowLeft size={18} /> Back
                    </button>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold text-[10px] uppercase tracking-widest">
                        <ShieldCheck size={14} /> <span className="hidden sm:inline">Verified on</span> Blockchain
                    </div>
                </header>

                <div className="text-center mb-12 sm:mb-16 px-4">
                    <h1 className="text-4xl sm:text-5xl md:text-7xl font-black mb-6 tracking-tight bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
                        {election?.election_name}
                    </h1>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                        <div className="text-center sm:text-left">
                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Total Participation</p>
                            <p className="text-2xl font-black text-white">{totalVotes} <span className="text-gray-600 text-sm font-medium">Votes Cast</span></p>
                        </div>
                        <div className="hidden sm:block w-px h-10 bg-white/10" />
                        <div className="text-center sm:text-left">
                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Status</p>
                            <p className="text-2xl font-black text-emerald-400 flex items-center gap-2">Completed <CheckCircle2 size={18} /></p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-20">
                    {/* Winner Spotlight */}
                    {!isTie && winner && (
                        <motion.div 
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="lg:col-span-5 flex flex-col items-center"
                        >
                            <div className="relative group w-full max-w-[18rem] sm:max-w-sm">
                                <div className="absolute inset-0 bg-indigo-600/20 rounded-[3rem] blur-3xl group-hover:bg-indigo-600/30 transition-all duration-500" />
                                
                                <div className="relative bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-[3rem] p-6 sm:p-10 flex flex-col items-center">
                                    <div className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 bg-yellow-500 text-black p-3 sm:p-4 rounded-3xl rotate-12 shadow-xl z-20">
                                        <Award size={24} className="sm:hidden" />
                                        <Award size={32} className="hidden sm:block" />
                                    </div>
                                    
                                    {/* Equal Weightage Photos */}
                                <div className="flex gap-4 mb-8">
                                    {/* Candidate Photo */}
                                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-[2rem] overflow-hidden border-4 border-indigo-500/30 shadow-xl relative">
                                        {winner?.photo_cid ? (
                                            <img 
                                                src={`/api/pre-election/ipfs-image/${winner.photo_cid}`} 
                                                alt={winner.candidate_name}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.src = "https://ui-avatars.com/api/?name=" + encodeURIComponent(winner.candidate_name) + "&background=random&size=256";
                                                }}
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-slate-800 flex items-center justify-center text-gray-600">
                                                No Photo
                                            </div>
                                        )}
                                    </div>

                                    {/* Symbol Photo */}
                                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-[2rem] overflow-hidden border-4 border-emerald-500/30 shadow-xl relative bg-white p-2">
                                        {winner?.symbol_cid ? (
                                            <img 
                                                src={`/api/pre-election/ipfs-image/${winner.symbol_cid}`} 
                                                alt="symbol" 
                                                className="w-full h-full object-contain" 
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-600">
                                                No Symbol
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="text-center w-full">
                                    <h2 className="text-indigo-400 font-bold text-[10px] uppercase tracking-[0.2em] mb-2 sm:mb-3">Election Winner</h2>
                                    <h3 className="text-2xl sm:text-4xl font-black mb-6 leading-tight truncate px-2">{winner?.candidate_name}</h3>
                                    
                                    <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full">
                                        <div className="bg-black/40 rounded-2xl p-3 sm:p-4 border border-white/5">
                                            <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Votes</p>
                                            <p className="text-xl sm:text-2xl font-black text-white">{winner?.vote_count}</p>
                                        </div>
                                        <div className="bg-black/40 rounded-2xl p-3 sm:p-4 border border-white/5">
                                            <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Margin</p>
                                            <p className="text-xl sm:text-2xl font-black text-indigo-400">
                                                {totalVotes > 0 ? ((winner.vote_count / totalVotes) * 100).toFixed(1) : 0}%
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Rankings Table */}
                    <div className={`${isTie ? 'lg:col-span-12' : 'lg:col-span-7'} space-y-4 px-4 sm:px-0 mt-8 lg:mt-0`}>
                        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                             <BarChart3 className="text-indigo-400" size={20} /> Candidate Standings
                        </h3>
                        {candidates.map((cand, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ x: 30, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.1 + idx * 0.1 }}
                                className={`flex flex-col sm:flex-row items-center sm:items-center gap-4 sm:gap-6 p-4 sm:p-5 rounded-[2rem] border transition-all duration-300 ${
                                    idx === 0 
                                    ? 'bg-indigo-600/10 border-indigo-500/20 shadow-lg shadow-indigo-600/5' 
                                    : 'bg-white/5 border-white/5 hover:border-white/10'
                                }`}
                            >
                                <div className="flex items-center gap-4 w-full sm:w-auto">
                                    <div className={`w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center font-black text-lg border ${
                                        idx === 0 ? 'bg-indigo-600 text-white border-white/20' : 'bg-slate-800 text-gray-500 border-white/5'
                                    }`}>
                                        {idx + 1}
                                    </div>

                                    <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 border border-white/10 bg-slate-800 relative">
                                        {cand.photo_cid ? (
                                            <img 
                                                src={`/api/pre-election/ipfs-image/${cand.photo_cid}`} 
                                                className="w-full h-full object-cover" 
                                                alt="" 
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.src = "https://ui-avatars.com/api/?name=" + encodeURIComponent(cand.candidate_name) + "&background=random&size=256";
                                                }}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-600">ID {idx+1}</div>
                                        )}
                                        {/* Tiny symbol overlay on ranking items */}
                                        {cand.symbol_cid && (
                                            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-md p-0.5 border border-indigo-500/30">
                                                <img src={`/api/pre-election/ipfs-image/${cand.symbol_cid}`} className="w-full h-full object-contain" alt="" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-grow sm:hidden">
                                        <h4 className="font-black text-lg text-white truncate max-w-[150px]">{cand.candidate_name}</h4>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{cand.vote_count} Votes</p>
                                    </div>
                                </div>

                                <div className="hidden sm:block flex-grow min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h4 className="font-black text-lg truncate">{cand.candidate_name}</h4>
                                        {cand.party && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-gray-400 border border-white/5 uppercase font-bold tracking-tighter">
                                                {cand.party}
                                            </span>
                                        )}
                                    </div>
                                    <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${totalVotes > 0 ? (cand.vote_count / totalVotes) * 100 : 0}%` }}
                                            transition={{ duration: 1, delay: 0.5 + idx * 0.1 }}
                                            className={`h-full rounded-full ${idx === 0 ? 'bg-indigo-500' : 'bg-gray-600'}`}
                                        />
                                    </div>
                                </div>

                                {/* Progress bar for mobile only */}
                                <div className="w-full sm:hidden px-2 mb-2">
                                    <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${totalVotes > 0 ? (cand.vote_count / totalVotes) * 100 : 0}%` }}
                                            transition={{ duration: 1, delay: 0.5 + idx * 0.1 }}
                                            className={`h-full rounded-full ${idx === 0 ? 'bg-indigo-500' : 'bg-gray-600'}`}
                                        />
                                    </div>
                                </div>

                                <div className="text-right flex items-center justify-between w-full sm:w-auto sm:block flex-shrink-0 min-w-[80px]">
                                    <div className="text-xl sm:text-2xl font-black text-white">{cand.vote_count} <span className="sm:hidden text-xs text-gray-500 ml-1">Votes</span></div>
                                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                                        {totalVotes > 0 ? ((cand.vote_count / totalVotes) * 100).toFixed(1) : 0}% Support
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Footer Insight */}
                <footer className="mt-20 border-t border-white/10 pt-10 text-center text-gray-500 pb-10">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <Medal size={16} /> <span className="text-xs font-bold uppercase tracking-widest">Election Data Integrity Guaranteed by Aegis Zero-Knowledge Engine</span>
                    </div>
                    <p className="text-[10px] max-w-2xl mx-auto leading-relaxed">
                        The individual votes resulting in this tally were encrypted on-chain and only decrypted through a threshold multi-party computation protocol. No single authority had access to the individual ballots.
                    </p>
                </footer>
            </div>
        </div>
    );
}
