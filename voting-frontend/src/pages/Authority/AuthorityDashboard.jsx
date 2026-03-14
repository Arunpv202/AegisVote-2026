import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldAlert, Vote, LogOut, ArrowRight, ShieldCheck, Globe, KeySquare } from "lucide-react";
import useAuthStore from "../../store/useAuthStore";

export default function AuthorityDashboard() {
    const navigate = useNavigate();
    const { username, setRole } = useAuthStore();
    const displayUser = username || localStorage.getItem("username") || "Authority";

    const handleLogout = () => {
        setRole(null);
        localStorage.removeItem("role");
        navigate("/");
    };

    return (
        <div className="min-h-screen bg-[#020617] text-white flex flex-col font-sans relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-600/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/10 rounded-full blur-[120px]" />

            {/* Top Navigation Bar */}
            <nav className="relative z-10 border-b border-white/5 bg-slate-900/20 backdrop-blur-md px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                        <ShieldAlert size={20} className="text-white" />
                    </div>
                    <span className="font-bold tracking-tight text-xl">Authority Portal</span>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-mono text-gray-400">{displayUser}</span>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                    >
                        <LogOut size={20} />
                    </button>
                </div>
            </nav>

            {/* Main Content */}
            <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-widest mb-4">
                        <ShieldCheck size={14} /> Authority Node Active
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Welcome, Authority Node</h1>
                    <p className="text-gray-400 max-w-lg mx-auto leading-relaxed">
                        Manage your cryptographic keys, participate in Distributed Key Generation, and oversee election integrity.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl w-full">
                    <DashboardCard
                        title="DKG Access"
                        desc="Participate in the Distributed Key Generation process and submit partial decryption shares."
                        icon={<KeySquare size={32} />}
                        onClick={() => navigate("/authority/enter")}
                        color="red"
                    />
                    <DashboardCard
                        title="View Blockchain"
                        desc="Verify encrypted votes on-chain and check election data."
                        icon={<Globe size={32} />}
                        onClick={() => navigate("/blockexplorer?context=authority")}
                        color="indigo"
                    />
                    <DashboardCard
                        title="View Elections"
                        desc="Monitor ongoing elections."
                        icon={<Vote size={32} />}
                        onClick={() => navigate("/authority/elections")}
                        color="emerald"
                    />
                </div>
            </main>

            {/* Footer Info */}
            <footer className="relative z-10 p-8 text-center border-t border-white/5">
                <div className="flex justify-center gap-6 text-[10px] uppercase tracking-[0.2em] font-bold text-gray-600">
                    <span>Encrypted Identity</span>
                    <span>•</span>
                    <span>Zero-Knowledge Voting</span>
                    <span>•</span>
                    <span>Immutable Ledger</span>
                </div>
            </footer>
        </div>
    );
}

function DashboardCard({ title, desc, icon, onClick, color }) {
    const isIndigo = color === "indigo";
    const isRed = color === "red";

    return (
        <motion.div
            whileHover={{ y: -8, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className={`group cursor-pointer relative p-1 rounded-[2rem] bg-gradient-to-b from-white/10 to-transparent hover:from-white/20 transition-all duration-500 shadow-2xl`}
        >
            <div className="bg-[#0f172a]/90 backdrop-blur-xl p-8 rounded-[1.9rem] h-full flex flex-col items-start text-left">
                <div className={`mb-6 p-4 rounded-2xl transition-all duration-300 ${isRed
                    ? "bg-red-500/10 text-red-400 group-hover:bg-red-600 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                    : isIndigo
                        ? "bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(79,70,229,0.4)]"
                        : "bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                    }`}>
                    {icon}
                </div>

                <h2 className="text-2xl font-bold mb-3 group-hover:text-white transition-colors">{title}</h2>
                <p className="text-gray-400 text-sm leading-relaxed mb-8 flex-1">{desc}</p>

                <div className={`flex items-center gap-2 font-bold text-xs uppercase tracking-widest transition-all ${isRed ? "text-red-400 group-hover:text-red-300" : isIndigo ? "text-indigo-400 group-hover:text-indigo-300" : "text-emerald-400 group-hover:text-emerald-300"
                    }`}>
                    <span>Access Portal</span>
                    <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform" />
                </div>
            </div>
        </motion.div>
    );
}
