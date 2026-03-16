import { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import {
    ArrowLeft, Lock, ShieldCheck, CheckCircle2,
    KeyRound, ArrowRight, Loader2, XCircle,
    DatabaseZap, Send, AlertTriangle
} from "lucide-react";
import { ristretto255 } from '@noble/curves/ed25519.js';
import axios from "axios";
import useAuthStore from "../../store/useAuthStore";
import { initDB } from "../../utils/zkStorage";
import { motion, AnimatePresence } from "framer-motion";

// ─── Step definitions ──────────────────────────────────────────────────────────
const STEPS = [
    {
        id: "load_key",
        label: "Loading Secure Key Share",
        description: "Retrieving your private key share from encrypted local storage.",
        icon: KeyRound,
    },
    {
        id: "parse_tally",
        label: "Reading Encrypted Tally",
        description: "Fetching and parsing the aggregated encrypted vote tally.",
        icon: DatabaseZap,
    },
    {
        id: "compute_proofs",
        label: "Computing ZK Proofs",
        description: "Generating zero-knowledge proofs for each candidate component.",
        icon: ShieldCheck,
    },
    {
        id: "submit",
        label: "Submitting Decryption Share",
        description: "Securely sending your cryptographic share to the server.",
        icon: Send,
    },
];

const STEP_IDLE    = "idle";
const STEP_ACTIVE  = "active";
const STEP_DONE    = "done";
const STEP_ERROR   = "error";

// ─── Single Step Row Component ─────────────────────────────────────────────────
function StepRow({ step, state, errorMsg, isLast }) {
    const Icon = step.icon;

    const iconBg = {
        idle:   "bg-white/5 text-gray-600",
        active: "bg-indigo-500/20 text-indigo-400",
        done:   "bg-emerald-500/20 text-emerald-400",
        error:  "bg-red-500/20 text-red-400",
    }[state];

    const labelColor = {
        idle:   "text-gray-500",
        active: "text-white",
        done:   "text-emerald-300",
        error:  "text-red-300",
    }[state];

    return (
        <div className="flex gap-4">
            {/* Left: icon + connector line */}
            <div className="flex flex-col items-center">
                <motion.div
                    layout
                    className={`p-2.5 rounded-xl shrink-0 transition-all duration-500 ${iconBg}`}
                >
                    {state === STEP_ACTIVE ? (
                        <Loader2 size={20} className="animate-spin" />
                    ) : state === STEP_DONE ? (
                        <CheckCircle2 size={20} />
                    ) : state === STEP_ERROR ? (
                        <XCircle size={20} />
                    ) : (
                        <Icon size={20} />
                    )}
                </motion.div>
                {!isLast && (
                    <motion.div
                        className={`w-px flex-1 mt-1 mb-1 rounded-full transition-all duration-700 ${
                            state === STEP_DONE
                                ? "bg-emerald-500/40"
                                : state === STEP_ERROR
                                ? "bg-red-500/30"
                                : "bg-white/8"
                        }`}
                        style={{ minHeight: 24 }}
                    />
                )}
            </div>

            {/* Right: text */}
            <div className="pb-5 min-w-0 flex-1">
                <p className={`font-semibold text-sm transition-colors duration-300 ${labelColor}`}>
                    {step.label}
                </p>
                <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                    {state === STEP_ERROR && errorMsg ? errorMsg : step.description}
                </p>
                {state === STEP_ACTIVE && (
                    <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 h-1 w-24 rounded-full overflow-hidden bg-white/5"
                    >
                        <motion.div
                            className="h-full bg-indigo-500 rounded-full"
                            animate={{ x: ["-100%", "200%"] }}
                            transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                        />
                    </motion.div>
                )}
            </div>
        </div>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AuthorityDecryption() {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { username } = useAuthStore();

    const [authorityId]  = useState(location.state?.authorityId || null);
    const [election, setElection]   = useState(null);
    const [pageStatus, setPageStatus] = useState("idle"); // idle | computing | submitted | error | no_tally
    const [globalError, setGlobalError] = useState(null);

    // Step state: { stepId: 'idle' | 'active' | 'done' | 'error' }
    const initialStepStates = Object.fromEntries(STEPS.map(s => [s.id, STEP_IDLE]));
    const [stepStates, setStepStates]   = useState(initialStepStates);
    const [stepErrors, setStepErrors]   = useState({});

    const setStep = (id, state, errorMsg = null) => {
        setStepStates(prev => ({ ...prev, [id]: state }));
        if (errorMsg) setStepErrors(prev => ({ ...prev, [id]: errorMsg }));
    };

    const resetSteps = () => {
        setStepStates(initialStepStates);
        setStepErrors({});
    };

    // ── Fetch election on mount ──────────────────────────────────────────────
    useEffect(() => {
        const fetchElection = async () => {
            try {
                if (authorityId) {
                    try {
                        const statusRes = await axios.get(`/api/elections/${id}/decrypt/${authorityId}/status`);
                        if (statusRes.data.hasSubmitted) {
                            setPageStatus("submitted");
                            // Mark all steps done for visual clarity
                            setStepStates(Object.fromEntries(STEPS.map(s => [s.id, STEP_DONE])));
                        }
                    } catch (_) { /* non-blocking */ }
                }

                const res = await axios.get(`/api/elections/${id}`);
                setElection(res.data);

                // Check if tally is ready
                const tally = res.data.encrypted_tally;
                const parsed = typeof tally === "string" ? JSON.parse(tally || "{}") : tally;
                if (!parsed || !parsed.c1 || !parsed.c1.some(h => h && h.length > 0)) {
                    setPageStatus("no_tally");
                }
            } catch (e) {
                setGlobalError("Failed to load election data: " + e.message);
                setPageStatus("error");
            }
        };
        fetchElection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // ── Decryption Logic ─────────────────────────────────────────────────────
    const executeDecryption = async () => {
        if (!election || !authorityId) return;

        setPageStatus("computing");
        setGlobalError(null);
        resetSteps();

        try {
            // Step 1 — Load key
            setStep("load_key", STEP_ACTIVE);
            const db = await initDB();
            const key = `auth_FINAL_${id}_${username}`;
            const record = await db.get("secrets", key);

            if (!record || (!record.secret_scalar && !record.encrypted_secret_scalar)) {
                const allKeys = await db.getAllKeys("secrets");
                console.error("Available Keys in DB:", allKeys);
                setStep("load_key", STEP_ERROR, `Key not found in device. Looked for: ${key}`);
                throw new Error("Private Key Share not found in device storage.");
            }

            if (record.encrypted_secret_scalar && !record.secret_scalar) {
                setStep("load_key", STEP_ERROR, "Encrypted share from old version — cannot decrypt.");
                throw new Error("Legacy encrypted share detected.");
            }

            if (!record.secret_scalar) {
                setStep("load_key", STEP_ERROR, "Could not retrieve the secret share.");
                throw new Error("Secret share missing.");
            }

            const secretScalar = BigInt("0x" + record.secret_scalar);
            setStep("load_key", STEP_DONE);

            // Step 2 — Parse tally
            setStep("parse_tally", STEP_ACTIVE);
            const tally = election.encrypted_tally;
            const encryptedTally = typeof tally === "string" ? JSON.parse(tally) : tally;

            if (!encryptedTally || !encryptedTally.c1) {
                setStep("parse_tally", STEP_ERROR, "Encrypted tally data missing from election.");
                throw new Error("Encrypted Tally data missing.");
            }

            const c1_strings = encryptedTally.c1;
            setStep("parse_tally", STEP_DONE);

            // Step 3 — Compute proofs
            setStep("compute_proofs", STEP_ACTIVE);
            const { proveDecryptionShare } = await import("../../utils/cryptoVoting");
            const decryptedShares = [];
            const proofs = [];

            for (let i = 0; i < c1_strings.length; i++) {
                const C1_point = ristretto255.Point.fromHex(c1_strings[i]);
                const D_i = C1_point.multiply(secretScalar);
                const Y_i = ristretto255.Point.BASE.multiply(secretScalar);

                const proof = proveDecryptionShare(
                    secretScalar.toString(),
                    Y_i.toHex(),
                    c1_strings[i],
                    D_i.toHex()
                );

                decryptedShares.push(D_i.toHex());
                proofs.push(proof);
            }
            setStep("compute_proofs", STEP_DONE);

            // Step 4 — Submit
            setStep("submit", STEP_ACTIVE);
            await axios.post(`/api/elections/${id}/decrypt`, {
                election_id: id,
                authority_id: authorityId,
                share_data: { c1_components: decryptedShares },
                proof: proofs,
            });

            setStep("submit", STEP_DONE);
            setPageStatus("submitted");

        } catch (e) {
            console.error(e);
            if (e.response?.status === 409) {
                // Already submitted — mark all done
                setStepStates(Object.fromEntries(STEPS.map(s => [s.id, STEP_DONE])));
                setPageStatus("submitted");
            } else {
                const errMsg = e.response?.data?.message || e.message;
                // Mark the currently-active step as error if not already marked
                setStepStates(prev => {
                    const updated = { ...prev };
                    const activeId = STEPS.find(s => prev[s.id] === STEP_ACTIVE)?.id;
                    if (activeId) updated[activeId] = STEP_ERROR;
                    return updated;
                });
                setGlobalError(errMsg);
                setPageStatus("error");
            }
        }
    };

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-[#020617] text-white p-6 font-sans">
            {/* Background glow */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-emerald-500/5 rounded-full blur-[100px]" />
            </div>

            <div className="relative max-w-xl mx-auto">
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors">
                    <ArrowLeft size={16} /> Back
                </button>

                {/* Card */}
                <div className="bg-slate-900/60 border border-white/8 rounded-3xl p-8 shadow-2xl backdrop-blur-sm">

                    {/* Header */}
                    <div className="flex items-center gap-4 mb-8">
                        <div className="p-3 bg-indigo-500/15 rounded-2xl text-indigo-400 border border-indigo-500/20">
                            <ShieldCheck size={30} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">Authority Decryption</h1>
                            <p className="text-gray-500 text-xs font-mono mt-0.5">Election · {id}</p>
                        </div>
                    </div>

                    {/* Step Tracker */}
                    <div className="mb-8">
                        {STEPS.map((step, idx) => (
                            <StepRow
                                key={step.id}
                                step={step}
                                state={stepStates[step.id]}
                                errorMsg={stepErrors[step.id]}
                                isLast={idx === STEPS.length - 1}
                            />
                        ))}
                    </div>

                    {/* Global error banner */}
                    <AnimatePresence>
                        {globalError && (
                            <motion.div
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                className="mb-6 flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-300 text-sm"
                            >
                                <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-400" />
                                <span>{globalError}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Bottom CTA */}
                    <AnimatePresence mode="wait">
                        {pageStatus === "submitted" ? (
                            <motion.div
                                key="done"
                                initial={{ opacity: 0, scale: 0.96 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center p-6 bg-emerald-500/10 rounded-2xl border border-emerald-500/20"
                            >
                                <CheckCircle2 size={44} className="text-emerald-400 mx-auto mb-3" />
                                <h2 className="text-lg font-bold text-emerald-300">Share Successfully Submitted</h2>
                                <p className="text-gray-500 text-xs mt-1">Your decryption share has been verified and recorded.</p>
                            </motion.div>

                        ) : pageStatus === "no_tally" ? (
                            <motion.div
                                key="no_tally"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-center p-6 bg-amber-500/10 rounded-2xl border border-amber-500/20"
                            >
                                <Lock size={44} className="text-amber-400 mx-auto mb-3" />
                                <h2 className="text-lg font-bold text-amber-300">Tally Not Ready Yet</h2>
                                <p className="text-gray-500 text-xs mt-1">
                                    The secure tally computation is still running. Please wait a few minutes and refresh.
                                </p>
                            </motion.div>

                        ) : (
                            <motion.button
                                key="btn"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                onClick={executeDecryption}
                                disabled={pageStatus === "computing"}
                                className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 transition-all ${
                                    pageStatus === "computing"
                                        ? "bg-indigo-900/40 text-indigo-400 cursor-not-allowed border border-indigo-500/20"
                                        : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/20 hover:shadow-indigo-500/30"
                                }`}
                            >
                                {pageStatus === "computing" ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        Processing…
                                    </>
                                ) : pageStatus === "error" ? (
                                    <>
                                        <ArrowRight size={20} />
                                        Retry Decryption
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck size={20} />
                                        Calculate &amp; Submit Share
                                    </>
                                )}
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
