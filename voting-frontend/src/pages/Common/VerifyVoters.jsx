import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2, CheckCircle, XCircle, User, FileText, AlertCircle } from "lucide-react";
import useAuthStore from "../../store/useAuthStore";
import InlineMessage from "../../components/UI/InlineMessage";

// Separate Modal Component for IPFS Data
const IPFSDataModal = ({ cid, onClose, token }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchIPFS = async () => {
            try {
                const res = await fetch(`/api/pre-election/ipfs/${cid}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!res.ok) throw new Error("Failed to fetch data from IPFS");

                const jsonData = await res.json();
                setData(jsonData);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchIPFS();
    }, [cid, token]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900 border border-white/10 p-8 rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold">Voter Registration Data</h3>
                    <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
                        <XCircle size={24} />
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-500" size={40} /></div>
                ) : error ? (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">{error}</div>
                ) : (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                                <span className="block text-xs uppercase text-gray-500 font-bold mb-1">Full Name</span>
                                <span className="text-lg font-medium">{data.fullName}</span>
                            </div>
                            <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                                <span className="block text-xs uppercase text-gray-500 font-bold mb-1">Date of Birth</span>
                                <span className="text-lg font-medium">{data.dob}</span>
                            </div>
                        </div>

                        <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                            <span className="block text-xs uppercase text-gray-500 font-bold mb-1">Address</span>
                            <p className="font-medium text-gray-300">{data.address}</p>
                        </div>

                        <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                            <span className="block text-xs uppercase text-gray-500 font-bold mb-1">UUID Number</span>
                            <span className="font-mono text-lg font-medium text-emerald-400">{data.uuid || "N/A"}</span>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default function VerifyVoters() {
    const { election_id } = useParams();
    const navigate = useNavigate();
    const { token, role } = useAuthStore();

    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [selectedCID, setSelectedCID] = useState(null);
    const [processingId, setProcessingId] = useState(null);

    useEffect(() => {
        fetchSubmissions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [election_id]);

    const fetchSubmissions = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/pre-election/${election_id}/submissions`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to fetch submissions");

            const data = await res.json();
            setSubmissions(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (id, status) => {
        setProcessingId(id);
        try {
            const res = await fetch(`/api/pre-election/submissions/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ status })
            });

            if (!res.ok) throw new Error(`Failed to mark as ${status}`);

            setSubmissions(submissions.map(s => s.id === id ? { ...s, status } : s));
        } catch (err) {
            alert(err.message);
        } finally {
            setProcessingId(null);
        }
    };

    const pending = submissions.filter(s => s.status === 'pending');
    const processed = submissions.filter(s => s.status !== 'pending');

    return (
        <div className="min-h-screen bg-[#020617] text-white p-6 md:p-12 font-sans relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-600/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-6xl mx-auto relative z-10">
                <header className="mb-12">
                    <button
                        onClick={() => navigate(role === "admin" ? "/admin/view-elections" : "/authority/elections")}
                        className="flex items-center gap-2 text-gray-500 hover:text-white mb-6 transition-colors group"
                    >
                        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="text-sm font-medium">Back to Elections</span>
                    </button>

                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-widest mb-4">
                            <User size={14} /> Authority Verification
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2">Verify Pre-Election Voters</h1>
                        <p className="text-gray-400 font-mono text-sm">Election ID: <span className="text-white bg-white/5 px-2 py-1 rounded">{election_id}</span></p>
                    </div>
                </header>

                <InlineMessage type="error" message={error} />

                {loading ? (
                    <div className="flex justify-center py-32"><Loader2 className="animate-spin text-indigo-500" size={48} /></div>
                ) : (
                    <div className="space-y-12">

                        {/* Pending Section */}
                        <section>
                            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                                Needs Review
                                <span className="bg-indigo-500/20 text-indigo-400 text-sm px-3 py-1 rounded-full">{pending.length}</span>
                            </h2>

                            {pending.length === 0 ? (
                                <div className="p-8 border border-white/5 bg-white/5 rounded-3xl text-center text-gray-400">
                                    <CheckCircle size={40} className="mx-auto mb-4 text-emerald-500/50" />
                                    <p>All caught up! No pending registrations to review.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {pending.map(sub => (
                                        <SubmissionCard
                                            key={sub.id}
                                            submission={sub}
                                            onViewData={() => setSelectedCID(sub.ipfs_cid)}
                                            onUpdateStatus={handleUpdateStatus}
                                            processingId={processingId}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* Processed Section */}
                        {processed.length > 0 && (
                            <section>
                                <h2 className="text-xl font-bold mb-6 text-gray-400 border-t border-white/5 pt-8">Processed Registrations</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-70 hover:opacity-100 transition-opacity">
                                    {processed.map(sub => (
                                        <SubmissionCard
                                            key={sub.id}
                                            submission={sub}
                                            onViewData={() => setSelectedCID(sub.ipfs_cid)}
                                            onUpdateStatus={handleUpdateStatus}
                                            processingId={processingId}
                                        />
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                )}
            </div>

            <AnimatePresence>
                {selectedCID && (
                    <IPFSDataModal
                        cid={selectedCID}
                        token={token}
                        onClose={() => setSelectedCID(null)}
                    />
                )}
            </AnimatePresence>

        </div>
    );
}

function SubmissionCard({ submission, onViewData, onUpdateStatus, processingId }) {
    const isPending = submission.status === 'pending';
    const isApproved = submission.status === 'approved';

    return (
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 p-6 rounded-3xl flex flex-col justify-between group hover:bg-slate-900/60 transition-all">
            <div className="mb-6">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-bold truncate pr-4">{submission.username}</h3>

                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md border ${isPending ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' :
                        isApproved ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                            'bg-red-500/10 border-red-500/30 text-red-400'
                        }`}>
                        {submission.status}
                    </span>
                </div>

                <div className="text-xs text-gray-500 font-mono mb-4 break-all">
                    IPFS CID: <br /> <span className="text-gray-400">{submission.ipfs_cid}</span>
                </div>

                <button
                    onClick={onViewData}
                    className="w-full py-2 bg-white/5 hover:bg-white/10 text-indigo-400 text-sm font-medium rounded-xl flex justify-center items-center gap-2 transition-colors border border-indigo-500/20"
                >
                    <FileText size={16} /> View Submitted Data
                </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {isPending ? (
                    <>
                        <button
                            disabled={processingId === submission.id}
                            onClick={() => onUpdateStatus(submission.id, 'approved')}
                            className="py-2.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                            {processingId === submission.id ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle size={16} /> Approve</>}
                        </button>
                        <button
                            disabled={processingId === submission.id}
                            onClick={() => onUpdateStatus(submission.id, 'rejected')}
                            className="py-2.5 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                            {processingId === submission.id ? <Loader2 size={16} className="animate-spin" /> : <><XCircle size={16} /> Reject</>}
                        </button>
                    </>
                ) : (
                    <div className="col-span-2 text-center text-xs text-gray-500 italic py-2">
                        Action completed
                    </div>
                )}
            </div>
        </div>
    );
}
