// BlockExplorerPage.jsx – sidebar layout with 3 nav sections
import React, { useState, useCallback, useEffect } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
    Database, ArrowLeft, Loader2,
    ShieldCheck, User, Key, ChevronRight,
    LayoutDashboard, Users, Lock, Search as SearchIcon, FileText, Image as ImageIcon
} from "lucide-react";

import ElectionDetailsCard from "./ElectionDetailsCard";
import VoteCard from "./VoteCard";
import AuthorityCard from "./AuthorityCard";
import SearchNullifier from "./SearchNullifier";

// ─────────────────────────────────────────────────────────────────────────────
// Election ID Entry Modal
// ─────────────────────────────────────────────────────────────────────────────
function ElectionIdModal({ onSubmit }) {
    const [id, setId] = useState("");
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-5">
                    <Database size={22} className="text-indigo-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-1">Block Explorer</h2>
                <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                    Enter an Election ID to inspect the on-chain data for that election.
                    Your role (creator / voter / authority) will be detected automatically.
                </p>
                <input
                    autoFocus
                    type="text"
                    value={id}
                    onChange={e => setId(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && id.trim() && onSubmit(id.trim())}
                    placeholder="e.g. election-2024-01"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors mb-4"
                />
                <button
                    onClick={() => id.trim() && onSubmit(id.trim())}
                    disabled={!id.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <ChevronRight size={16} /> View Blockchain
                </button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Role badge
// ─────────────────────────────────────────────────────────────────────────────
function RoleBadge({ role }) {
    const map = {
        creator: { label: "Creator", cls: "bg-indigo-500/15 text-indigo-400 border-indigo-500/25", Icon: ShieldCheck },
        voter: { label: "Voter", cls: "bg-emerald-500/12 text-emerald-400 border-emerald-500/25", Icon: User },
        authority: { label: "Authority", cls: "bg-amber-500/12 text-amber-400 border-amber-500/25", Icon: Key },
        both: { label: "Voter + Authority", cls: "bg-violet-500/12 text-violet-400 border-violet-500/25", Icon: ShieldCheck },
    };
    const cfg = map[role] || map.voter;
    const { label, cls, Icon } = cfg;
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest border ${cls}`}>
            <Icon size={12} /> {label}
        </span>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar nav item
// ─────────────────────────────────────────────────────────────────────────────
function NavItem({ icon: Icon, label, active, onClick, badge }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group relative whitespace-nowrap flex-shrink-0 w-auto md:w-full
                ${active
                    ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-lg shadow-indigo-500/10"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent"
                }`}
        >
            {/* Active indicator bar */}
            {active && (
                <span className="absolute left-1/2 bottom-0 -translate-x-1/2 h-0.5 w-6 bg-indigo-400 rounded-full md:left-0 md:top-1/2 md:-translate-y-1/2 md:-translate-x-0 md:h-6 md:w-0.5" />
            )}
            <span className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${active ? "bg-indigo-500/20 text-indigo-400" : "bg-white/[0.04] text-slate-500 group-hover:text-slate-300"}`}>
                <Icon size={15} />
            </span>
            <span className="flex-1 text-left">{label}</span>
            {badge != null && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? "bg-indigo-500/30 text-indigo-300" : "bg-white/[0.06] text-slate-500"}`}>
                    {badge}
                </span>
            )}
        </button>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section heading in content area
