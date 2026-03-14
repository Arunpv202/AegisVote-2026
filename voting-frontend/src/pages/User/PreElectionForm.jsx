import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ethers } from "ethers";
import {
    ArrowLeft,
    User,
    Calendar,
    MapPin,
    Loader2,
    Hash,
    Key,
    Wand2
} from "lucide-react";
import useAuthStore from "../../store/useAuthStore";
import InlineMessage from "../../components/UI/InlineMessage";
import { openDB } from 'idb';

export default function PreElectionForm() {
    const { election_id } = useParams();
    const navigate = useNavigate();
    const { token, username } = useAuthStore();

    const [formData, setFormData] = useState({
        fullName: "",
        dob: "",
        address: "",
        privateKey: ""
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleAutoSign = async () => {
        try {
            const db = await openDB('VoterWalletDB', 1);
            const wallet = await db.get('wallets', username);
            if (wallet && wallet.private_key) {
                setFormData(prev => ({ ...prev, privateKey: wallet.private_key }));
                setSuccess("Private key automatically retrieved from Secure Storage.");
            } else {
                setError("No private key found in local storage. Please enter it manually.");
            }
        } catch (err) {
            console.error("Error accessing IndexedDB:", err);
            setError("Could not access local secure storage. Please enter key manually.");
        }
    };



    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (!formData.fullName || !formData.dob || !formData.address || !formData.privateKey) {
            setError("Please fill out all fields and provide your private key for signing.");
            return;
        }

        setLoading(true);

        try {
            // API call to backend
            // 1. Construct payload
            const rawFormData = {
                username: username,
                fullName: formData.fullName,
                dob: formData.dob,
                address: formData.address
            };

            // 2. Sign the payload using the provided Private Key
            let signature = "";
            try {
                const pk = formData.privateKey.startsWith("0x") ? formData.privateKey : "0x" + formData.privateKey;
                const wallet = new ethers.Wallet(pk);
                const messageString = JSON.stringify(rawFormData);
                signature = await wallet.signMessage(messageString);
            } catch (signErr) {
                console.error("Signing Error:", signErr);
                throw new Error("Invalid Private Key provided. Could not generate digital signature.");
            }

            const submissionData = {
                election_id,
                user_type: "voter",
                form_data: rawFormData,
                signature: signature
            };

            const res = await fetch("/api/pre-election/submit", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(submissionData),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || "Failed to submit form");
            }

            setSuccess("Your registration form has been submitted for review!");
            setIsSubmitted(true);
            setTimeout(() => {
                navigate("/user/dashboard");
            }, 2500);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-6 relative overflow-hidden font-sans">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-2xl relative z-10"
            >
                <button
                    onClick={() => navigate("/user/search-election")}
                    className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-all group px-4 py-2 hover:bg-white/5 rounded-lg w-fit"
                >
                    <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-sm font-medium">Back to Search</span>
                </button>

                <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 p-10 md:p-14 rounded-[3rem] shadow-2xl relative">
                    <div className="absolute -top-10 -left-10 w-40 h-40 bg-gradient-to-br from-emerald-500/20 to-transparent rounded-full blur-2xl pointer-events-none" />

                    <div className="text-center mb-10">
                        <h2 className="text-4xl font-black tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Pre-Election Registration</h2>
                        <p className="text-gray-400 text-sm font-mono mb-4">Election ID: {election_id}</p>
                        <p className="text-gray-400 text-base leading-relaxed max-w-lg mx-auto">
                            Please provide your details below. Authority verification is required before you can participate in the election.
                        </p>
                    </div>

                    <InlineMessage type="error" message={error} onClose={() => setError(null)} />
                    <InlineMessage type="success" message={success} />

                    <form onSubmit={handleSubmit} className="space-y-6 flex flex-col">

                        {/* Full Name */}
                        <div className="group">
                            <label className="block text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Full Name</label>
                            <div className="relative transform transition-all group-focus-within:scale-[1.01]">
                                <User className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-400 transition-colors" size={20} />
                                <input
                                    type="text"
                                    name="fullName"
                                    value={formData.fullName}
                                    onChange={handleChange}
                                    placeholder="Legal Name"
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-14 pr-4 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all placeholder:text-gray-700 font-medium text-white"
                                />
                            </div>
                        </div>

                        {/* Date of Birth */}
                        <div className="group">
                            <label className="block text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Date of Birth</label>
                            <div className="relative transform transition-all group-focus-within:scale-[1.01]">
                                <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-400 transition-colors" size={20} />
                                <input
                                    type="date"
                                    name="dob"
                                    value={formData.dob}
                                    onChange={handleChange}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-14 pr-4 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-medium text-white focus:text-white text-gray-400"
                                />
                            </div>
                        </div>

                        {/* Address */}
                        <div className="group">
                            <label className="block text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Physical Address</label>
                            <div className="relative transform transition-all group-focus-within:scale-[1.01]">
                                <MapPin className="absolute left-5 top-4 text-gray-500 group-focus-within:text-emerald-400 transition-colors" size={20} />
                                <textarea
                                    rows="3"
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange}
                                    placeholder="Your current residential address..."
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-14 pr-4 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all placeholder:text-gray-700 font-medium text-white resize-none"
                                />
                            </div>
                        </div>


                        {/* Digital Signature */}
                        <div className="group pt-6 border-t border-white/5">
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-xs font-bold uppercase tracking-[0.2em] text-emerald-500 ml-1">Cryptography Signature: Private Key</label>
                                <button
                                    type="button"
                                    onClick={handleAutoSign}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/30 transition-all"
                                >
                                    <Wand2 size={14} />
                                    Auto Sign
                                </button>
                            </div>
                            <p className="text-xs text-gray-400 mb-3 ml-1">Your private key is used LOCALLY strictly to sign the form data and is NEVER sent to the server.</p>
                            <div className="relative transform transition-all group-focus-within:scale-[1.01]">
                                <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-400 transition-colors" size={20} />
                                <input
                                    type="password"
                                    name="privateKey"
                                    value={formData.privateKey}
                                    onChange={handleChange}
                                    placeholder="0x..."
                                    className="w-full bg-emerald-900/10 border border-emerald-500/20 rounded-2xl py-4 pl-14 pr-4 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium text-emerald-400 font-mono"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || isSubmitted}
                            className="w-full mt-8 py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg rounded-2xl shadow-xl shadow-emerald-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">
                            {loading ? <Loader2 className="animate-spin" size={24} /> : isSubmitted ? "Submitted ✓" : "Submit Form"}
                        </button>
                    </form>

                </div>
            </motion.div>
        </div>
    );
}
