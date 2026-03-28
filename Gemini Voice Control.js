// ==UserScript==
// @name         Gemini Voice Control (Ver 23.00 - Perfect Reading Filter)
// @namespace    http://tampermonkey.net/
// @version      23.00
// @description  URL、UIテキスト（スプレッドシート等）、引用番号、長すぎる英数字の読み上げ・字幕除外機能を実装。
// @author       AI Assistant
// @match        https://gemini.google.com/*
// @grant        GM_xmlhttpRequest
// @connect      localhost
// ==/UserScript==

(function() {
    'use strict';

    // =====================================================================
    // 1. Trusted Types Policy
    // =====================================================================
    if (window.trustedTypes && window.trustedTypes.createPolicy) {
        if (!window.trustedTypes.defaultPolicy) {
            window.trustedTypes.createPolicy('default', {
                createHTML: (s) => s, createScriptURL: (s) => s, createScript: (s) => s,
            });
        }
    }

    // =====================================================================
    // 2. Class: VoiceSettings
    // =====================================================================
    class VoiceSettings {
        constructor() {
            this.data = {};
            this.bgData = {};
            this.defaultData = {
                baseUrl: "http://localhost:8000/",
                bgColor: '#000032', hotModeDuration: 60, autoSleepTime: 60,
                volume: 1.0, beepVolume: 1.5, speed: 1.1, pitch: 0.1, intonation: 1.5, lipSyncThreshold: 20,
                readChunkLength: 50, speechEndDelay: 1.0, swapEnterKey: false, selectedSpeakerId: 61,
                pipWidth: 336, pipHeight: 600, savedPipWidth: 336, savedPipHeight: 600,
                savedPipLeft: undefined, savedPipTop: undefined, savedChatOffset: 0,
                heartSize: 84, heartSizeRandom: 30, heartPosRandom: 60,
                fontSize_status: 24, fontSize_transcript: 14, fontSize_subtitle: 16,
                icon_transcript: "🗣️",
                micMsg_WAITING: "👂待機中", micMsg_HOTMODE: "🎤受付中", micMsg_MUTED: "🔕停止中",
                speed_IDLE_1: 0.5, speed_IDLE_2: 0.5, speed_BUSY_1: 0.5, speed_BUSY_2: 0.5, speed_BUSY_3: 0.5,
                speed_STOPPED_1: 0.5, speed_STOPPED_2: 0.5, speed_SEARCHING_1: 0.5, speed_SEARCHING_2: 0.5,
                speed_LISTENING_1: 0.5, speed_LISTENING_2: 0.5, speed_BLOCKED_1: 0.5, speed_BLOCKED_2: 0.5,
                wakeWord: "うさぎちゃん", matchMode_wake: "PARTIAL", exitWord: "ありがとう", matchMode_exit: "EXACT",
                sleepWord: "おやすみ", matchMode_sleep: "EXACT", sendWord: "送信して", matchMode_send: "EXACT",
                clearWord: "クリア", matchMode_clear: "EXACT", waitWord: "ちょっと待って", matchMode_wait: "EXACT",
                stopWord: "ストップ", matchMode_stop: "EXACT",
                wakeWordReply: "はい、なんです？", exitReply: "どういたしまして。", sleepReply: "おやすみなさい。",
                clearReply: "入力を取り消しました。", waitReply: "はい、お待ちしています。",
                startupMessage: "システムを起動しました。", finishedThinkingMessage: "お待たせしました！", resumeMessage: "おはようございます。",
                delay_wakeWordReply: 0.0, delay_exitReply: 0.0, delay_sleepReply: 0.0, delay_clearReply: 0.0,
                delay_waitReply: 0.0, delay_startupMessage: 0.0, delay_finishedThinkingMessage: 0.0, delay_resumeMessage: 0.0,
                reactionSpeechSurprised_1: "びっくりした！", reactionSpeechSurprised_2: "", reactionSpeechSurprised_3: "",
                reactionSpeechSad_1: "しゅん……", reactionSpeechSad_2: "", reactionSpeechSad_3: "",
                reactionSpeechAngry_1: "もーっ！", reactionSpeechAngry_2: "", reactionSpeechAngry_3: "",
                reactionDuration: 2.0,
                style_wakeWordReply: "default", style_exitReply: "default", style_sleepReply: "default",
                style_clearReply: "default", style_waitReply: "default", style_startupMessage: "default",
                style_finishedThinkingMessage: "default", style_resumeMessage: "default",
                style_reactionSpeechSurprised: "default", style_reactionSpeechSad: "default", style_reactionSpeechAngry: "default",
                txt_IDLE: "待機中", txt_BUSY: "思考中...", txt_STOPPED: "停止中",
                txt_SEARCHING: "確認中...", txt_LISTENING: "聞き取り中", txt_BLOCKED: "困惑中",
                txt_HOTMODE: "受付中", txt_SPEAKING: "発話中",
                icon_IDLE: "🐰", icon_BUSY: "🔄", icon_STOPPED: "💤", icon_SEARCHING: "📡",
                icon_LISTENING: "👂", icon_BLOCKED: "😰", icon_HOTMODE: "🔥", icon_SPEAKING: "🎵"
            };
        }

        init() {
            const defaultBgMap = {
                'IDLE_1': '1idle1.png', 'IDLE_2': '1idle2.png', 'BUSY_1': '2busy1.png', 'BUSY_2': '2busy2.png', 'BUSY_3': '2busy3.png',
                'SPEAKING_1': '3speak1.png', 'SPEAKING_2': '3speak2.png', 'STOPPED_1': '4stop1.png', 'STOPPED_2': '4stop2.png',
                'SEARCHING_1': '5search1.png', 'SEARCHING_2': '5search2.png', 'LISTENING_1': '6lis1.png', 'LISTENING_2': '6lis2.png',
                'BLOCKED_1': '7block1.png', 'BLOCKED_2': '7block2.png', 'REACTION_SURPRISED_1': 'R11.png', 'REACTION_SURPRISED_2': 'R12.png',
                'REACTION_SURPRISED_3': 'R13.png', 'REACTION_SAD_1': 'R21.png', 'REACTION_SAD_2': 'R22.png', 'REACTION_SAD_3': 'R23.png',
                'REACTION_ANGRY_1': 'R31.png', 'REACTION_ANGRY_2': 'R32.png', 'REACTION_ANGRY_3': 'R33.png',
                'REACTION_WAKEUP_1': 'R41.png', 'REACTION_WAKEUP_2': 'R42.png', 'REACTION_WAKEUP_3': 'R43.png'
            };
            let saved = {};
            try { saved = JSON.parse(localStorage.getItem('gemini_voice_settings')) || {}; } catch (e) {}
            this.data = { ...this.defaultData, ...saved };
            Object.keys(defaultBgMap).forEach(key => {
                const savedUrl = localStorage.getItem(`gemini_voice_bg_${key.toLowerCase()}`);
                this.bgData[key] = savedUrl || defaultBgMap[key];
            });
        }
        save() { try { localStorage.setItem('gemini_voice_settings', JSON.stringify(this.data)); } catch(e) {} }
        saveBg(key, url) { this.bgData[key] = url; try { localStorage.setItem(`gemini_voice_bg_${key.toLowerCase()}`, url); } catch(e) {} }
    }

    // =====================================================================
    // 3. Class: VoiceState
    // =====================================================================
    class VoiceState {
        constructor() {
            this.current = "IDLE"; this.isSpeaking = false; this.isRecognizing = false; this.isGenerating = false;
            this.isTestingImages = false; this.generatingTextLength = 0; this.autoRestart = false;
            this.hotModeTimeLeft = 0; this.autoSleepTimeLeft = 180; this.animStep = 0;
            this.activeReaction = null; this.activeReactionIndex = 1; this.reactionTimer = null;
            this.animTimeout = null; this.lastAnimStateKey = null; this.currentFrameSpeed = 0.5;
            this.isSystemReady = false; this.spokenSignatures = new Set(); this.lipSyncInterval = null;
        }
    }

    // =====================================================================
    // 4. Class: VoiceAudio
    // =====================================================================
    class VoiceAudio {
        constructor(app) {
            this.app = app; this.ctx = null; this.analyser = null; this.micAnalyser = null;
            this.micStream = null; this.typingInterval = null;
        }
        initCtx() {
            if (!this.ctx || this.ctx.state === 'closed') {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
                this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = 256; this.analyser.connect(this.ctx.destination);
            }
            if (this.ctx.state === 'suspended') this.ctx.resume();
            return this.ctx;
        }
        async setupMic() {
            try {
                this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                const ctx = this.initCtx(); const source = ctx.createMediaStreamSource(this.micStream);
                this.micAnalyser = ctx.createAnalyser(); this.micAnalyser.fftSize = 256; source.connect(this.micAnalyser);
                this.app.ui.startMicVisualizer();
            } catch (e) {}
        }
        stopMic() { if (this.micStream) { this.micStream.getTracks().forEach(t => t.stop()); this.micStream = null; this.micAnalyser = null; } }
        playOscillator(type, freq, vol, duration, ramp = true) {
            const ctx = this.initCtx(); if(ctx.state === 'suspended') return;
            const osc = ctx.createOscillator(); const gain = ctx.createGain(); const filter = ctx.createBiquadFilter();
            osc.type = type; filter.type = 'bandpass'; filter.frequency.value = freq;
            gain.gain.setValueAtTime(vol, ctx.currentTime);
            if (ramp) gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
            else gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + duration);
            osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
            osc.start(); osc.stop(ctx.currentTime + duration);
        }
        playTypingTick(isHeavy = false) {
            this.playOscillator(isHeavy ? 'sawtooth' : 'square', isHeavy ? (1200 + Math.random() * 600) : (800 + Math.random() * 400), this.app.settings.data.beepVolume * (isHeavy ? 0.030 : 0.025), isHeavy ? 0.03 : 0.05);
        }
        startTypingSound() {
            if (!this.typingInterval) this.typingInterval = setInterval(() => {
                if (this.app.state.isGenerating && Math.random() < (this.app.state.generatingTextLength > 300 ? 0.6 : 0.3)) this.playTypingTick(this.app.state.generatingTextLength > 300);
            }, 80);
        }
        stopTypingSound() { clearInterval(this.typingInterval); this.typingInterval = null; }
        playBeep() {
            const playTone = (f, s, d) => {
                const ctx = this.initCtx(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f, s);
                g.gain.setValueAtTime(this.app.settings.data.beepVolume * 0.2, s); g.gain.exponentialRampToValueAtTime(0.01, s + d);
                o.connect(g); g.connect(ctx.destination); o.start(s); o.stop(s + d);
            };
            const ctx = this.initCtx(); playTone(880, ctx.currentTime, 0.1); playTone(1046, ctx.currentTime + 0.1, 0.1);
        }
        playTapSound() {
            const ctx = this.initCtx(); if(ctx.state === 'suspended') return;
            const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'sine';
            osc.frequency.setValueAtTime(600, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(this.app.settings.data.beepVolume * 0.3, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
            osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.15);
        }
        playAppendTick() {
            const ctx = this.initCtx(); if(ctx.state === 'suspended') return;
            const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'sine';
            osc.frequency.setValueAtTime(2500, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(1500, ctx.currentTime + 0.05);
            gain.gain.setValueAtTime(this.app.settings.data.beepVolume * 0.08, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
            osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.05);
        }
    }

    // =====================================================================
    // 5. Class: VoiceTTS
    // =====================================================================
    class VoiceTTS {
        constructor(app) { this.app = app; this.queue = []; this.currentSource = null; this.audioCache = {}; this.isProcessing = false; }
        cleanText(text) { return text ? text.replace(/\*?\]/gi, "").replace(/[#*`_~>|\-「」『』（）()【】\[\]"']/g, "").trim() : ""; }
        getParamsForKey(key) {
            const sd = this.app.settings.data; let p = sd.pitch, s = sd.speed, i = sd.intonation, sid = sd.selectedSpeakerId, d = 0;
            if (key) {
                if (sd[`pitch_${key}`] !== undefined) p = parseFloat(sd[`pitch_${key}`]);
                if (sd[`speed_${key}`] !== undefined) s = parseFloat(sd[`speed_${key}`]);
                if (sd[`intonation_${key}`] !== undefined) i = parseFloat(sd[`intonation_${key}`]);
                if (sd[`style_${key}`] && sd[`style_${key}`] !== "default") sid = parseInt(sd[`style_${key}`], 10);
                if (sd[`delay_${key}`] !== undefined) d = parseFloat(sd[`delay_${key}`]);
            }
            return { pitch: p, speed: s, intonation: i, sid: sid, delay: d };
        }
        async preloadCache() {
            const sd = this.app.settings.data;
            const targets = [
                { key: "wakeWordReply", text: sd.wakeWordReply }, { key: "startupMessage", text: sd.startupMessage },
                { key: "finishedThinkingMessage", text: sd.finishedThinkingMessage }, { key: "resumeMessage", text: sd.resumeMessage },
                { key: "exitReply", text: sd.exitReply }, { key: "sleepReply", text: sd.sleepReply },
                { key: "clearReply", text: sd.clearReply }, { key: "waitReply", text: sd.waitReply }
            ];
            ["reactionSpeechSurprised", "reactionSpeechSad", "reactionSpeechAngry"].forEach(baseKey => {
                for(let j=1; j<=3; j++) { if (sd[`${baseKey}_${j}`]) targets.push({ key: baseKey, text: sd[`${baseKey}_${j}`] }); }
            });
            for (let item of targets) {
                const t = this.cleanText(item.text); if (t.length < 2) continue;
                const params = this.getParamsForKey(item.key); const cacheKey = `${t}_${params.pitch}_${params.sid}_${params.speed}_${params.intonation}`;
                if (!this.audioCache[cacheKey]) { try { this.audioCache[cacheKey] = await this.generateAudioBuffer(t, params); } catch(e) {} }
            }
        }
        clearCache() { this.audioCache = {}; if (this.app.audio.ctx) this.preloadCache(); }
        async generateAudioBuffer(text, params) {
            const ctx = this.app.audio.initCtx();
            const queryRes = await new Promise((res, rej) => {
                GM_xmlhttpRequest({
                    method: "POST", url: `http://localhost:50021/audio_query?speaker=${params.sid}&text=${encodeURIComponent(text)}`,
                    onload: (r) => {
                        let d = JSON.parse(r.responseText);
                        d.volumeScale = this.app.settings.data.volume; d.speedScale = params.speed;
                        d.pitchScale = params.pitch; d.intonationScale = params.intonation;
                        d.prePhonemeLength = 0; d.postPhonemeLength = 0; res(d);
                    }, onerror: () => rej()
                });
            });
            const audioData = await new Promise((res) => {
                GM_xmlhttpRequest({
                    method: "POST", url: `http://localhost:50021/synthesis?speaker=${params.sid}`,
                    data: JSON.stringify(queryRes), responseType: 'arraybuffer', headers: { "Content-Type": "application/json" },
                    onload: (r) => res(r.response)
                });
            });
            return await ctx.decodeAudioData(audioData);
        }
        enqueue(text, configKey = null) {
            const t = this.cleanText(text); if (t.length < 1) return;
            this.queue.push({ text: t, params: this.getParamsForKey(configKey) }); this.processQueue();
        }
        async playInstantly(text, configKey = null) {
            const t = this.cleanText(text); if (t.length < 1) return;
            const params = this.getParamsForKey(configKey); const cacheKey = `${t}_${params.pitch}_${params.sid}_${params.speed}_${params.intonation}`;
            try {
                const ctx = this.app.audio.initCtx(); let buffer = this.audioCache[cacheKey];
                if (!buffer) { buffer = await this.generateAudioBuffer(t, params); this.audioCache[cacheKey] = buffer; }
                const source = ctx.createBufferSource(); source.buffer = buffer; source.connect(this.app.audio.analyser); source.start(0);
            } catch (e) {}
        }
        async processQueue() {
            if (this.currentSource || this.isProcessing) return;
            if (this.queue.length === 0) {
                if (this.app.state.isSpeaking) {
                    this.app.state.isSpeaking = false; this.app.ui.hideSubtitleDelayed();
                    this.app.speech.activateHotMode(); this.app.ui.sync();
                }
                return;
            }
            this.isProcessing = true; this.app.state.isSpeaking = true; this.app.ui.sync();
            const item = this.queue.shift(); const cacheKey = `${item.text}_${item.params.pitch}_${item.params.sid}_${item.params.speed}_${item.params.intonation}`;
            if (this.app.speech.recognition && this.app.state.isRecognizing) { try { this.app.speech.recognition.stop(); } catch(e){} }
            const delayMs = (item.params.delay || 0) * 1000;
            if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs));

            this.app.ui.showSubtitle(item.text);
            try {
                const ctx = this.app.audio.initCtx(); let buffer = this.audioCache[cacheKey];
                if (!buffer) { buffer = await this.generateAudioBuffer(item.text, item.params); this.audioCache[cacheKey] = buffer; }
                const source = ctx.createBufferSource(); this.currentSource = source; source.buffer = buffer; source.connect(this.app.audio.analyser);
                source.onended = () => { this.currentSource = null; this.processQueue(); };
                this.isProcessing = false; source.start(0);
            } catch (e) { this.currentSource = null; this.isProcessing = false; this.processQueue(); }
        }
        stop() {
            this.queue = []; this.isProcessing = false;
            if (this.currentSource) { try { this.currentSource.stop(); } catch(e){} }
            this.currentSource = null;
            if (this.app.state.isSpeaking) { this.app.state.isSpeaking = false; this.app.ui.sync(); }
            this.app.ui.hideSubtitleInstantly(); this.app.speech.activateHotMode();
        }
    }

    // =====================================================================
    // 6. Class: VoiceSpeech
    // =====================================================================
    class VoiceSpeech {
        constructor(app) {
            this.app = app; this.recognition = null; this.visualTimer = null;
            this.speechBuffer = ""; this.speechTimeout = null; this.shouldSendBuffer = false; this.wasWakeWordUsed = false;
        }
        init() {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) return;
            this.recognition = new SpeechRecognition(); this.recognition.lang = 'ja-JP'; this.recognition.interimResults = true; this.recognition.continuous = false;
            this.recognition.onstart = () => { this.app.state.isRecognizing = true; this.app.ui.sync(); };
            this.recognition.onerror = () => { this.app.state.isRecognizing = false; };
            this.recognition.onend = () => { this.app.state.isRecognizing = false; this.app.ui.sync(); };

            this.recognition.onresult = (event) => {
                const state = this.app.state; const sd = this.app.settings.data;
                const checkMatch = (transcript, word, mode) => {
                    if (!word || word.trim() === "") return { isMatch: false, cleanText: transcript };
                    const w = word.trim();
                    if (mode === "EXACT") return { isMatch: transcript === w, cleanText: transcript === w ? "" : transcript };
                    const isMatch = transcript.includes(w); return { isMatch, cleanText: isMatch ? transcript.replace(w, "").trim() : transcript };
                };
                let interim = "", final = "";
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) final += event.results[i][0].transcript;
                    else interim += event.results[i][0].transcript;
                }

                if (state.isSpeaking || state.current === "BUSY" || state.isGenerating) {
                    if (final.trim()) {
                        const mStop = checkMatch(final.trim(), sd.stopWord, sd.matchMode_stop);
                        if (mStop.isMatch && sd.stopWord) {
                            this.app.tts.stop();
                            const responses = document.querySelectorAll('.model-response-text');
                            if (responses.length > 0) responses[responses.length - 1].dataset.readLength = "999999";
                            this.app.audio.playBeep(); this.app.ui.sync();
                        }
                    }
                    return;
                }

                const displayTxt = final || interim;
                if (this.app.ui.elements.transcriptText && displayTxt.trim() !== "") {
                    this.app.ui.elements.transcriptText.textContent = `${sd.icon_transcript || "🗣️"} ` + displayTxt;
                    this.app.ui.elements.transcriptText.style.textShadow = this.app.ui.getSharpDoubleOutline('#444444');
                }

                if (final) {
                    if (this.app.ui.transcriptClearTimer) clearTimeout(this.app.ui.transcriptClearTimer);
                    this.app.ui.transcriptClearTimer = setTimeout(() => { if (this.app.ui.elements.transcriptText) this.app.ui.elements.transcriptText.textContent = ""; }, 5000);

                    let t = final.trim();
                    if (checkMatch(t, sd.sleepWord, sd.matchMode_sleep).isMatch) {
                        if (sd.sleepReply) this.app.tts.enqueue(sd.sleepReply, "sleepReply");
                        state.hotModeTimeLeft = 0; state.autoRestart = false; if (this.visualTimer) clearInterval(this.visualTimer);
                        this.app.ui.sync(); return;
                    }
                    if (checkMatch(t, sd.exitWord, sd.matchMode_exit).isMatch) {
                        if (sd.exitReply) this.app.tts.enqueue(sd.exitReply, "exitReply");
                        state.hotModeTimeLeft = 0; if (this.visualTimer) clearInterval(this.visualTimer);
                        this.app.ui.sync(); return;
                    }
                    if (checkMatch(t, sd.clearWord, sd.matchMode_clear).isMatch) {
                        if(this.app.ui.elements.fakeChatInput) this.app.ui.elements.fakeChatInput.value = "";
                        this.speechBuffer = ""; if (sd.clearReply) this.app.tts.enqueue(sd.clearReply, "clearReply");
                        this.activateHotMode(); return;
                    }
                    if (checkMatch(t, sd.waitWord, sd.matchMode_wait).isMatch) {
                        this.activateHotMode(); if (sd.waitReply) this.app.tts.enqueue(sd.waitReply, "waitReply");
                        return;
                    }

                    let cleanCmd = t; const mWake = checkMatch(cleanCmd, sd.wakeWord, sd.matchMode_wake);
                    if (mWake.isMatch) { this.wasWakeWordUsed = true; cleanCmd = mWake.cleanText; }
                    const mSend = checkMatch(cleanCmd, sd.sendWord, sd.matchMode_send);
                    if (mSend.isMatch && sd.sendWord.trim() !== "") { this.shouldSendBuffer = true; cleanCmd = mSend.cleanText; }

                    this.speechBuffer += cleanCmd;
                    if (this.speechTimeout) clearTimeout(this.speechTimeout);
                    if (this.shouldSendBuffer || (!sd.sendWord && sd.speechEndDelay === 0)) this.flushSpeechBuffer();
                    else this.speechTimeout = setTimeout(() => { this.flushSpeechBuffer(); }, (sd.speechEndDelay || 0) * 1000);
                }
            };
        }
        flushSpeechBuffer() {
            const text = this.speechBuffer.trim(); const send = this.shouldSendBuffer || (!this.app.settings.data.sendWord);
            if (this.wasWakeWordUsed || this.app.state.hotModeTimeLeft > 0) {
                this.activateHotMode(); this.app.state.autoSleepTimeLeft = this.app.settings.data.autoSleepTime;
                if (text.length > 0 || send) this.handleRecognizedText(text, send);
                else if (this.wasWakeWordUsed && this.app.settings.data.wakeWordReply) this.app.tts.enqueue(this.app.settings.data.wakeWordReply, "wakeWordReply");
            }
            this.speechBuffer = ""; this.shouldSendBuffer = false; this.wasWakeWordUsed = false;
        }
        activateHotMode() {
            this.app.state.hotModeTimeLeft = this.app.settings.data.hotModeDuration; this.app.ui.sync();
            if (this.visualTimer) clearInterval(this.visualTimer);
            this.visualTimer = setInterval(() => {
                if (this.app.state.hotModeTimeLeft > 0) { this.app.state.hotModeTimeLeft--; this.app.ui.sync(); }
                else { clearInterval(this.visualTimer); this.app.ui.sync(); }
            }, 1000);
        }
        handleRecognizedText(text, shouldSend) {
            const fakeInput = this.app.ui.elements.fakeChatInput; if (!fakeInput) return;
            if (text.length > 0) fakeInput.value += (fakeInput.value.length > 0 ? " " : "") + text;
            if (shouldSend) {
                const finalTxt = fakeInput.value.trim();
                if (finalTxt.length > 0) {
                    const inputElem = document.querySelector('.input-area div[contenteditable="true"], rich-textarea > div');
                    if (inputElem) {
                        inputElem.focus(); document.execCommand('selectAll', false, null); document.execCommand('delete', false, null);
                        document.execCommand('insertText', false, finalTxt);
                        document.querySelectorAll('.model-response-text').forEach(el => {
                            el.setAttribute('data-spoken', 'true'); el.dataset.readLength = el.textContent.length.toString();
                            const cleanTxt = this.app.observer.getCleanTextFast(el);
                            if(cleanTxt) this.app.state.spokenSignatures.add(this.app.observer.getSignature(cleanTxt));
                        });
                        setTimeout(() => {
                            const sendBtn = document.querySelector('button[aria-label*="送信"], .send-button, [purpose="r-send-button"]');
                            if (sendBtn) sendBtn.click();
                            fakeInput.value = "";
                        }, 500);
                    }
                } else fakeInput.value = "";
            } else if (text.length > 0) {
                this.app.audio.playAppendTick(); fakeInput.scrollTop = fakeInput.scrollHeight;
            }
        }
    }

    // =====================================================================
    // 7. Class: VoiceImageCache (Blob Generator)
    // =====================================================================
    class VoiceImageCache {
        constructor(app) { this.app = app; this.blobs = {}; this.images = {}; this.preloaderDiv = null; }
        initPreloader() {
            if(!this.preloaderDiv) {
                this.preloaderDiv = document.createElement('div');
                this.preloaderDiv.style.cssText = "position:absolute; width:0; height:0; overflow:hidden; opacity:0; pointer-events:none; z-index:-1;";
                document.body.appendChild(this.preloaderDiv);
            }
        }
        async loadSingle(url, forceReload = false) {
            this.initPreloader();
            if (!url || url.trim() === "" || url.startsWith("data:") || url.startsWith("blob:")) return url;
            if (!forceReload && this.blobs[url]) return this.blobs[url];
            return new Promise(resolve => {
                const fetchUrl = forceReload ? (url + (url.includes('?') ? '&' : '?') + 't=' + Date.now()) : url;
                GM_xmlhttpRequest({
                    method: "GET", url: fetchUrl, responseType: "blob", headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
                    onload: (r) => {
                        if (r.status === 200) {
                            const oldUrl = this.blobs[url]; const oldImg = this.images[url];
                            const bUrl = URL.createObjectURL(r.response); const img = new Image();
                            img.onload = () => {
                                this.blobs[url] = bUrl; this.images[url] = img; this.preloaderDiv.appendChild(img);
                                if (oldUrl && forceReload) { URL.revokeObjectURL(oldUrl); if (oldImg && oldImg.parentNode) oldImg.remove(); }
                                resolve(bUrl);
                            };
                            img.onerror = () => { this.blobs[url] = bUrl; resolve(bUrl); };
                            img.src = bUrl;
                        } else resolve(url);
                    }, onerror: () => resolve(url)
                });
            });
        }
        async preloadAll(forceReload = false) {
            const urls = new Set(); const bgData = this.app.settings.bgData;
            for (let key in bgData) if (bgData[key] && bgData[key].trim() !== "") urls.add(this.app.ui.getFullImageUrl(bgData[key]));
            await Promise.all(Array.from(urls).map(url => this.loadSingle(url, forceReload)));
        }
    }

    // =====================================================================
    // 8. Class: VoiceUI (Refactored Core DOM Builder)
    // =====================================================================
    class VoiceUI {
        constructor(app) {
            this.app = app; this.elements = {}; this.shadowCache = {}; this.sleepTimer = null;
            this.baseFont = '"UD デジタル 教科書体 NK", "UD Digital Kyokasho-tai NK", sans-serif';
            this.transcriptClearTimer = null; this.isSlidingChat = false; this.subtitleTimer = null;
            this.isResizing = false; this.resizeDir = '';
        }

        ce(tag, style = {}, props = {}, ...children) {
            const el = document.createElement(tag);
            for (let k in style) el.style[k] = style[k];
            for (let k in props) {
                if (k.startsWith('on') && typeof props[k] === 'function') el[k.toLowerCase()] = props[k];
                else el[k] = props[k];
            }
            children.flat().forEach(c => {
                if (c != null) el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
            });
            return el;
        }

        getFullImageUrl(url) {
            if (!url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) return url;
            const baseUrl = this.app.settings.data.baseUrl || "http://localhost:8000/";
            return (baseUrl.endsWith('/') ? baseUrl : baseUrl + '/') + (url.startsWith('/') ? url.substring(1) : url);
        }

        getSharpDoubleOutline(c) {
            if(this.shadowCache[c]) return this.shadowCache[c];
            const w = '#ffffff';
            this.shadowCache[c] = `2px 0 0 ${w}, -2px 0 0 ${w}, 0 2px 0 ${w}, 0 -2px 0 ${w}, 2px 2px 0 ${w}, -2px -2px 0 ${w}, 2px -2px 0 ${w}, -2px 2px 0 ${w}, 4px 0 0 ${c}, -4px 0 0 ${c}, 0 4px 0 ${c}, 0 -4px 0 ${c}, 4px 4px 0 ${c}, -4px -4px 0 ${c}, 4px -4px 0 ${c}, -4px 4px 0 ${c}, 4px 2px 0 ${c}, -4px 2px 0 ${c}, 4px -2px 0 ${c}, -4px -2px 0 ${c}, 2px 4px 0 ${c}, -2px 4px 0 ${c}, 2px -4px 0 ${c}, -2px -4px 0 ${c}`;
            return this.shadowCache[c];
        }

        enforceBounds() {
            if (!this.elements.panel || this.elements.panel.style.display === 'none') return;
            const p = this.elements.panel;
            p.style.right = 'auto'; p.style.bottom = 'auto';
            p.style.left = Math.max(0, Math.min(p.offsetLeft, window.innerWidth - p.offsetWidth)) + 'px';
            p.style.top = Math.max(0, Math.min(p.offsetTop, window.innerHeight - p.offsetHeight)) + 'px';
        }

        showSubtitle(text) {
            if (!this.elements.subtitleContainer) return;
            if (this.subtitleTimer) { clearTimeout(this.subtitleTimer); this.subtitleTimer = null; }
            this.elements.subtitleContainer.textContent = text;
        }

        hideSubtitleDelayed() {
            if (!this.elements.subtitleContainer) return;
            if (this.subtitleTimer) clearTimeout(this.subtitleTimer);
            this.subtitleTimer = setTimeout(() => { if (this.elements.subtitleContainer) this.elements.subtitleContainer.textContent = ""; }, 3000);
        }

        hideSubtitleInstantly() {
            if (!this.elements.subtitleContainer) return;
            if (this.subtitleTimer) clearTimeout(this.subtitleTimer);
            this.elements.subtitleContainer.textContent = "";
        }

        build() {
            const sd = this.app.settings.data;
            const customStyles = this.ce('style', {}, {}, `
                @keyframes spinGlobe { 0% { transform: perspective(150px) rotateX(20deg) rotateY(0deg); } 100% { transform: perspective(150px) rotateX(20deg) rotateY(360deg); } }
                @keyframes floatHeartSway { 0% { transform: translate(-50%, -50%) scale(0.5) rotate(0deg); opacity: 1; } 33% { transform: translate(calc(-50% - 20px), -60px) scale(1.0) rotate(-15deg); opacity: 0.9; } 66% { transform: translate(calc(-50% + 20px), -120px) scale(1.3) rotate(15deg); opacity: 0.6; } 100% { transform: translate(-50%, -200px) scale(1.5) rotate(0deg); opacity: 0; } }
                .icon-spin { display: inline-block; animation: spinGlobe 1.5s linear infinite; }
                .heart-effect { position: fixed; color: #ff66cc; pointer-events: none; z-index: 2147483647; animation: floatHeartSway 1.2s ease-out forwards; text-shadow: 2px 2px 4px #fff, -2px -2px 4px #fff, 2px -2px 4px #fff, -2px 2px 4px #fff; }
                .setting-group { border: 1px solid #444; padding: 10px; border-radius: 8px; margin-bottom: 12px; background: #1a1a1a; }
                .setting-group-title { font-weight: bold; margin-bottom: 8px; color: #ffccff; font-size: 13px; border-bottom: 1px solid #444; padding-bottom: 4px; }
                .setting-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 12px;}
                .setting-input { width: 100%; background: #333; color: #fff; border: 1px solid #555; margin-bottom: 4px; padding: 5px; box-sizing: border-box; font-size: 11px; border-radius: 4px; }
                .test-btn { background-color: #444; color: #fff; border: 1px solid #666; border-radius: 4px; cursor: pointer; padding: 2px 8px; font-size: 10px; transition: background 0.2s; }
                .test-btn:hover { background-color: #666; }
                .style-select { background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; font-size: 10px; padding: 2px; }
                .voice-slider-container { display: flex; gap: 5px; margin-top: 2px; flex-wrap: wrap; }
                .voice-slider-item { display: flex; flex-direction: column; width: 24%; font-size: 9px; color: #ccc; }
                .voice-slider-item input { width: 100%; margin: 0; }
                .voice-slider-header { display: flex; justify-content: space-between; }
                hr { border-color: #444; margin: 10px 0; }
                .subtitle-bubble::before { content: ""; position: absolute; bottom: -28px; left: 60px; border-width: 28px 20px 0; border-style: solid; border-color: #333 transparent transparent transparent; display: block; width: 0; }
                .subtitle-bubble::after { content: ""; position: absolute; bottom: -23px; left: 64px; border-width: 24px 16px 0; border-style: solid; border-color: #f8c8c9 transparent transparent transparent; display: block; width: 0; }
            `);
            document.head.appendChild(customStyles);

            const ce = this.ce.bind(this);
            const panel = ce('div', {
                position: 'fixed', width: `${sd.savedPipWidth || 336}px`, height: `${sd.savedPipHeight || 600}px`,
                backgroundColor: sd.bgColor, zIndex: '2147483647', display: 'flex', flexDirection: 'column',
                borderRadius: '8px', overflow: 'hidden', border: '2px solid #333',
                ...(sd.savedPipLeft !== undefined ? {left: `${sd.savedPipLeft}px`, top: `${sd.savedPipTop}px`} : {bottom: '20px', right: '20px'})
            });

            this.elements.dragHeader = ce('div', { width: '100%', height: '24px', background: '#111', cursor: 'grab', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#aaa', fontSize: '11px', fontWeight: 'bold', flexShrink: '0', userSelect: 'none', borderBottom: '1px solid #333' }, {}, "≡ 埋め込み実況システム ≡");

            ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'].forEach(dir => {
                const grip = ce('div', { position: 'absolute', zIndex: '101', background: 'transparent', cursor: `${dir}-resize` });
                const thickness = '10px';
                if (dir.includes('n')) { grip.style.top = '0'; grip.style.height = thickness; }
                if (dir.includes('s')) { grip.style.bottom = '0'; grip.style.height = thickness; }
                if (dir.includes('e')) { grip.style.right = '0'; grip.style.width = thickness; }
                if (dir.includes('w')) { grip.style.left = '0'; grip.style.width = thickness; }
                
                if (dir === 'n' || dir === 's') { grip.style.left = thickness; grip.style.right = thickness; }
                else if (dir === 'e' || dir === 'w') { grip.style.top = thickness; grip.style.bottom = thickness; }
                else { grip.style.width = thickness; grip.style.height = thickness; }

                grip.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    this.isResizing = true;
                    this.resizeDir = dir;
                    this.resizeStartX = e.clientX;
                    this.resizeStartY = e.clientY;
                    const rect = panel.getBoundingClientRect();
                    this.resizeStartWidth = rect.width;
                    this.resizeStartHeight = rect.height;
                    this.resizeStartLeft = rect.left;
                    this.resizeStartTop = rect.top;
                    panel.style.right = 'auto'; panel.style.bottom = 'auto';
                    panel.style.left = this.resizeStartLeft + 'px';
                    panel.style.top = this.resizeStartTop + 'px';
                    document.body.style.cursor = `${dir}-resize`;
                });
                panel.appendChild(grip);
            });

            this.elements.sleepBarFill = ce('div', { width: '100%', height: '100%', background: '#00ccff', transition: 'width 1s linear, background-color 0.3s' });
            this.elements.hotBarFill = ce('div', { width: '0%', height: '100%', background: '#ff4444', transition: 'width 1s linear' });

            this.elements.micStatusContainer = ce('div', { fontSize: `${sd.fontSize_status}px`, fontWeight: 'bold', color: '#000000', fontFamily: this.baseFont, lineHeight: '1', display: 'flex', alignItems: 'center' });
            this.elements.systemIcon = ce('div', { fontSize: `${sd.fontSize_status}px`, color: '#000000', willChange: 'transform' }, { className: "icon-spin" });
            this.elements.statusTextValue = ce('div', { fontSize: `${sd.fontSize_status}px`, fontWeight: 'bold', color: '#000000', fontFamily: this.baseFont, lineHeight: '1' });
            
            const statusRightWrap = ce('div', { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' }, {},
                this.elements.systemIcon,
                this.elements.statusTextValue
            );

            const statusRow = ce('div', { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }, {},
                this.elements.micStatusContainer,
                statusRightWrap
            );

            this.elements.transcriptText = ce('div', { fontSize: `${sd.fontSize_transcript}px`, fontWeight: 'bold', color: '#000000', fontFamily: this.baseFont, lineHeight: '1.2', minHeight: '1.2em' });

            this.elements.subtitleContainer = ce('div', { position: 'absolute', top: '47px', left: '15px', right: '15px', backgroundImage: 'linear-gradient(to bottom, #fdf7ff, #f8c8c9)', color: '#000000', borderRadius: '8px', padding: '8px 12px', fontSize: `${sd.fontSize_subtitle || 16}px`, fontWeight: 'bold', fontFamily: this.baseFont, zIndex: '25', pointerEvents: 'none', display: 'block', border: '2px solid #333', wordBreak: 'break-word', lineHeight: '1.4', minHeight: '1.4em' }, { className: 'subtitle-bubble' });
            this.elements.displayArea = ce('div', { width: '100%', flexGrow: '1', backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center bottom', backgroundColor: 'transparent', transform: 'translateZ(0)', willChange: 'background-image' });
            this.elements.fakeChatInput = ce('textarea', { width: '100%', height: '40px', backgroundColor: 'rgba(0, 0, 0, 0.7)', color: '#ffffff', border: 'none', borderTop: '1px solid #555', padding: '5px 8px', fontSize: '12px', fontFamily: this.baseFont, resize: 'none', boxSizing: 'border-box', outline: 'none', flexShrink: '0', zIndex: '50' }, { placeholder: "音声認識バッファ..." });

            this.elements.micVizCanvas = ce('canvas', { width: '8px', height: '100%', background: '#222', borderLeft: '1px solid #444', flexShrink: '0', transform: 'translateZ(0)' }, { width: 8, height: 600 });

            const btnStyle = { width: '46px', height: '46px', border: '2px solid rgb(50, 50, 50)', borderRadius: '8px', background: '#000000', color: '#fff', cursor: 'pointer', fontSize: '24px', fontWeight: 'bold', padding: '0', fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif', textShadow: 'none' };

            this.elements.btnReload = ce('button', btnStyle, { title: "画像リロード" }, "🔃");
            this.elements.btnSlider = ce('button', { ...btnStyle, cursor: 'ew-resize' }, { title: "チャット移動" }, "🎚️");
            this.elements.btn1 = ce('button', btnStyle, { title: "基本設定" }, "⚙");
            this.elements.btn2 = ce('button', btnStyle, { title: "会話設定" }, "🗣");
            this.elements.btn3 = ce('button', btnStyle, { title: "立ち絵" }, "👤");
            this.elements.btn4 = ce('button', btnStyle, { title: "リアクション" }, "🫂");
            this.elements.btn5 = ce('button', btnStyle, { title: "表示設定" }, "🪧");

            this.elements.btnPower = ce('button', { ...btnStyle, fontSize: '30px', marginTop: 'auto' }, { title: "システム電源" }, "⏻");
            this.elements.btnMinimize = ce('button', { ...btnStyle, fontSize: '20px', marginBottom: '15px' }, { title: "縮小" }, "▼");

            this.elements.contentWrapper = ce('div', { position: 'relative', flexGrow: '1', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }, {},
                ce('div', { position: 'absolute', top: '0', left: '0', width: '100%', display: 'flex', flexDirection: 'column', zIndex: '100' }, {},
                    ce('div', { width: '100%', height: '5px', background: '#333' }, {}, this.elements.sleepBarFill),
                    ce('div', { width: '100%', height: '5px', background: '#333' }, {}, this.elements.hotBarFill)
                ),
                this.elements.displayArea,
                ce('div', { position: 'absolute', top: '15px', left: '15px', right: '15px', display: 'flex', flexDirection: 'row', zIndex: '25', pointerEvents: 'none' }, {},
                    statusRow
                ),
                ce('div', { position: 'absolute', bottom: '45px', left: '15px', right: '15px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', zIndex: '25', pointerEvents: 'none' }, {},
                    this.elements.transcriptText
                ),
                this.elements.subtitleContainer,
                this.elements.fakeChatInput
            );

            this.elements.mainContainer = ce('div', { position: 'relative', width: '100%', height: 'calc(100% - 24px)', fontFamily: 'sans-serif', overflow: 'hidden', boxSizing: 'border-box', display: 'flex', flexDirection: 'row' }, {},
                this.elements.contentWrapper,
                this.elements.micVizCanvas,
                ce('div', { width: '60px', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '15px', paddingBottom: '0px', gap: '8px', flexShrink: '0', backgroundColor: '#000', zIndex: '30' }, {},
                    this.elements.btnReload, this.elements.btnSlider,
                    this.elements.btn1, this.elements.btn2, this.elements.btn3, this.elements.btn4, this.elements.btn5,
                    this.elements.btnPower, this.elements.btnMinimize
                )
            );

            this.elements.panel = panel;
            panel.append(this.elements.dragHeader, this.elements.mainContainer);
            this.buildSettingsPanels(); this.attachEvents(); this.startSleepTimer();
            return panel;
        }

        buildSettingsPanels() {
            const sd = this.app.settings.data; const bgData = this.app.settings.bgData; const ce = this.ce.bind(this);
            const createPanel = (id) => {
                const scroll = ce('div', { flexGrow: '1', overflowY: 'auto', paddingRight: '5px' });
                const p = ce('div', { position: 'absolute', top: '0', left: '0', width: 'calc(100% - 60px)', height: '100%', backgroundColor: 'rgba(15, 15, 15, 0.98)', color: '#fff', zIndex: '100', display: 'none', flexDirection: 'column', padding: '20px', boxSizing: 'border-box' }, {},
                    scroll,
                    ce('button', { position: 'absolute', top: '15px', right: '7px', width: '36px', height: '36px', borderRadius: '50%', background: '#333', border: '1px solid #ffccff', color: '#fff', zIndex: '110', cursor: 'pointer' }, { onclick: (e) => { e.stopPropagation(); this.app.audio.playBeep(); p.style.display = 'none'; } }, "✕")
                );
                this.elements.mainContainer.appendChild(p); this.elements[`panel${id}`] = p; return scroll;
            };

            const buildVoiceOptions = (sel) => {
                [{v:"default", t:"🗣️基本"}, {v:"61", t:"🐰通常"}, {v:"62", t:"😲おどろき"}, {v:"63", t:"🤫ひそひそ"}, {v:"64", t:"😵へろへろ"}].forEach(o => sel.appendChild(ce('option', {}, {value: o.v}, o.t)));
            };

            const h = {
                hr: () => ce('hr', { borderColor: '#444', margin: '10px 0' }),
                btn: (text, onClick, bg = '#444') => ce('button', { width: '100%', marginBottom: '15px', padding: '10px', fontWeight: 'bold', fontSize: '13px', background: bg, color: '#fff', border: '1px solid #666', borderRadius: '4px', cursor: 'pointer' }, { onclick: onClick }, text),
                chk: (lbl, k) => ce('div', { marginBottom: '10px' }, {}, ce('label', { display: 'flex', alignItems: 'center', fontSize: '12px', cursor: 'pointer', color: '#aaffaa', fontWeight: 'bold' }, {}, ce('input', { marginRight: '8px' }, { type: 'checkbox', checked: sd[k] === true, onchange: e => { sd[k] = e.target.checked; this.app.settings.save(); } }), lbl)),
                sld: (lbl, k, min, max, step) => {
                    const vSp = ce('span', {}, {}, sd[k]);
                    return ce('div', { marginBottom: '12px' }, {}, ce('div', { display: 'flex', justifyContent: 'space-between', fontSize: '12px' }, {}, ce('span', {}, {}, lbl), vSp), ce('input', { width: '100%' }, { type: 'range', min, max, step, value: sd[k], oninput: e => { sd[k] = parseFloat(e.target.value); vSp.textContent = sd[k]; }, onchange: () => { this.app.settings.save(); this.app.tts.clearCache(); } }));
                },
                num: (lbl, k, cb) => ce('div', { marginBottom: '10px' }, {}, ce('div', { fontSize: '12px', marginBottom: '4px', fontWeight: 'bold', color: '#aaffaa' }, {}, lbl), ce('input', {}, { className: 'setting-input', type: 'number', value: sd[k] || 14, onchange: e => { sd[k] = parseInt(e.target.value, 10); this.app.settings.save(); if(cb) cb(sd[k]); } })),
                col: (lbl, k) => ce('div', { marginBottom: '12px' }, {}, ce('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }, {}, ce('span', {}, {}, lbl), ce('input', { cursor: 'pointer', width: '50px', height: '25px', border: 'none', background: 'transparent' }, { type: 'color', value: sd[k], oninput: e => { sd[k] = e.target.value; this.elements.panel.style.backgroundColor = sd[k]; this.app.settings.save(); } }))),
                txt: (lbl, k, ph, cb) => ce('div', { marginBottom: '10px' }, {}, ce('div', { fontSize: '12px', marginBottom: '4px', fontWeight: 'bold', color: '#aaffaa' }, {}, lbl), ce('input', {}, { className: 'setting-input', type: 'text', value: sd[k] || "", placeholder: ph, onchange: e => { sd[k] = e.target.value; this.app.settings.save(); if(cb) cb(); else this.sync(); } })),
                wMode: (lbl, wK, mK, ph) => {
                    const sel = ce('select', { backgroundColor: '#444' }, { className: 'style-select', onchange: e => { sd[mK] = e.target.value; this.app.settings.save(); } }, ce('option', {}, { value: "PARTIAL", selected: sd[mK] !== "EXACT" }, "含む (部分一致)"), ce('option', {}, { value: "EXACT", selected: sd[mK] === "EXACT" }, "のみ (完全一致)"));
                    return ce('div', { marginBottom: '10px' }, {}, ce('div', { fontSize: '12px', marginBottom: '4px', fontWeight: 'bold', color: '#aaffaa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, {}, ce('span', {}, {}, lbl), sel), ce('input', {}, { className: 'setting-input', type: 'text', value: sd[wK] || "", placeholder: ph, onchange: e => { sd[wK] = e.target.value; this.app.settings.save(); } }));
                },
                advVoice: (lbl, k, ph) => {
                    const sel = ce('select', {}, { className: 'style-select', value: sd[`style_${k}`] || "default", onchange: e => { sd[`style_${k}`] = e.target.value; this.app.settings.save(); this.app.tts.clearCache(); } }); buildVoiceOptions(sel);
                    const mkSld = (l, sK, min, max, step) => {
                        const vSp = ce('span', {}, {}, Number(sd[`${sK}_${k}`] !== undefined ? sd[`${sK}_${k}`] : sd[sK]).toFixed(1));
                        return ce('div', {}, { className: 'voice-slider-item' }, ce('div', {}, { className: 'voice-slider-header' }, l, vSp), ce('input', {}, { type: 'range', min, max, step, value: sd[`${sK}_${k}`] !== undefined ? sd[`${sK}_${k}`] : sd[sK], oninput: e => vSp.textContent = parseFloat(e.target.value).toFixed(1), onchange: e => { sd[`${sK}_${k}`] = parseFloat(e.target.value); this.app.settings.save(); this.app.tts.clearCache(); } }));
                    };
                    return ce('div', { marginBottom: '12px', background: 'rgba(50,50,50,0.5)', padding: '8px', borderRadius: '6px', borderLeft: '3px solid #ffccff' }, {}, ce('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '4px' }, {}, ce('div', { display: 'flex', alignItems: 'center', gap: '5px' }, {}, ce('span', { fontWeight: 'bold' }, {}, lbl), sel), ce('button', {}, { className: 'test-btn', onclick: e => { e.stopPropagation(); if (sd[k]) this.app.tts.enqueue(sd[k], k); } }, "▶")), ce('input', {}, { className: 'setting-input', type: 'text', value: sd[k] || "", placeholder: ph, onchange: e => { sd[k] = e.target.value; this.app.settings.save(); this.app.tts.clearCache(); } }), ce('div', {}, { className: 'voice-slider-container' }, mkSld("高音", "pitch", -0.15, 0.15, 0.01), mkSld("話速", "speed", 0.5, 2.0, 0.1), mkSld("抑揚", "intonation", 0.0, 2.0, 0.1), mkSld("遅延", "delay", 0.0, 5.0, 0.1)));
                },
                advRndVoice: (lbl, bK) => {
                    const sel = ce('select', {}, { className: 'style-select', value: sd[`style_${bK}`] || "default", onchange: e => { sd[`style_${bK}`] = e.target.value; this.app.settings.save(); this.app.tts.clearCache(); } }); buildVoiceOptions(sel);
                    const mkSld = (l, sK, min, max, step) => {
                        const vSp = ce('span', {}, {}, Number(sd[`${sK}_${bK}`] !== undefined ? sd[`${sK}_${bK}`] : sd[sK]).toFixed(2));
                        return ce('div', {}, { className: 'voice-slider-item' }, ce('div', {}, { className: 'voice-slider-header' }, l, vSp), ce('input', {}, { type: 'range', min, max, step, value: sd[`${sK}_${bK}`] !== undefined ? sd[`${sK}_${bK}`] : sd[sK], oninput: e => vSp.textContent = parseFloat(e.target.value).toFixed(2), onchange: e => { sd[`${sK}_${bK}`] = parseFloat(e.target.value); this.app.settings.save(); this.app.tts.clearCache(); } }));
                    };
                    const w = ce('div', { marginBottom: '12px', background: 'rgba(50,50,50,0.5)', padding: '8px', borderRadius: '6px', borderLeft: '3px solid #ffccff' }, {}, ce('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '4px' }, {}, ce('div', { display: 'flex', alignItems: 'center', gap: '5px' }, {}, ce('span', { fontWeight: 'bold' }, {}, lbl), sel), ce('button', {}, { className: 'test-btn', onclick: e => { e.stopPropagation(); const texts = [sd[`${bK}_1`], sd[`${bK}_2`], sd[`${bK}_3`]].filter(t => t && t.trim() !== ""); if(texts.length > 0) this.app.tts.enqueue(texts[Math.floor(Math.random() * texts.length)], bK); } }, "▶")));
                    for(let i=1; i<=3; i++) w.appendChild(ce('input', {}, { className: 'setting-input', type: 'text', value: sd[`${bK}_${i}`] || "", placeholder: `セリフ ${i}`, onchange: e => { sd[`${bK}_${i}`] = e.target.value; this.app.settings.save(); this.app.tts.clearCache(); } }));
                    w.appendChild(ce('div', {}, { className: 'voice-slider-container' }, mkSld("高音", "pitch", -0.15, 0.15, 0.01), mkSld("話速", "speed", 0.5, 2.0, 0.1), mkSld("抑揚", "intonation", 0.0, 2.0, 0.1))); return w;
                },
                statRow: (lbl, tK, iK) => ce('div', { marginBottom: '12px' }, {}, ce('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '4px', color: '#ffccff' }, {}, ce('span', {}, {}, lbl)), ce('div', { display: 'flex', gap: '8px' }, {}, ce('input', { width: '40px', textAlign: 'center', marginBottom: '0' }, { className: 'setting-input', type: 'text', value: sd[iK], placeholder: "🐰", onchange: e => { sd[iK] = e.target.value; this.app.settings.save(); this.sync(); } }), ce('input', { flexGrow: '1', marginBottom: '0' }, { className: 'setting-input', type: 'text', value: sd[tK], placeholder: "テキスト", onchange: e => { sd[tK] = e.target.value; this.app.settings.save(); this.sync(); } }))),
                bgInp: (lbl, k) => ce('div', { marginBottom: '8px' }, {}, ce('div', { fontSize: '12px', marginBottom: '4px' }, {}, lbl), ce('input', {}, { className: 'setting-input', type: 'text', value: bgData[k], placeholder: "画像パス", onchange: async e => { this.app.settings.saveBg(k, e.target.value); const resolved = this.getFullImageUrl(e.target.value); if (resolved) await this.app.imageCache.loadSingle(resolved, true); this.updateBackgroundImage(); } })),
                bgGrp: (title, sK, hasSpd = true, count = 2) => {
                    const g = ce('div', {}, { className: 'setting-group' }, ce('div', {}, { className: 'setting-group-title' }, title));
                    for(let i=1; i<=count; i++) {
                        g.appendChild(h.bgInp(sK === "SPEAKING" ? (i===1 ? "画像パス① (通常)" : "画像パス② (変化)") : `画像パス${i}`, `${sK}_${i}`));
                        if (hasSpd) { if(sd[`speed_${sK}_${i}`] === undefined) sd[`speed_${sK}_${i}`] = 0.5; g.appendChild(h.sld(`↳ 表示時間${i} (秒)`, `speed_${sK}_${i}`, 0.1, 5.0, 0.1)); }
                    } return g;
                },
                rndBgGrp: (title, sK) => {
                    const g = ce('div', {}, { className: 'setting-group' }, ce('div', {}, { className: 'setting-group-title' }, title + " (ランダム抽出)"));
                    for(let i=1; i<=3; i++) g.appendChild(h.bgInp(`ランダム画像 ${i}`, `${sK}_${i}`)); return g;
                }
            };

            const p1 = createPanel(1);
            p1.append(
                h.btn("現在のUI位置とサイズを記憶", e => { e.stopPropagation(); sd.savedPipWidth = this.elements.panel.offsetWidth; sd.savedPipHeight = this.elements.panel.offsetHeight; sd.savedPipLeft = this.elements.panel.offsetLeft; sd.savedPipTop = this.elements.panel.offsetTop; this.app.settings.save(); alert("位置とサイズを記憶しました。"); }, '#660066'),
                h.btn("🔊 発話調整テスト（現在の設定で再生）", e => { e.stopPropagation(); this.app.tts.enqueue("現在設定されているパラメータで発話テストを行っています。声の調子はいかがでしょうか？"); }),
                h.hr(), h.chk("⌨️ Enterで改行 / Shift+Enterで送信", "swapEnterKey"), h.hr(), h.col("背景色", "bgColor")
            );
            [{l:"受付モード維持時間 (秒)", k:"hotModeDuration", m:10, x:300, s:10}, {l:"オートスリープ時間 (秒)", k:"autoSleepTime", m:30, x:600, s:10}, {l:"💬 読み上げ区切り文字数 (1〜500)", k:"readChunkLength", m:1, x:500, s:1}, {l:"🎤 音声入力の確定ディレイ (秒)", k:"speechEndDelay", m:0.0, x:3.0, s:0.1}, {l:"全体音量", k:"volume", m:0, x:2, s:0.1}, {l:"打鍵/ピポ音", k:"beepVolume", m:0, x:2, s:0.1}, {l:"基本の話速", k:"speed", m:0.5, x:2, s:0.1}, {l:"基本の高音", k:"pitch", m:-0.15, x:0.15, s:0.01}, {l:"基本の抑揚", k:"intonation", m:0, x:2, s:0.1}].forEach(o => p1.appendChild(h.sld(o.l, o.k, o.m, o.x, o.s)));
            p1.appendChild(h.hr());
            [{l:"❤ ハート基本サイズ (0でオフ)", k:"heartSize", m:0, x:200}, {l:"❤ サイズばらつき (%)", k:"heartSizeRandom", m:0, x:100}, {l:"❤ 出現位置ばらつき (px)", k:"heartPosRandom", m:0, x:200}].forEach(o => p1.appendChild(h.sld(o.l, o.k, o.m, o.x, 1)));
            this.elements.speakerListContainer = ce('div', { marginTop: '10px', padding: '10px', backgroundColor: '#222', borderRadius: '8px', fontSize: '12px' }); p1.appendChild(this.elements.speakerListContainer);

            const p2 = createPanel(2);
            p2.append(h.txt("🌐 ベースURL (画像パスの先頭に付加)", "baseUrl", "例: http://localhost:8000/", async () => { await this.app.imageCache.preloadAll(true); this.updateBackgroundImage(); }), h.hr());
            const wGrp = ce('div', {}, { className: 'setting-group' });
            [{l:"① 名前 (ウェイクワード)", w:"wakeWord", m:"matchMode_wake"}, {l:"② 終了ワード", w:"exitWord", m:"matchMode_exit"}, {l:"③ おやすみワード", w:"sleepWord", m:"matchMode_sleep"}, {l:"④ 送信ワード (空で即送信)", w:"sendWord", m:"matchMode_send"}, {l:"⑤ やり直しワード (入力を消去)", w:"clearWord", m:"matchMode_clear"}, {l:"⑥ 待機延長ワード (時間回復)", w:"waitWord", m:"matchMode_wait"}, {l:"⑦ 中断ワード (強制停止)", w:"stopWord", m:"matchMode_stop"}].forEach(o => wGrp.appendChild(h.wMode(o.l, o.w, o.m, "例: ワード")));
            p2.append(wGrp, h.advVoice("名前を呼ばれた時の返事", "wakeWordReply", ""), h.advVoice("終了ワードの返事", "exitReply", ""), h.advVoice("おやすみワードの返事", "sleepReply", ""), h.advVoice("やり直しワードの返事", "clearReply", ""), h.advVoice("待機延長ワードの返事", "waitReply", ""), h.advVoice("システム起動時", "startupMessage", ""), h.advVoice("AI思考完了時", "finishedThinkingMessage", ""), h.advVoice("システム復帰時", "resumeMessage", ""), h.hr(), h.advRndVoice("リアクション: 驚く", "reactionSpeechSurprised"), h.advRndVoice("リアクション: しょんぼり", "reactionSpeechSad"), h.advRndVoice("リアクション: 怒る", "reactionSpeechAngry"));

            const p3 = createPanel(3);
            p3.append(h.bgGrp("待機中 (IDLE)", "IDLE", true, 2), h.bgGrp("思考中 (BUSY)", "BUSY", true, 3));
            const spkGrp = h.bgGrp("発話中 (SPEAKING)", "SPEAKING", false, 2); const lsSld = h.sld("👄 口パク感度", "lipSyncThreshold", 1, 100, 1); lsSld.style.marginTop = '10px'; spkGrp.appendChild(lsSld); p3.appendChild(spkGrp);
            p3.append(h.bgGrp("停止中 (STOPPED)", "STOPPED", true, 2), h.bgGrp("接続中 (SEARCHING)", "SEARCHING", true, 2), h.bgGrp("聞き取り中 (LISTENING)", "LISTENING", true, 2), h.bgGrp("困惑 (BLOCKED)", "BLOCKED", true, 2));

            const p4 = createPanel(4);
            p4.append(h.sld("リアクション表示時間", "reactionDuration", 0.5, 5.0, 0.1), h.hr(), h.rndBgGrp("驚く", "REACTION_SURPRISED"), h.rndBgGrp("しょんぼり", "REACTION_SAD"), h.rndBgGrp("怒る", "REACTION_ANGRY"), h.rndBgGrp("起きる (復帰時)", "REACTION_WAKEUP"));

            const p5 = createPanel(5);
            [{l:"待機中 (IDLE)", t:"txt_IDLE", i:"icon_IDLE"}, {l:"思考中 (BUSY)", t:"txt_BUSY", i:"icon_BUSY"}, {l:"発話中 (SPEAKING)", t:"txt_SPEAKING", i:"icon_SPEAKING"}, {l:"停止中 (STOPPED)", t:"txt_STOPPED", i:"icon_STOPPED"}, {l:"接続中 (SEARCHING)", t:"txt_SEARCHING", i:"icon_SEARCHING"}, {l:"聞き取り中 (LISTENING)", t:"txt_LISTENING", i:"icon_LISTENING"}, {l:"困惑 (BLOCKED)", t:"txt_BLOCKED", i:"icon_BLOCKED"}, {l:"受付中 (HOTMODE)", t:"txt_HOTMODE", i:"icon_HOTMODE"}].forEach(o => p5.appendChild(h.statRow(o.l, o.t, o.i)));
            p5.append(h.hr(), h.num("ステータス表示の文字サイズ (px)", "fontSize_status", v => { if(this.elements.statusTextValue){ this.elements.statusTextValue.style.fontSize = v+'px'; this.elements.systemIcon.style.fontSize = v+'px'; this.elements.micStatusContainer.style.fontSize = v+'px'; } }), h.num("音声入力の文字サイズ (px)", "fontSize_transcript", v => { if(this.elements.transcriptText) this.elements.transcriptText.style.fontSize = v+'px'; }), h.num("字幕の文字サイズ (px)", "fontSize_subtitle", v => { if(this.elements.subtitleContainer) this.elements.subtitleContainer.style.fontSize = v+'px'; }), h.hr(), h.txt("音声入力のアイコン", "icon_transcript", "🗣️"), h.txt("マイク待機中テキスト", "micMsg_WAITING", "👂待機中"), h.txt("マイク受付中テキスト", "micMsg_HOTMODE", "🎤受付中"), h.txt("マイク停止中テキスト", "micMsg_MUTED", "🔕停止中"));
        }

        attachEvents() {
            const els = this.elements; const state = this.app.state; const sd = this.app.settings.data;
            document.addEventListener('keydown', (e) => {
                if (!sd.swapEnterKey || e.key !== 'Enter' || e.isComposing) return;
                const isInput = e.target.closest('.input-area div[contenteditable="true"], rich-textarea > div'); if (!isInput) return;
                e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
                if (!e.shiftKey) document.execCommand('insertText', false, '\n');
                else { const btn = document.querySelector('button[aria-label*="送信"], .send-button, [purpose="r-send-button"]'); if (btn) setTimeout(() => btn.click(), 50); }
            }, true);

            window.addEventListener('resize', () => this.enforceBounds());

            els.dragHeader.addEventListener('mousedown', (e) => {
                this.isDragging = true; this.dragStartX = e.clientX; this.dragStartY = e.clientY; const rect = els.panel.getBoundingClientRect();
                this.initialLeft = rect.left; this.initialTop = rect.top; els.panel.style.right = 'auto'; els.panel.style.bottom = 'auto'; els.panel.style.left = this.initialLeft + 'px'; els.panel.style.top = this.initialTop + 'px'; els.dragHeader.style.cursor = 'grabbing';
            });
            els.btnSlider.addEventListener('mousedown', (e) => { e.stopPropagation(); this.isSlidingChat = true; this.slideStartX = e.clientX; els.btnSlider.style.cursor = 'ew-resize'; document.body.style.cursor = 'ew-resize'; });

            document.addEventListener('mousemove', (e) => {
                if (this.isDragging) {
                    els.panel.style.left = Math.max(0, Math.min(this.initialLeft + (e.clientX - this.dragStartX), window.innerWidth - els.panel.offsetWidth)) + 'px';
                    els.panel.style.top = Math.max(0, Math.min(this.initialTop + (e.clientY - this.dragStartY), window.innerHeight - els.panel.offsetHeight)) + 'px';
                }
                if (this.isResizing) {
                    let dX = e.clientX - this.resizeStartX, dY = e.clientY - this.resizeStartY;
                    let nW = this.resizeStartWidth, nH = this.resizeStartHeight, nL = this.resizeStartLeft, nT = this.resizeStartTop;
                    
                    if (this.resizeDir.includes('e')) nW += dX;
                    if (this.resizeDir.includes('w')) { nW -= dX; nL += dX; }
                    if (this.resizeDir.includes('s')) nH += dY;
                    if (this.resizeDir.includes('n')) { nH -= dY; nT += dY; }

                    if (nW < 200) { if (this.resizeDir.includes('w')) nL -= (200 - nW); nW = 200; }
                    if (nH < 300) { if (this.resizeDir.includes('n')) nT -= (300 - nH); nH = 300; }
                    
                    els.panel.style.width = nW + 'px'; els.panel.style.height = nH + 'px'; els.panel.style.left = nL + 'px'; els.panel.style.top = nT + 'px';
                }
                if (this.isSlidingChat) {
                    this.currentChatOffset = (sd.savedChatOffset || 0) + (e.clientX - this.slideStartX);
                    const mainEl = document.querySelector('chat-window') || document.querySelector('main > div:last-child') || document.querySelector('main');
                    if (mainEl) { mainEl.style.transform = `translateX(${this.currentChatOffset}px)`; mainEl.style.transition = 'none'; }
                }
            });

            document.addEventListener('mouseup', () => {
                if (this.isDragging) { this.isDragging = false; els.dragHeader.style.cursor = 'grab'; }
                if (this.isResizing) { this.isResizing = false; document.body.style.cursor = 'default'; }
                if (this.isSlidingChat) { this.isSlidingChat = false; sd.savedChatOffset = this.currentChatOffset; this.app.settings.save(); els.btnSlider.style.cursor = 'ew-resize'; document.body.style.cursor = 'default'; }
            });

            els.btnMinimize.onclick = (e) => {
                e.stopPropagation(); this.app.audio.playBeep(); state.autoRestart = false; if (state.isSpeaking) this.app.tts.stop();
                if (this.app.speech.visualTimer) clearInterval(this.app.speech.visualTimer); this.sync();
                els.panel.style.display = 'none';
                
                const rBtn = this.ce('button', { position: 'fixed', bottom: '20px', right: '20px', zIndex: '9999', padding: '12px 24px', backgroundColor: sd.bgColor, color: '#fff', border: '2px solid #fff', borderRadius: '30px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', boxShadow: '0 4px 10px rgba(0,0,0,0.5)', transition: 'transform 0.2s' }, { onmouseover: () => rBtn.style.transform = 'scale(1.05)', onmouseout: () => rBtn.style.transform = 'scale(1)', onclick: () => { rBtn.remove(); els.panel.style.display = 'flex'; this.enforceBounds(); state.autoRestart = true; state.autoSleepTimeLeft = sd.autoSleepTime; this.sync(); } }, "▶ 実況システム復帰");
                document.body.appendChild(rBtn);
            };

            els.btnReload.onclick = async (e) => {
                e.stopPropagation(); if (state.isTestingImages) return;
                this.app.audio.playBeep(); this.app.tts.enqueue("画像の再読み込みを開始しました。5秒後にテスト再生を行います。");
                state.isTestingImages = true; await this.app.imageCache.preloadAll(true);
                const testKeys = ['IDLE_1', 'IDLE_2', 'BUSY_1', 'BUSY_2', 'BUSY_3', 'SPEAKING_1', 'SPEAKING_2', 'STOPPED_1', 'STOPPED_2', 'SEARCHING_1', 'SEARCHING_2', 'LISTENING_1', 'LISTENING_2', 'BLOCKED_1', 'BLOCKED_2', 'REACTION_SURPRISED_1', 'REACTION_SURPRISED_2', 'REACTION_SURPRISED_3', 'REACTION_SAD_1', 'REACTION_SAD_2', 'REACTION_SAD_3', 'REACTION_ANGRY_1', 'REACTION_ANGRY_2', 'REACTION_ANGRY_3', 'REACTION_WAKEUP_1', 'REACTION_WAKEUP_2', 'REACTION_WAKEUP_3'];
                setTimeout(() => {
                    let idx = 0; const tInt = setInterval(() => {
                        if (idx >= testKeys.length) { clearInterval(tInt); state.isTestingImages = false; this.updateBackgroundImage(); this.app.audio.playBeep(); return; }
                        const raw = this.app.settings.bgData[testKeys[idx]];
                        if (raw && els.displayArea) els.displayArea.style.backgroundImage = `url("${this.app.imageCache.blobs[this.getFullImageUrl(raw)] || this.getFullImageUrl(raw)}")`;
                        idx++;
                    }, 500);
                }, 5000);
            };

            [1,2,3,4,5].forEach(i => els[`btn${i}`].onclick = (e) => {
                e.stopPropagation();
                this.app.audio.playBeep();
                const targetPanel = els[`panel${i}`];
                const isShowing = targetPanel.style.display === 'flex';
                this.hideAllPanels();
                if (!isShowing) {
                    targetPanel.style.display = 'flex';
                }
            });

            els.btnPower.onclick = (e) => { e.stopPropagation(); this.app.audio.playBeep(); this.hideAllPanels(); state.autoRestart = !state.autoRestart; if (!state.autoRestart && state.isSpeaking) this.app.tts.stop(); if (state.hotModeTimeLeft > 0) { state.hotModeTimeLeft = 0; if (this.app.speech.visualTimer) clearInterval(this.app.speech.visualTimer); } state.autoSleepTimeLeft = sd.autoSleepTime; this.sync(); };

            els.contentWrapper.onclick = (e) => {
                if (e.target === els.fakeChatInput || [1,2,3,4,5].some(i => els[`panel${i}`].style.display === 'flex')) return;
                if (sd.heartSize > 0) {
                    const h = this.ce('div', { fontSize: (sd.heartSize * (1 + (Math.random() - 0.5) * 2 * (sd.heartSizeRandom / 100))) + 'px', left: (e.clientX + (Math.random() - 0.5) * sd.heartPosRandom) + 'px', top: (e.clientY + (Math.random() - 0.5) * sd.heartPosRandom) + 'px' }, { className: 'heart-effect' }, '❤');
                    document.body.appendChild(h); setTimeout(() => h.remove(), 1200);
                }
                this.app.audio.playTapSound(); state.autoSleepTimeLeft = sd.autoSleepTime;
                const pRnd = (bK) => { const ts = [sd[`${bK}_1`], sd[`${bK}_2`], sd[`${bK}_3`]].filter(t => t && t.trim()); if(ts.length > 0) this.app.tts.enqueue(ts[Math.floor(Math.random() * ts.length)], bK); };
                if (!state.autoRestart) {
                    state.autoRestart = true; if (this.app.audio.ctx && this.app.audio.ctx.state === 'suspended') this.app.audio.ctx.resume();
                    this.sync(); this.triggerReaction("REACTION_WAKEUP"); setTimeout(() => { if (sd.resumeMessage) this.app.tts.enqueue(sd.resumeMessage, "resumeMessage"); }, 1000);
                } else if (state.isSpeaking || state.current === "BUSY" || state.isGenerating) {
                    if (state.isSpeaking) { this.app.tts.stop(); this.triggerReaction("REACTION_SAD"); pRnd("reactionSpeechSad"); }
                    else { this.triggerReaction("REACTION_ANGRY"); pRnd("reactionSpeechAngry"); }
                    const rs = document.querySelectorAll('.model-response-text'); if (rs.length > 0) rs[rs.length - 1].dataset.readLength = "999999";
                } else { this.triggerReaction("REACTION_SURPRISED"); pRnd("reactionSpeechSurprised"); }
                if (state.hotModeTimeLeft > 0) { state.hotModeTimeLeft = 0; if (this.app.speech.visualTimer) clearInterval(this.app.speech.visualTimer); this.sync(); }
            };
        }

        hideAllPanels() { [1,2,3,4,5].forEach(i => { if(this.elements[`panel${i}`]) this.elements[`panel${i}`].style.display = 'none'; }); }

        triggerReaction(reactionKey) {
            const state = this.app.state; const bgData = this.app.settings.bgData; state.activeReaction = reactionKey;
            const validIdx = [1,2,3].filter(i => bgData[`${reactionKey}_${i}`]);
            state.activeReactionIndex = validIdx.length > 0 ? validIdx[Math.floor(Math.random() * validIdx.length)] : 1;
            this.updateBackgroundImage();
            if (state.reactionTimer) clearTimeout(state.reactionTimer);
            state.reactionTimer = setTimeout(() => { state.activeReaction = null; this.updateBackgroundImage(); }, (this.app.settings.data.reactionDuration || 2.0) * 1000);
        }

        startLipSyncLoop() {
            if (this.app.state.lipSyncInterval) clearInterval(this.app.state.lipSyncInterval);
            this.app.state.lipSyncInterval = setInterval(() => {
                if (!this.app.state.isSpeaking || !this.app.audio.analyser) return this.stopLipSyncLoop();
                const data = new Uint8Array(this.app.audio.analyser.frequencyBinCount); this.app.audio.analyser.getByteFrequencyData(data);
                const isOpen = ((Math.max(...data) / 255) * 100) > 5 && ((Math.max(...data) / 255) * 100) > this.app.settings.data.lipSyncThreshold;
                const vUrls = [1,2].map(i => ({url: this.app.settings.bgData[`SPEAKING_${i}`], idx: i})).filter(u => u.url && u.url.trim() !== "");
                if (vUrls.length > 0 && this.elements.displayArea) {
                    const url = this.getFullImageUrl((isOpen && vUrls.length > 1) ? vUrls[1].url : vUrls[0].url);
                    const targetUrl = `url("${this.app.imageCache.blobs[url] || url}")`;
                    if(this.elements.displayArea.style.backgroundImage !== targetUrl) this.elements.displayArea.style.backgroundImage = targetUrl;
                }
            }, 66);
        }
        stopLipSyncLoop() { if (this.app.state.lipSyncInterval) { clearInterval(this.app.state.lipSyncInterval); this.app.state.lipSyncInterval = null; } }

        updateBackgroundImage() {
            const state = this.app.state; if (!this.elements.displayArea || state.isTestingImages || state.isSpeaking) return;
            const bgData = this.app.settings.bgData;
            if (state.activeReaction) {
                const url = bgData[`${state.activeReaction}_${state.activeReactionIndex}`] || bgData[`${state.activeReaction}_1`];
                if (url) { const r = this.getFullImageUrl(url); this.elements.displayArea.style.backgroundImage = `url("${this.app.imageCache.blobs[r] || r}")`; return; }
            }
            let key = !state.autoRestart ? "STOPPED" : (state.isRecognizing ? "LISTENING" : state.current);
            let vUrls = Array.from({length: key === "BUSY" ? 3 : 2}, (_, i) => ({url: bgData[`${key}_${i+1}`], idx: i+1})).filter(u => u.url && u.url.trim() !== "");
            if (vUrls.length === 0) vUrls = (key === "BLOCKED" && bgData["REACTION_ANGRY_1"]) ? [{url: bgData["REACTION_ANGRY_1"], idx: 1}] : (bgData["IDLE_1"] ? [{url: bgData["IDLE_1"], idx: 1}] : []);
            if (vUrls.length === 0) return;
            const frame = vUrls[state.animStep % vUrls.length]; const r = this.getFullImageUrl(frame.url);
            state.currentFrameSpeed = this.app.settings.data[`speed_${key}_${frame.idx}`] || 0.5;
            this.elements.displayArea.style.backgroundImage = `url("${this.app.imageCache.blobs[r] || r}")`;
        }

        startAnimationLoop() {
            if (this.app.state.animTimeout) clearTimeout(this.app.state.animTimeout);
            const run = () => {
                if (!this.app.state.isSpeaking && !this.app.state.activeReaction) { this.app.state.animStep++; this.updateBackgroundImage(); }
                this.app.state.animTimeout = setTimeout(run, (this.app.state.currentFrameSpeed || 0.5) * 1000);
            };
            run();
        }

        sync(forceMessage = null, isError = false) {
            const state = this.app.state; const sd = this.app.settings.data; const isMuted = (!state.autoRestart);
            if (!this.isSlidingChat && sd.savedChatOffset) { const mainEl = document.querySelector('chat-window') || document.querySelector('main > div:last-child') || document.querySelector('main'); if (mainEl) { mainEl.style.transform = `translateX(${sd.savedChatOffset}px)`; mainEl.style.transition = 'none'; } }
            if (this.app.speech.recognition) {
                if (isMuted && state.isRecognizing) { try { this.app.speech.recognition.stop(); } catch(e){} }
                else if (!isMuted && !state.isRecognizing && state.autoRestart) setTimeout(() => { if (!state.isRecognizing && state.autoRestart) try { this.app.speech.recognition.start(); } catch(e){} }, 300);
            }
            if (state.isSpeaking && !state.lipSyncInterval) this.startLipSyncLoop(); else if (!state.isSpeaking && state.lipSyncInterval) this.stopLipSyncLoop();

            let curKey = isMuted ? "STOPPED" : (state.isSpeaking ? "SPEAKING" : (state.isRecognizing ? "LISTENING" : state.current));
            if (state.lastAnimStateKey !== curKey) { state.lastAnimStateKey = curKey; state.animStep = 0; this.startAnimationLoop(); } else this.updateBackgroundImage();

            let fT = "", sI = "", oC = "";
            if (forceMessage) { sI = isError ? "⚠️" : "ℹ️"; fT = forceMessage; oC = isError ? "#ff0000" : "#ff00ff"; }
            else if (isMuted) { sI = sd.icon_STOPPED; fT = sd.txt_STOPPED; oC = "#888888"; }
            else if (state.isRecognizing && !state.isSpeaking && state.current !== "BUSY" && !state.isGenerating) { sI = sd.icon_LISTENING; fT = sd.txt_LISTENING; oC = "#00ffaa"; }
            else if (state.current === "SEARCHING") { sI = sd.icon_SEARCHING; fT = sd.txt_SEARCHING; oC = "#ffff00"; }
            else if (state.current === "BLOCKED") { sI = sd.icon_BLOCKED; fT = sd.txt_BLOCKED; oC = "#ff6600"; }
            else if (state.current === "BUSY" || state.isGenerating) { sI = sd.icon_BUSY; fT = sd.txt_BUSY; oC = "#88aaff"; }
            else if (state.isSpeaking) { sI = sd.icon_SPEAKING; fT = sd.txt_SPEAKING || "発話中..."; oC = "#ff00ff"; }
            else if (state.hotModeTimeLeft > 0) { sI = sd.icon_HOTMODE; fT = sd.txt_HOTMODE; oC = state.hotModeTimeLeft <= 10 ? "#ff0000" : "#00ffff"; }
            else { sI = sd.icon_IDLE; fT = sd.txt_IDLE; oC = "#ff00ff"; }

            if (this.elements.statusTextValue.textContent !== fT) { this.elements.statusTextValue.textContent = fT; this.elements.statusTextValue.style.textShadow = this.getSharpDoubleOutline(oC); }
            if (this.elements.systemIcon.textContent !== sI) { this.elements.systemIcon.textContent = sI; this.elements.systemIcon.style.textShadow = this.getSharpDoubleOutline(oC); }
            if (this.elements.sleepBarFill) { this.elements.sleepBarFill.style.width = Math.max(0, Math.min(100, (state.autoSleepTimeLeft / sd.autoSleepTime) * 100)) + '%'; this.elements.sleepBarFill.style.backgroundColor = isMuted ? '#555555' : (state.isRecognizing ? '#00ffaa' : '#00ccff'); }
            if (this.elements.hotBarFill) this.elements.hotBarFill.style.width = Math.max(0, Math.min(100, (state.hotModeTimeLeft / sd.hotModeDuration) * 100)) + '%';

            let micMsg = isMuted ? (sd.micMsg_MUTED || "🔕停止中") : (state.isSpeaking || state.current === "BUSY" || state.isGenerating ? "🔇待機中" : (state.hotModeTimeLeft > 0 ? (sd.micMsg_HOTMODE || "🎤受付中") : (sd.micMsg_WAITING || "👂待機中")));
            let micCol = isMuted || state.isSpeaking || state.current === "BUSY" || state.isGenerating ? "#aaaaaa" : (state.hotModeTimeLeft > 0 ? "#ff4444" : "#00ccff");
            if (this.elements.micStatusContainer.textContent !== micMsg) { this.elements.micStatusContainer.textContent = micMsg; this.elements.micStatusContainer.style.textShadow = this.getSharpDoubleOutline(micCol); }
        }

        startMicVisualizer() {
            const ctx = this.elements.micVizCanvas.getContext('2d'), cvs = this.elements.micVizCanvas;
            const render = () => {
                if (!this.app.audio.micAnalyser) return; requestAnimationFrame(render);
                const d = new Uint8Array(this.app.audio.micAnalyser.frequencyBinCount); this.app.audio.micAnalyser.getByteFrequencyData(d);
                let sum = 0; for (let i = 0; i < d.length; i++) sum += d[i];
                ctx.clearRect(0, 0, cvs.width, cvs.height); ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; ctx.fillRect(0, 0, cvs.width, cvs.height);
                const bH = ((sum / d.length) / 255) * cvs.height * 2.02;
                const grad = ctx.createLinearGradient(0, cvs.height, 0, 0); grad.addColorStop(0, '#ffff00'); grad.addColorStop(1, '#ff0000');
                ctx.fillStyle = grad; ctx.fillRect(0, cvs.height - bH, cvs.width, bH);
                if (!this.app.state.autoRestart || this.app.state.isSpeaking || this.app.state.current === "BUSY" || this.app.state.isGenerating) { ctx.fillStyle = 'rgba(255, 0, 0, 0.3)'; ctx.fillRect(0, 0, cvs.width, cvs.height); }
            };
            render();
        }

        startSleepTimer() {
            this.sleepTimer = setInterval(() => {
                const state = this.app.state; if (!state.autoRestart) return;
                if (state.isGenerating || state.current === "BUSY" || state.isSpeaking || state.hotModeTimeLeft > 0) state.autoSleepTimeLeft = this.app.settings.data.autoSleepTime;
                else {
                    state.autoSleepTimeLeft--;
                    if (state.autoSleepTimeLeft <= 0) { state.autoRestart = false; state.autoSleepTimeLeft = this.app.settings.data.autoSleepTime; if (this.app.speech.recognition) { try { this.app.speech.recognition.stop(); } catch(e){} } }
                }
                this.sync();
            }, 1000);
        }

        async renderSpeakerList() {
            GM_xmlhttpRequest({
                method: "GET", url: "http://localhost:50021/speakers",
                onload: (res) => {
                    const spks = JSON.parse(res.responseText); this.elements.speakerListContainer.textContent = "";
                    this.elements.speakerListContainer.appendChild(this.ce('div', {marginBottom:'5px', fontWeight:'bold'}, {}, "基本の話者:"));
                    const sel = this.ce('select', {width:'100%', padding:'8px', backgroundColor:'#333', color:'#fff', border:'1px solid #555', borderRadius:'4px', fontSize:'14px', cursor:'pointer'}, {onchange: e => { this.app.settings.data.selectedSpeakerId = parseInt(e.target.value, 10); this.app.settings.save(); this.app.tts.clearCache(); }});
                    spks.forEach(s => s.styles.forEach(st => sel.appendChild(this.ce('option', {}, {value: st.id, selected: this.app.settings.data.selectedSpeakerId === st.id}, `${s.name} (${st.name})`))));
                    this.elements.speakerListContainer.appendChild(sel);
                }
            });
        }
    }

    // =====================================================================
    // 9. Class: VoiceObserver
    // =====================================================================
    class VoiceObserver {
        constructor(app) { this.app = app; this.lastProcessTime = 0; this.processTimeout = null; }
        getCleanTextFast(element) {
            if (!element) return ""; const temp = element.cloneNode(true);
            temp.querySelectorAll('pre, code').forEach(el => el.remove());
            temp.querySelectorAll('br').forEach(br => br.replaceWith(document.createTextNode('\n')));
            temp.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6').forEach(el => el.appendChild(document.createTextNode('\n')));
            let text = (temp.textContent || "").replace(/\n+/g, '\n').trim();
            
            // 【Ver 23.00 追加】不要なテキストのフィルタリング
            text = text.replace(/https?:\/\/[\w/:%#\$&\?\(\)~\.=\+\-]+/gi, ""); // URL
            text = text.replace(/スプレッドシートにエクスポート|回答をコピー|他の回答案|Google 検索|共有とエクスポート/g, ""); // UIテキスト
            text = text.replace(/\[\d+\]/g, ""); // 引用注釈
            text = text.replace(/[a-zA-Z0-9_.-]{15,}/g, ""); // 15文字以上の連続する英数字（ファイル名やハッシュ等）
            
            return text.trim();
        }
        getTargetText(text) { const limit = this.app.settings.data.readChunkLength || 50; if (text.length < limit) return text; const idx = text.indexOf('\n', limit); return idx === -1 ? text : text.substring(0, idx + 1); }
        getSignature(text) { return text ? text.replace(/\s+|[。、！？.,!?"'()「」『』【】\[\]*`~_>\-]/g, '').substring(0, 40) : ""; }
        start() {
            const executeProcess = () => {
                const state = this.app.state; const ui = this.app.ui; const audio = this.app.audio; const tts = this.app.tts; const sd = this.app.settings.data;
                const responses = document.querySelectorAll('.model-response-text'); const stopButton = document.querySelector('button[aria-label*="停止"], .generating-text, [purpose="r-stop-button"]');
                const searchingChip = document.querySelector('use-case-chip, .google-search-chip'); const checkLimit = Math.max(0, responses.length - 2);
                for (let i = 0; i < checkLimit; i++) { if (!responses[i].hasAttribute('data-spoken')) { responses[i].setAttribute('data-spoken', 'true'); responses[i].dataset.readLength = responses[i].textContent.length.toString(); } }
                let activeResponse = null;
                for (let i = responses.length - 1; i >= checkLimit; i--) {
                    const el = responses[i];
                    if (!el.hasAttribute('data-spoken')) {
                        const fullText = this.getCleanTextFast(el); const sig = this.getSignature(fullText);
                        if (state.spokenSignatures.has(sig) && fullText.length > 0) { el.setAttribute('data-spoken', 'true'); el.dataset.readLength = fullText.length.toString(); continue; }
                        else { activeResponse = el; break; }
                    }
                }
                if (activeResponse && !state.isSystemReady) {
                    activeResponse.setAttribute('data-spoken', 'true'); activeResponse.dataset.readLength = activeResponse.textContent.length.toString();
                    const cleanTxt = this.getCleanTextFast(activeResponse); if(cleanTxt) state.spokenSignatures.add(this.getSignature(cleanTxt)); return;
                }
                const isCurrentlyGenerating = !!stopButton;
                if (!isCurrentlyGenerating && searchingChip && !state.isGenerating) { state.current = "SEARCHING"; ui.sync(); }
                else if (!isCurrentlyGenerating && !searchingChip && !state.isGenerating) { state.current = "IDLE"; ui.sync(); }

                if (isCurrentlyGenerating && !state.isGenerating) {
                    state.isGenerating = true; state.current = "BUSY"; if (!state.autoRestart) state.autoRestart = true;
                    if (activeResponse) { activeResponse.dataset.readLength = "0"; state.generatingTextLength = 0; }
                    audio.startTypingSound(); ui.sync();
                }
                if (state.isGenerating && activeResponse) {
                    const fullText = this.getCleanTextFast(activeResponse); state.generatingTextLength = fullText.length;
                    if (!isCurrentlyGenerating && fullText.length < 20 && (fullText.includes("お役に") || fullText.includes("承れません"))) { state.current = "BLOCKED"; ui.sync(); }
                    const targetText = this.getTargetText(fullText); let readLen = parseInt(activeResponse.dataset.readLength || "0", 10);
                    if (targetText.length > readLen) {
                        const unreadText = targetText.substring(readLen); const sentenceRegex = /^[^。！？\n]*[。！？\n]+[」』）】］"']*/;
                        let match, currentUnread = unreadText, newlyReadLen = 0;
                        while ((match = currentUnread.match(sentenceRegex)) !== null) { tts.enqueue(match[0]); newlyReadLen += match[0].length; currentUnread = currentUnread.substring(match[0].length); }
                        if (newlyReadLen > 0) activeResponse.dataset.readLength = (readLen + newlyReadLen).toString();
                    }
                }
                if (!isCurrentlyGenerating && state.isGenerating) {
                    state.isGenerating = false; state.generatingTextLength = 0; state.current = "IDLE";
                    audio.stopTypingSound(); audio.playBeep(); state.autoSleepTimeLeft = sd.autoSleepTime;
                    if (!state.isSpeaking && tts.queue.length === 0 && sd.finishedThinkingMessage) tts.playInstantly(sd.finishedThinkingMessage, "finishedThinkingMessage");
                    if (activeResponse) {
                        const fullText = this.getCleanTextFast(activeResponse); const targetText = this.getTargetText(fullText);
                        let readLen = parseInt(activeResponse.dataset.readLength || "0", 10);
                        if (targetText.length > readLen) tts.enqueue(targetText.substring(readLen).trim());
                        activeResponse.dataset.readLength = fullText.length.toString(); activeResponse.setAttribute('data-spoken', 'true');
                        if (fullText.length > 0) state.spokenSignatures.add(this.getSignature(fullText));
                    }
                    ui.sync();
                }
            };
            const observer = new MutationObserver(() => {
                const now = Date.now(); const stopButton = document.querySelector('button[aria-label*="停止"], .generating-text, [purpose="r-stop-button"]');
                if (this.app.state.isGenerating && !stopButton) { if (this.processTimeout) clearTimeout(this.processTimeout); this.lastProcessTime = now; executeProcess(); return; }
                if (now - this.lastProcessTime > 150) { if (this.processTimeout) clearTimeout(this.processTimeout); this.lastProcessTime = now; executeProcess(); }
                else if (!this.processTimeout) { this.processTimeout = setTimeout(() => { this.lastProcessTime = Date.now(); executeProcess(); }, 150); }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    // =====================================================================
    // 10. Class: VoiceApp (Main Controller)
    // =====================================================================
    class VoiceApp {
        constructor() {
            this.settings = new VoiceSettings(); this.state = new VoiceState(); this.audio = new VoiceAudio(this);
            this.tts = new VoiceTTS(this); this.speech = new VoiceSpeech(this); this.ui = new VoiceUI(this);
            this.observer = new VoiceObserver(this); this.imageCache = new VoiceImageCache(this);
        }
        createBootUI() {
            const shield = document.createElement('div');
            Object.assign(shield.style, {
                position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
                backgroundColor: 'rgba(0, 0, 0, 0.7)', zIndex: '2147483647',
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                cursor: 'pointer', backdropFilter: 'blur(5px)', transition: 'opacity 0.3s'
            });
            const startText = document.createElement('div');
            startText.textContent = "画面をクリックして実況システム(Ver 23.00)を起動";
            Object.assign(startText.style, {
                color: '#fff', fontSize: '24px', fontWeight: 'bold', textShadow: '0 2px 10px rgba(0,0,0,0.8)'
            });
            shield.appendChild(startText);
            document.body.appendChild(shield);

            shield.onclick = async () => {
                shield.style.opacity = '0';
                setTimeout(() => shield.remove(), 300);
                await this.init();
            };
        }
        async init() {
            this.settings.init(); document.body.appendChild(this.ui.build()); this.ui.enforceBounds();
            this.speech.init(); this.ui.renderSpeakerList(); try { await this.audio.setupMic(); } catch (e) {}
            this.tts.preloadCache(); await this.imageCache.preloadAll();
            setTimeout(() => {
                this.state.autoRestart = true; this.state.autoSleepTimeLeft = this.settings.data.autoSleepTime; this.ui.sync();
                if(this.settings.data.startupMessage) this.tts.enqueue(this.settings.data.startupMessage, "startupMessage");
                this.observer.start(); setTimeout(() => { this.state.isSystemReady = true; }, 5000);
            }, 500);
        }
    }

    // =====================================================================
    // Boot
    // =====================================================================
    const app = new VoiceApp();
    app.createBootUI();

})();