// ─────────────────────────────────────────────────────────────────────────────
function ContentHeading({ icon: Icon, title, subtitle, color = "indigo" }) {
    const clrs = {
        indigo: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400",
        amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
        emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    };
    return (
        <div className="flex items-center gap-3 mb-6">
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${clrs[color]}`}>
                <Icon size={17} />
            </div>
            <div>
                <h2 className="text-base font-black text-white tracking-tight">{title}</h2>
                {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated section panels
// ─────────────────────────────────────────────────────────────────────────────

/** Election Overview panel */
function PanelElectionOverview({ data }) {
    return (
        <div className="animate-fadeIn">
            <ContentHeading
                icon={LayoutDashboard}
                title="Election Overview"
                subtitle="On-chain election metadata and configuration"
                color="indigo"
            />
            <ElectionDetailsCard election={data.election} authorities={data.authorities} />
        </div>
    );
}

/** Authority Status panel */
function PanelAuthorityStatus({ data, role }) {
    const isAuthority = role === "authority" || role === "both";
    return (
        <div className="animate-fadeIn">
            <ContentHeading
                icon={Users}
                title="Authority Status"
                subtitle={`${data.authorities?.length ?? 0} participating authorities`}
                color="amber"
            />
            {/* If role is authority/both, show the user's own card first */}
            {isAuthority && data.authoritySection && (
                <div className="mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500/60 mb-2">Your Status</p>
                    <AuthorityCard authority={data.authoritySection} />
                </div>
            )}

            {/* Full authority list */}
            {data.authorities?.length > 0 ? (
                <>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
                        All Authorities ({data.authorities.length})
                    </p>
                    <div className="flex flex-col gap-2.5">
                        {data.authorities.map(auth => (
                            <AuthorityCard
                                key={auth.authorityId || auth.id || auth.name}
                                authority={auth}
                            />
                        ))}
                    </div>
                </>
            ) : (
                <p className="text-sm text-slate-500 py-6 text-center">No authority information available.</p>
            )}
        </div>
    );
}

/** My Submissions panel */
function PanelMySubmissions({ electionId }) {
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [ipfsData, setIpfsData] = useState(null);
    const [ipfsLoading, setIpfsLoading] = useState(false);

    const fetchSubmissions = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/blockexplorer/my-submissions/${electionId}`);
            setSubmissions(res.data);
        } catch (err) {
            console.error("[PanelMySubmissions] error:", err);
        } finally {
            setLoading(false);
        }
    }, [electionId]);

    const handleSelect = async (sub) => {
        setSelected(sub);
        setIpfsLoading(true);
        setIpfsData(null);
        try {
            const res = await axios.get(`/api/pre-election/ipfs/${sub.ipfs_cid}`);
            setIpfsData(res.data);
        } catch (err) {
            console.error("[PanelMySubmissions] IPFS error:", err);
        } finally {
            setIpfsLoading(false);
        }
    };

    useEffect(() => {
        fetchSubmissions();
    }, [fetchSubmissions]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 gap-3 text-slate-500">
                <Loader2 className="animate-spin text-indigo-400" size={24} />
                <p className="text-xs font-medium">Fetching your submissions...</p>
            </div>
        );
    }

    if (selected) {
        return (
            <div className="animate-fadeIn">
                <button
                    onClick={() => { setSelected(null); setIpfsData(null); }}
                    className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-widest mb-6"
                >
                    <ArrowLeft size={12} /> Back to Submissions
                </button>

                <div className="bg-slate-900/60 border border-white/[0.08] rounded-2xl p-6 overflow-hidden">
                    <div className="flex items-center gap-3 mb-6">
                        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${selected.role === 'candidate' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'}`}>
                            {selected.role === 'candidate' ? <ImageIcon size={20} /> : <User size={20} />}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white capitalize">{selected.role} Form</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                    selected.status === 'approved' ? 'bg-emerald-500/15 text-emerald-400' :
                                    selected.status === 'rejected' ? 'bg-red-500/15 text-red-400' :
                                    'bg-amber-500/15 text-amber-400'
                                }`}>
                                    {selected.status}
                                </span>
                                <span className="text-slate-600 text-[10px]">•</span>
                                <span className="text-[10px] text-slate-500 font-mono italic">Submitted {new Date(selected.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>

                    {ipfsLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-600">
                            <Loader2 className="animate-spin" size={20} />
                            <p className="text-xs">Unpacking from IPFS...</p>
                        </div>
                    ) : ipfsData ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {Object.entries(ipfsData).map(([key, val]) => {
                                    if (key === 'username' || key === 'role' || key.toLowerCase().endsWith('cid') || key.toLowerCase().includes('image')) return null;
                                    return (
                                        <div key={key} className="bg-black/30 border border-white/5 rounded-xl p-3">
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{key.replace(/([A-Z])/g, ' $1')}</p>
                                            <p className="text-sm text-slate-300 font-medium break-all">{String(val)}</p>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Images for candidates */}
                            {selected.role === 'candidate' && (ipfsData.photoImageCid || ipfsData.symbolImageCid) && (
                                <div className="grid grid-cols-2 gap-4">
                                    {ipfsData.photoImageCid && (
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Candidate Photo</p>
                                            <div className="bg-black/40 border border-white/5 rounded-xl p-2 aspect-square flex items-center justify-center overflow-hidden">
                                                <img 
                                                    src={`/api/pre-election/ipfs-image/${ipfsData.photoImageCid}`} 
                                                    alt="Candidate" 
                                                    className="w-full h-full object-cover rounded-lg"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    {ipfsData.symbolImageCid && (
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Party Symbol</p>
                                            <div className="bg-black/40 border border-white/5 rounded-xl p-2 aspect-square flex items-center justify-center overflow-hidden">
                                                <img 
                                                    src={`/api/pre-election/ipfs-image/${ipfsData.symbolImageCid}`} 
                                                    alt="Symbol" 
                                                    className="w-full h-full object-contain rounded-lg p-2"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="pt-4 border-t border-white/5 space-y-4">
                                <div>
                                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Technical Details</p>
                                    <div className="space-y-2">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">IPFS CID</span>
                                            <code className="text-[10px] font-mono text-indigo-400 bg-indigo-500/5 px-2 py-1 rounded border border-indigo-500/10 break-all">{selected.ipfs_cid}</code>
                                        </div>
                                        {selected.approved_cid && (
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-tighter">Approval Proof (CID)</span>
                                                <code className="text-[10px] font-mono text-emerald-400 bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/10 break-all">{selected.approved_cid}</code>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {selected.approvalMetadata && (
                                    <div className="animate-fadeIn p-4 rounded-2xl bg-emerald-500/[0.03] border border-emerald-500/10">
                                        <div className="flex items-center gap-2 mb-4">
                                             <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                                <ShieldCheck size={12} className="text-emerald-400" />
                                             </div>
                                             <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Verification Success</p>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div className="bg-black/20 rounded-xl p-3 border border-white/5">
                                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter mb-1">Approved By</p>
                                                <p className="text-sm text-slate-200 font-black">{selected.approvalMetadata.admin}</p>
                                            </div>
                                            <div className="bg-black/20 rounded-xl p-3 border border-white/5">
                                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter mb-1">Decision Locked At</p>
                                                <p className="text-sm text-slate-200 font-mono truncate">
                                                    {new Date(selected.approvalMetadata.timestamp).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Admin Digital Signature</p>
                                            <div className="bg-black/40 rounded-xl p-3 border border-white/5 relative group">
                                                <code className="text-[10px] font-mono text-slate-400 break-all block leading-relaxed max-h-24 overflow-y-auto custom-scrollbar">
                                                    {selected.approvalMetadata.signature}
                                                </code>
                                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[8px] font-bold uppercase tracking-tighter text-slate-500">
                                                        ECC Signature
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-[8px] text-slate-600 italic">This cryptographic signature verifies that the admin has manually reviewed and approved this specific submission hash.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-slate-500 text-sm italic">Failed to load content.</div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fadeIn">
            <ContentHeading
                icon={FileText}
                title="My Submissions"
                subtitle="Your pre-election form history and status"
                color="indigo"
            />

            {submissions.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                    {submissions.map(sub => (
                        <button
                            key={sub.id}
                            onClick={() => handleSelect(sub)}
                            className="bg-slate-900/50 border border-white/[0.05] hover:border-indigo-500/30 hover:bg-slate-900/80 rounded-2xl p-4 transition-all group flex items-center justify-between text-left"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${sub.role === 'candidate' ? 'bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500/20' : 'bg-indigo-500/10 text-indigo-500 group-hover:bg-indigo-500/20'}`}>
                                    {sub.role === 'candidate' ? <ImageIcon size={20} /> : <User size={20} />}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white capitalize">{sub.role} Registration</p>
                                    <p className="text-[10px] font-mono text-slate-500 mt-0.5">{sub.ipfs_cid.slice(0, 16)}...</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <p className={`text-[10px] font-bold uppercase tracking-widest ${
                                        sub.status === 'approved' ? 'text-emerald-400' :
                                        sub.status === 'rejected' ? 'text-red-400' :
                                        'text-amber-400'
                                    }`}>
                                        {sub.status}
                                    </p>
                                    <p className="text-[9px] text-slate-600 mt-0.5">{new Date(sub.createdAt).toLocaleDateString()}</p>
                                </div>
                                <ChevronRight size={16} className="text-slate-700 group-hover:text-white transition-colors" />
                            </div>
                        </button>
                    ))}
                </div>
            ) : (
                <div className="bg-slate-900/40 border border-white/[0.05] rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center text-slate-600">
                        <FileText size={20} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-300">No submissions found</p>
                        <p className="text-xs text-slate-600 mt-1 max-w-[240px]">You haven't submitted any pre-election forms for this election yet.</p>
                    </div>
                </div>
            )}
        </div>
    );
}

