import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import useAuthStore from "../../store/useAuthStore";
import {
  ArrowLeft,
  PlusCircle,
  User,
  FileText,
  Fingerprint,
  Calendar,
  Users,
  Clock,
  ArrowRight,
  Settings,
  Trash2
} from "lucide-react";

export default function CreateElection() {
  const navigate = useNavigate();
  const { username, token } = useAuthStore();
  const [formData, setFormData] = useState({
    election_name: "",
    election_id: "",
    pre_election_start: "",
    pre_election_end: "",
    election_start: "",
    election_end: "",
    result_time: "",
  });
  const [authorities, setAuthorities] = useState([]);
  const [newAuthority, setNewAuthority] = useState({ name: "", username: "" });
  const [loading, setLoading] = useState(false);

  const handleAddAuthority = () => {
    if (newAuthority.username) {
      setAuthorities([...authorities, { ...newAuthority, username: newAuthority.username.trim() }]);
      setNewAuthority({ name: "", username: "" });
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleNext = async () => {
    if (!username) {
      alert("You must be logged in to create an election.");
      return;
    }

    const now = new Date();
    const preStart = new Date(formData.pre_election_start);
    const preEnd = new Date(formData.pre_election_end);
    const start = new Date(formData.election_start);
    const end = new Date(formData.election_end);
    const resTime = new Date(formData.result_time);

    if (preStart <= now) {
      alert("Pre-election start time must be in the future.");
      return;
    }
    if (preEnd <= preStart) {
      alert("Pre-election end time must be after the pre-election start time.");
      return;
    }
    if (start <= preEnd) {
      alert("Election start time must be after the pre-election end time.");
      return;
    }
    if (end <= start) {
      alert("Election end time must be after the election start time.");
      return;
    }
    if (resTime <= end) {
      alert("Result time must be after the election end time.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        authorities: authorities.map(a => a.username).join(",")
      }; // creator_name is extracted from token on backend

      const response = await fetch("/api/elections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        // Pass election_id to next page or store in context/localstorage
        // specific to this flow. For now, we can pass via navigation state if needed,
        // or just let the user re-enter it (as per UI design).
        // Let's store in localStorage for convenience in this session
        localStorage.setItem("current_election_id", formData.election_id);
        navigate("/admin/dashboard");
      } else {
        const error = await response.json();
        alert("Error: " + error.message);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to create election.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-4 md:p-6 relative overflow-hidden font-sans">
      {/* Background Aesthetic Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        {/* Navigation Control */}
        <button
          onClick={() => navigate("/admin/dashboard")}
          className="flex items-center gap-2 text-gray-500 hover:text-white mb-6 md:mb-8 transition-all group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium tracking-wide">Back to Dashboard</span>
        </button>

        <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 p-5 md:p-10 rounded-3xl shadow-2xl relative">
          {/* Header Section */}
          <div className="mb-8 md:mb-10 text-center">
            <div className="inline-flex p-3 bg-indigo-500/20 rounded-2xl text-indigo-400 mb-3 md:mb-4">
              <PlusCircle size={32} />
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-2">Create Election</h2>
            <p className="text-gray-400 text-xs md:text-sm">Enter the specific details to initialize your ballot.</p>
          </div>

          {/* Form Fields */}
          <div className="space-y-6">

            {/* ELECTION NAME */}
            <div className="group">
              <label className="block text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Election Name</label>
              <div className="relative">
                <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-indigo-400 transition-colors" size={20} />
                <input
                  type="text"
                  name="election_name"
                  value={formData.election_name}
                  onChange={handleChange}
                  placeholder="e.g. Student Council 2024"
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 md:py-4 pl-10 md:pl-12 pr-3 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder:text-gray-700 font-medium text-sm md:text-base"
                />
              </div>
            </div>

            {/* ELECTION ID */}
            <div className="group">
              <label className="block text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Election ID</label>
              <div className="relative">
                <Fingerprint className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-indigo-400 transition-colors" size={20} />
                <input
                  type="text"
                  name="election_id"
                  value={formData.election_id}
                  onChange={handleChange}
                  placeholder="Unique ID or Reference"
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 md:py-4 pl-10 md:pl-12 pr-3 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder:text-gray-700 font-medium text-sm md:text-base"
                />
              </div>
            </div>

            {/* AUTHORITY SETUP */}
            <section className="space-y-4 border-t border-white/5 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-400 ml-1">Authority Setup</h3>
              <div className="grid grid-cols-1 gap-3 md:gap-4">
                <div className="group">
                  <div className="relative">
                    <User className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-indigo-400 transition-colors" size={18} />
                    <input
                      type="text"
                      value={newAuthority.name}
                      onChange={(e) => setNewAuthority({ ...newAuthority, name: e.target.value })}
                      placeholder="Authority Name (Optional)"
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-3 md:py-4 pl-10 md:pl-12 pr-3 outline-none focus:border-indigo-500/50 transition-all font-medium text-sm md:text-base"
                    />
                  </div>
                </div>
                <div className="group">
                  <div className="relative">
                    <Settings className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-indigo-400 transition-colors" size={18} />
                    <input
                      type="text"
                      value={newAuthority.username}
                      onChange={(e) => setNewAuthority({ ...newAuthority, username: e.target.value })}
                      placeholder="Authority Username"
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-3 md:py-4 pl-10 md:pl-12 pr-3 outline-none focus:border-indigo-500/50 transition-all font-medium font-mono text-xs md:text-sm"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleAddAuthority}
                className="w-full py-3 bg-indigo-600/20 border border-indigo-600/30 text-indigo-400 hover:bg-indigo-600 hover:text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <PlusCircle size={18} /> Add Authority
              </button>

              {/* Added Authorities List */}
              {authorities.length > 0 && (
                <div className="space-y-2 mt-4">
                  {authorities.map((a, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                      <span className="text-sm font-medium text-gray-300">{a.name ? `${a.name} ` : "Authority "}({a.username})</span>
                      <Trash2 size={16} className="text-red-400 cursor-pointer" onClick={() => setAuthorities(authorities.filter((_, idx) => idx !== i))} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* PRE-ELECTION TIMINGS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mt-2">
              <div className="group">
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Pre-Election Start</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-indigo-400 transition-colors" size={16} />
                  <input
                    type="datetime-local"
                    name="pre_election_start"
                    value={formData.pre_election_start}
                    onChange={handleChange}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2 md:py-3 pl-9 pr-4 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all text-xs md:text-sm focus:text-white text-gray-400"
                  />
                </div>
              </div>
              <div className="group">
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Pre-Election End</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-indigo-400 transition-colors" size={16} />
                  <input
                    type="datetime-local"
                    name="pre_election_end"
                    value={formData.pre_election_end}
                    onChange={handleChange}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2 md:py-3 pl-9 pr-4 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all text-xs md:text-sm focus:text-white text-gray-400"
                  />
                </div>
              </div>
            </div>

            {/* ELECTION TIMINGS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mt-2">
              <div className="group">
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Election Start</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-indigo-400 transition-colors" size={16} />
                  <input
                    type="datetime-local"
                    name="election_start"
                    value={formData.election_start}
                    onChange={handleChange}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2 md:py-3 pl-9 pr-4 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all text-xs md:text-sm focus:text-white text-gray-400"
                  />
                </div>
              </div>
              <div className="group">
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Election End</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-indigo-400 transition-colors" size={16} />
                  <input
                    type="datetime-local"
                    name="election_end"
                    value={formData.election_end}
                    onChange={handleChange}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2 md:py-3 pl-9 pr-4 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all text-xs md:text-sm focus:text-white text-gray-400"
                  />
                </div>
              </div>
            </div>

            {/* RESULT TIMING */}
            <div className="group mt-2">
              <label className="block text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Result Time</label>
              <div className="relative">
                <Clock className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-indigo-400 transition-colors" size={18} />
                <input
                  type="datetime-local"
                  name="result_time"
                  value={formData.result_time}
                  onChange={handleChange}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 md:py-4 pl-9 md:pl-12 pr-4 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all font-medium text-xs md:text-sm focus:text-white text-gray-400"
                />
              </div>
            </div>
          </div>


          {/* Action Button */}
          <button
            onClick={handleNext}
            disabled={loading}
            className="w-full mt-8 md:mt-12 py-3 md:py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 text-sm md:text-base"
          >
            {loading ? "Creating..." : (
              <>
                <span>Next: Register Users</span>
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>

        {/* Informational Footer */}
        <p className="mt-8 text-center text-gray-600 text-[10px] uppercase tracking-[0.3em] font-bold">
          Step 1 of 2: Initialization
        </p>
      </motion.div >
    </div >
  );
}