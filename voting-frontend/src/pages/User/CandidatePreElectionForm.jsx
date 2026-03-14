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
    UploadCloud,
    CheckCircle2,
    Key,
    Wand2
} from "lucide-react";
import useAuthStore from "../../store/useAuthStore";
import InlineMessage from "../../components/UI/InlineMessage";
import { openDB } from 'idb';

export default function CandidatePreElectionForm() {
    const { election_id } = useParams();
    const navigate = useNavigate();
    const { token, username } = useAuthStore();

    const [formData, setFormData] = useState({
        fullName: "",
        age: "",
        address: "",
        privateKey: ""
    });

    const [symbolBase64, setSymbolBase64] = useState(null);
    const [symbolName, setSymbolName] = useState("");

    const [photoBase64, setPhotoBase64] = useState(null);
    const [photoName, setPhotoName] = useState("");

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

    const handleFileChange = (e, setBase64, setName) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                setError("File size must be less than 2MB.");
                return;
            }
            setName(file.name);
            const reader = new FileReader();
            reader.onloadend = () => {
                setBase64(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (!formData.fullName || !formData.age || !formData.address || !symbolBase64 || !photoBase64 || !formData.privateKey) {
            setError("Please fill out all fields, upload both images, and provide your private key for signing.");
            return;
        }

        setLoading(true);

        try {
            // 1. Construct the core metadata payload
            const rawFormData = {
                username: username,
                fullName: formData.fullName,
                age: formData.age,
                address: formData.address,
                symbolImage: symbolBase64,
                photoImage: photoBase64
            };

            // 2. Sign the payload using the provided Private Key
            let signature = "";
            let expectedAddress = "";
            try {
                // Ensure the private key format is correct (add 0x if missing, although ethers usually handles it)
                const pk = formData.privateKey.startsWith("0x") ? formData.privateKey : "0x" + formData.privateKey;
                const wallet = new ethers.Wallet(pk);
                expectedAddress = wallet.address;

                // We serialize the JSON deterministically or just stringify it
                const messageString = JSON.stringify(rawFormData);
                signature = await wallet.signMessage(messageString);
            } catch (signErr) {
                console.error("Signing Error:", signErr);
                throw new Error("Invalid Private Key provided. Could not generate digital signature.");
            }

            // 3. Send to backend
            const submissionData = {
                election_id,
                user_type: "candidate",
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
                // ... (existing error handling)
                const rawText = await res.text();
                let errMessage = `Server error ${res.status}`;
                if (res.status === 413) {
                    errMessage = "File sizes are too large. Please reduce image sizes (max 2MB each) and try again.";
                } else {
                    try { errMessage = JSON.parse(rawText).message || errMessage; } catch (_) { /* not JSON */ }
                }
                throw new Error(errMessage);
            }

            setSuccess("Your Candidate Registration form has been cryptographically signed and submitted!");
            setIsSubmitted(true);
            setTimeout(() => {
                navigate("/user/dashboard");
            }, 3000);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-6 relative font-sans">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-4xl relative z-10 py-10"
            >
                <button
                    onClick={() => navigate("/user/search-election")}
                    className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-all group px-4 py-2 hover:bg-white/5 rounded-lg w-fit"
                >
                    <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-sm font-medium">Back to Search</span>
                </button>

                <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 p-8 md:p-12 rounded-[3rem] shadow-2xl relative">
                    <div className="absolute -top-10 -left-10 w-40 h-40 bg-gradient-to-br from-emerald-500/20 to-transparent rounded-full blur-2xl pointer-events-none" />

                    <div className="text-center mb-10">
                        <h2 className="text-4xl font-black tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-white">Candidate Registration</h2>
                        <p className="text-gray-400 text-sm font-mono mb-4">Election ID: {election_id}</p>
                        <p className="text-gray-400 text-base leading-relaxed max-w-xl mx-auto">
                            Submit your candidate details. You must sign this transaction cryptographically using your private key.
                        </p>
                    </div>

                    <InlineMessage type="error" message={error} onClose={() => setError(null)} />
                    <InlineMessage type="success" message={success} />

                    <form onSubmit={handleSubmit} className="space-y-6">

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Full Name */}
                            <div className="group">
                                <label className="block text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Candidate Name</label>
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

                            {/* Age */}
                            <div className="group">
                                <label className="block text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Age</label>
                                <div className="relative transform transition-all group-focus-within:scale-[1.01]">
                                    <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-400 transition-colors" size={20} />
                                    <input
                                        type="number"
                                        name="age"
                                        min="18"
                                        max="120"
                                        value={formData.age}
                                        onChange={handleChange}
                                        placeholder="Years"
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-14 pr-4 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-medium text-white focus:text-white placeholder:text-gray-700 text-gray-400"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* Address */}
                            <div className="group">
                                <label className="block text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Physical Address</label>
                                <div className="relative transform transition-all group-focus-within:scale-[1.01]">
                                    <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-400 transition-colors" size={20} />
                                    <input
                                        type="text"
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        placeholder="Your current campaign/residential address"
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-14 pr-4 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all placeholder:text-gray-700 font-medium text-white"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Image Uploads */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                            {/* Party Symbol Upload */}
                            <div className="group">
                                <label className="block text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Party Symbol Image</label>
                                <div className="relative bg-black/40 border border-dashed border-white/20 hover:border-emerald-500/50 rounded-2xl p-6 transition-all text-center flex flex-col items-center justify-center cursor-pointer h-40">
                                    <input
                                        type="file"
                                        accept="image/png, image/jpeg"
                                        onChange={(e) => handleFileChange(e, setSymbolBase64, setSymbolName)}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    {symbolBase64 ? (
                                        <div className="flex flex-col items-center gap-2 text-emerald-400">
                                            <CheckCircle2 size={32} />
                                            <span className="text-sm font-medium">{symbolName}</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 text-gray-500 group-hover:text-emerald-400 transition-colors">
                                            <UploadCloud size={32} />
                                            <span className="text-sm font-medium">Upload Party Symbol</span>
                                            <span className="text-xs opacity-70">PNG, JPG</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Candidate Photo Upload */}
                            <div className="group">
                                <label className="block text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Candidate Photo</label>
                                <div className="relative bg-black/40 border border-dashed border-white/20 hover:border-emerald-500/50 rounded-2xl p-6 transition-all text-center flex flex-col items-center justify-center cursor-pointer h-40">
                                    <input
                                        type="file"
                                        accept="image/png, image/jpeg"
                                        onChange={(e) => handleFileChange(e, setPhotoBase64, setPhotoName)}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    {photoBase64 ? (
                                        <div className="flex flex-col items-center gap-2 text-emerald-400">
                                            <CheckCircle2 size={32} />
                                            <span className="text-sm font-medium">{photoName}</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 text-gray-500 group-hover:text-emerald-400 transition-colors">
                                            <UploadCloud size={32} />
                                            <span className="text-sm font-medium">Upload Candidate Photo</span>
                                            <span className="text-xs opacity-70">PNG, JPG</span>
                                        </div>
                                    )}
                                </div>
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
                            className="w-full mt-8 py-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-lg rounded-2xl shadow-xl shadow-emerald-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">
                            {loading ? <Loader2 className="animate-spin" size={24} /> : isSubmitted ? "Submitted ✓" : "Sign and Submit Application"}
                        </button>
                    </form>

                </div>
            </motion.div>
        </div>
    );
}
