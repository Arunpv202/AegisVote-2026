import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  PlusCircle,
  BarChart3,
  ShieldCheck,
  Database,
  ArrowRight,
  Fingerprint,
  Key,
  UserCheck,
  Vote,
  LogOut
} from "lucide-react";

import useAuthStore from "../../store/useAuthStore";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { username, role } = useAuthStore();
  const displayUser = username || localStorage.getItem("username") || "Admin";

  // Protect Route & Fix Refresh Redirection
  useEffect(() => {
    if (!username || role !== "admin") {
      // If we have a role but it's not admin, redirect to correct dashboard
      if (role === "user") navigate("/user/dashboard");
      else if (role === "authority") navigate("/authority/dashboard");
      else navigate("/login");
    }
  }, [username, role, navigate]);

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col font-sans relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[120px]" />

      {/* Top Navigation Bar */}
      <nav className="relative z-10 border-b border-white/5 bg-slate-900/20 backdrop-blur-md px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <ShieldCheck size={20} className="text-white" />
          </div>
          <span className="font-bold tracking-tight text-xl">Governance Portal</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full">
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-mono text-gray-400">{displayUser}</span>
          </div>
          <button
            onClick={() => navigate("/")}
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-widest mb-4">
            <Fingerprint size={14} /> Authority Protocol Active
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Admin Control</h1>
          <p className="text-gray-400 max-w-lg mx-auto leading-relaxed">
            Manage the lifecycle of decentralized elections. Deploy smart contracts and verify participation on the blockchain.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 max-w-7xl w-full">
          <DashboardCard
            title="Create Election"
            desc="Initialize a new ballot, register candidate data, and deploy the voting contract."
            icon={<PlusCircle size={32} />}
            onClick={() => navigate("/admin/create-election")}
            color="indigo"
          />
          <DashboardCard
            title="View Elections"
            desc="Review active polls, monitor live turnout, and finalize results on-chain."
            icon={<BarChart3 size={32} />}
            onClick={() => navigate("/admin/view-elections")}
            color="emerald"
          />
          <DashboardCard
            title="DKG Access"
            desc="Enter the DKG Secure Portal to participate in key generation."
            icon={<ShieldCheck size={32} />}
            onClick={() => navigate("/authority/enter")}
            color="indigo"
          />
          <DashboardCard
            title="View Blockchain"
            desc="Inspect on-chain election data, authority statuses, and encrypted votes."
            icon={<Key size={32} />}
            onClick={() => navigate("/blockexplorer?context=admin")}
            color="emerald"
          />
          <DashboardCard
            title="Verify Users"
            desc="Review voter and candidate forms, approve or reject with digital signature."
            icon={<UserCheck size={32} />}
            onClick={() => navigate("/admin/verify-submissions")}
            color="indigo"
          />
        </div>
      </main >

      {/* Footer Info */}
      < footer className="relative z-10 p-8 text-center border-t border-white/5" >
        <div className="flex justify-center gap-6 text-[10px] uppercase tracking-[0.5em] font-bold text-gray-600">
          <span>Secured</span>
          <span>•</span>
          <span>Block Time: 0.04s</span>
        </div>
      </footer >
    </div >
  );
}

function DashboardCard({ title, desc, icon, onClick, color }) {
  const isIndigo = color === "indigo";

  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group cursor-pointer relative p-1 rounded-[2rem] bg-gradient-to-b from-white/10 to-transparent hover:from-white/20 transition-all duration-500 shadow-2xl"
    >
      <div className="bg-[#0f172a]/90 backdrop-blur-xl p-8 rounded-[1.9rem] h-full flex flex-col items-start text-left">
        <div className={`mb-6 p-4 rounded-2xl transition-all duration-300 ${isIndigo
          ? "bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(79,70,229,0.4)]"
          : "bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]"
          }`}>
          {icon}
        </div>

        <h2 className="text-2xl font-bold mb-3 group-hover:text-white transition-colors">{title}</h2>
        <p className="text-gray-400 text-sm leading-relaxed mb-8 flex-1">{desc}</p>

        <div className={`flex items-center gap-2 font-bold text-xs uppercase tracking-widest transition-all ${isIndigo ? "text-indigo-400 group-hover:text-indigo-300" : "text-emerald-400 group-hover:text-emerald-300"
          }`}>
          <span>Launch Module</span>
          <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform" />
        </div>
      </div>
    </motion.div>
  );
}