/** Encrypted Votes panel */
function PanelEncryptedVotes({ data, electionId, showVoterVerify, onSearchNullifier, triggerNullifier }) {
    return (
        <div className="animate-fadeIn">
            <ContentHeading
                icon={Lock}
                title="Encrypted Votes"
                subtitle="On-chain vote commitments and nullifier lookup"
                color="emerald"
            />

            {/* ── Nullifier search – always at the top ── */}
            <div className="mb-6">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                    <SearchIcon size={11} /> Search by Nullifier
                </p>
                <SearchNullifier
                    electionId={electionId}
                    initialNullifier={triggerNullifier}
                    disableVerification={!showVoterVerify}
                />
            </div>



            {/* ── Latest votes grid (creator + authority) ── */}
            {!showVoterVerify && (
                <div className="mb-6">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
                        Latest Encrypted Votes
                    </p>
                    {data.latestVotes?.length ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {data.latestVotes.slice(0, 2).map((v, i) => (
                                <VoteCard
                                    key={i}
                                    vote={v}
                                    index={i}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500 py-4">No votes submitted yet.</p>
                    )}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
const ALL_NAV_ITEMS = [
    { id: "overview", label: "Election Overview", icon: LayoutDashboard },
    { id: "my_submissions", label: "My Submissions", icon: FileText, role: ["voter", "both"] },
    { id: "authority", label: "Authority Status", icon: Users },
    { id: "votes", label: "Encrypted Votes", icon: Lock },
];

export default function BlockExplorerPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [electionId, setElectionId] = useState("");
    const [showModal, setShowModal] = useState(true);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [activeSection, setActiveSection] = useState("overview");
    const [triggerNullifier, setTriggerNullifier] = useState("");

    // Context filtering
    const context = searchParams.get("context"); // 'voter' or 'authority'
    const role = data?.role ?? "";
    const filteredNavItems = ALL_NAV_ITEMS.filter(item => {
        // 1. Context-based strict hides
        if (context === "admin" || context === "authority") {
            if (item.id === "my_submissions") return false;
        }

        // 2. Specific context filtering
        if (context === "voter" && item.id === "authority") return false;
        
        // 3. Role-based fallback for voter view (Default)
        if (item.id === "my_submissions") {
            const hasSubmissions = data?.hasSubmissions ?? false;
            // Only show if they have a role that actually submits OR already has submissions
            return role === "voter" || role === "both" || role === "creator" || hasSubmissions;
        }

        return true;
    });

    const handleSearchNullifier = useCallback((nullifier) => {
        setTriggerNullifier("");
        setTimeout(() => {
            setActiveSection("votes");
            setTriggerNullifier(nullifier);
        }, 0);
    }, []);

    const fetchData = useCallback(async (id) => {
        setLoading(true);
        setError("");
        setData(null);
        setShowModal(false);
        setElectionId(id);
        setActiveSection("overview");
        try {
            const res = await axios.post(
                "/api/blockexplorer/view",
                { electionId: id },
                { withCredentials: true }
            );
            setData(res.data);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to fetch blockchain data.");
        } finally {
            setLoading(false);
        }
    }, []);

    // Auto-fetch if ID provided in query
    useEffect(() => {
        const idFromQuery = searchParams.get("id");
        if (idFromQuery) {
            fetchData(idFromQuery);
        }
    }, [searchParams, fetchData]);

    const reset = () => {
        setData(null);
        setError("");
        setElectionId("");
        setShowModal(true);
    };

    const showVoterVerify = (context === "admin" || context === "authority") 
        ? false 
        : (role === "voter" || role === "both");
    const authBadge = data?.authorities?.length ?? null;
    const votesBadge = data?.latestVotes?.length ?? null;

    return (
        <div className="min-h-screen bg-[#020617] text-white relative overflow-hidden font-sans">
            {/* BG glows */}
            <div className="pointer-events-none fixed top-[-15%] left-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[120px]" />
            <div className="pointer-events-none fixed bottom-[-15%] right-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-600/8 blur-[120px]" />

            {/* Election ID modal */}
            {showModal && <ElectionIdModal onSubmit={fetchData} />}


            <div className="relative z-10 max-w-7xl mx-auto px-4 py-8 flex flex-col min-h-screen">
                {/* ── Header ── */}
                <header className="flex items-center gap-4 mb-8 flex-wrap">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest border border-white/[0.07] px-3 py-2 rounded-xl hover:border-white/20"
                    >
                        <ArrowLeft size={14} /> Back
                    </button>

                    <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                            <Database size={20} className="text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black tracking-tight text-white">Chain Explorer</h1>
                            {electionId && (
                                <p className="font-mono text-[11px] text-slate-500">
                                    ID: {electionId}
                                    <button
                                        onClick={reset}
                                        className="ml-2 text-indigo-400 hover:text-indigo-300 text-[11px] underline"
                                    >
                                        change
                                    </button>
                                </p>
                            )}
                        </div>
                    </div>

                    {data?.role && <RoleBadge role={data.role} />}
                </header>

                {/* ── Loading ── */}
                {loading && (
                    <div className="flex flex-col items-center justify-center flex-1 gap-4 text-slate-500">
                        <Loader2 size={36} className="animate-spin text-indigo-400" />
                        <p className="text-sm font-medium">Querying blockchain…</p>
                    </div>
                )}

                {/* ── Error ── */}
                {error && !loading && (
                    <div className="bg-red-500/10 border border-red-500/25 rounded-2xl px-6 py-5 text-red-400 text-sm text-center max-w-lg mx-auto mt-16">
                        <p className="font-bold mb-1">Error</p>
                        <p>{error}</p>
                        <button
                            onClick={reset}
                            className="mt-4 px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-xs font-bold hover:bg-red-500/25 transition"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {/* ── Sidebar + Content layout ── */}
                {data && !loading && (
                    <div className="flex flex-col md:flex-row gap-6 flex-1 items-start">

                        {/* ══ LEFT SIDEBAR ══ */}
                        <aside className="w-full md:w-56 flex-shrink-0 md:sticky md:top-8 z-20">
                            {/* Sidebar header */}
                            <div className="mb-4 px-1">
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 mb-1">Navigation</p>
                                <div className="h-px bg-white/[0.05]" />
                            </div>

                            <nav className="flex flex-row overflow-x-auto md:flex-col gap-2 md:gap-1 pb-2 md:pb-0 scrollbar-hide">
                                {filteredNavItems.map(item => (
                                    <NavItem
                                        key={item.id}
                                        icon={item.icon}
                                        label={item.label}
                                        active={activeSection === item.id}
                                        onClick={() => setActiveSection(item.id)}
                                        badge={
                                            item.id === "authority" ? authBadge :
                                                item.id === "votes" ? votesBadge :
                                                    null
                                        }
                                    />
                                ))}
                            </nav>

                            {/* Sidebar footer – election meta */}
                            <div className="mt-6 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mb-2">Election</p>
                                <p className="text-xs text-slate-300 font-semibold truncate">{data.election?.electionName || "—"}</p>
                                <p className="font-mono text-[10px] text-slate-600 mt-1 truncate">#{data.election?.electionId || electionId}</p>
                                {data.role && (
                                    <div className="mt-2">
                                        <RoleBadge role={data.role} />
                                    </div>
                                )}
                            </div>
                        </aside>

                        {/* ══ RIGHT CONTENT ══ */}
                        <main className="flex-1 min-w-0">
                            {activeSection === "overview" && (
                                <PanelElectionOverview data={data} />
                            )}
                            {activeSection === "authority" && (
                                <PanelAuthorityStatus data={data} role={role} />
                            )}
                            {activeSection === "votes" && (
                                <PanelEncryptedVotes
                                    data={data}
                                    electionId={electionId}
                                    showVoterVerify={showVoterVerify}
                                    onSearchNullifier={handleSearchNullifier}
                                    triggerNullifier={triggerNullifier}
                                />
                            )}
                            {activeSection === "my_submissions" && (
                                <PanelMySubmissions electionId={electionId} />
                            )}
                        </main>
                    </div>
                )}
            </div>

            {/* Fade-in animation */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.25s ease-out both;
                }
            `}</style>
        </div>
    );
}
