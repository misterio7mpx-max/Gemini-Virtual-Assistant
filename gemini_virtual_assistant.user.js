// ==UserScript==
// @name         Gemini Voice Control (Ver 20.90 - UI Polish Mode)
// @namespace    http://tampermonkey.net/
// @version      20.90
// @description  リソース表示の余白調整、マイクバーの細幅化、設定ボタン背景の黒帯化などレイアウトの最適化。
// @author       AI Assistant
// @match        https://gemini.google.com/*
// @grant        GM_xmlhttpRequest
// @connect      localhost
// ==/UserScript==

(function() {
    'use strict';

    if (window.trustedTypes && window.trustedTypes.createPolicy) {
        if (!window.trustedTypes.defaultPolicy) {
            window.trustedTypes.createPolicy('default', {
                createHTML: (s) => s, createScriptURL: (s) => s, createScript: (s) => s,
            });
        }
    }

    // =====================================================================
    // 2. Settings Manager
    // =====================================================================
    const Settings = {
        data: {},
        bgData: {},
        defaultData: {
            volume: 1.0, beepVolume: 0.5, speed: 1.0, pitch: 0.0, intonation: 1.0, selectedSpeakerId: 61,
            pipWidth: 336, pipHeight: 600, savedPipWidth: 336, savedPipHeight: 600,
            bgColor: '#009900', lipSyncThreshold: 15,
            autoSleepTime: 180, hotModeDuration: 120,
            speed_IDLE_1: 0.5, speed_IDLE_2: 0.5,
            speed_BUSY_1: 0.5, speed_BUSY_2: 0.5, speed_BUSY_3: 0.5,
            speed_STOPPED_1: 0.5, speed_STOPPED_2: 0.5,
            speed_SEARCHING_1: 0.5, speed_SEARCHING_2: 0.5,
            speed_LISTENING_1: 0.5, speed_LISTENING_2: 0.5,
            speed_BLOCKED_1: 0.5, speed_BLOCKED_2: 0.5,

            wakeWord: "うさぎちゃん", exitWord: "ありがとう", sleepWord: "おやすみ",
            wakeWordReply: "はい、なんです？", exitReply: "どういたしまして。", sleepReply: "おやすみなさい。",
            startupMessage: "システムを起動しました。", finishedThinkingMessage: "お待たせしました！", resumeMessage: "おはようございます。",

            reactionSpeechSurprised_1: "びっくりした！", reactionSpeechSurprised_2: "", reactionSpeechSurprised_3: "",
            reactionSpeechSad_1: "しゅん……", reactionSpeechSad_2: "", reactionSpeechSad_3: "",
            reactionSpeechAngry_1: "もーっ！", reactionSpeechAngry_2: "", reactionSpeechAngry_3: "",
            reactionDuration: 2.0,

            style_wakeWordReply: "default", style_exitReply: "default", style_sleepReply: "default",
            style_startupMessage: "default", style_finishedThinkingMessage: "default", style_resumeMessage: "default",
            style_reactionSpeechSurprised: "default", style_reactionSpeechSad: "default", style_reactionSpeechAngry: "default",

            txt_IDLE: "システム待機中", txt_BUSY: "思考中...", txt_STOPPED: "システム停止中",
            txt_SEARCHING: "接続確認中...", txt_LISTENING: "聞き取り中...", txt_BLOCKED: "困惑中...",
            txt_HOTMODE: "受付中", txt_SPEAKING: "発話中...",
            icon_IDLE: "🐰", icon_BUSY: "🔄", icon_STOPPED: "💤",
            icon_SEARCHING: "📡", icon_LISTENING: "👂", icon_BLOCKED: "😰",
            icon_HOTMODE: "🔥", icon_SPEAKING: "🎵"
        },
        init() {
            const saved = JSON.parse(localStorage.getItem('gemini_voice_settings')) || {};
            this.data = { ...this.defaultData, ...saved };
            const bgKeys = ['IDLE_1', 'IDLE_2', 'BUSY_1', 'BUSY_2', 'BUSY_3', 'SPEAKING_1', 'SPEAKING_2', 'STOPPED_1', 'STOPPED_2',
                            'SEARCHING_1', 'SEARCHING_2', 'LISTENING_1', 'LISTENING_2', 'BLOCKED_1', 'BLOCKED_2',
                            'REACTION_SURPRISED_1', 'REACTION_SURPRISED_2', 'REACTION_SURPRISED_3',
                            'REACTION_SAD_1', 'REACTION_SAD_2', 'REACTION_SAD_3',
                            'REACTION_ANGRY_1', 'REACTION_ANGRY_2', 'REACTION_ANGRY_3',
                            'REACTION_WAKEUP_1', 'REACTION_WAKEUP_2', 'REACTION_WAKEUP_3'];
            bgKeys.forEach(key => { this.bgData[key] = localStorage.getItem(`gemini_voice_bg_${key.toLowerCase()}`) || ""; });
        },
        save() { try { localStorage.setItem('gemini_voice_settings', JSON.stringify(this.data)); } catch(e) {} },
        saveBg(key, url) { this.bgData[key] = url; try { localStorage.setItem(`gemini_voice_bg_${key.toLowerCase()}`, url); } catch(e) {} }
    };

    const State = {
        current: "IDLE", isSpeaking: false, isRecognizing: false, isGenerating: false,
        generatingTextLength: 0, autoRestart: false, hotModeTimeLeft: 0, autoSleepTimeLeft: 180,
        animStep: 0, activeReaction: null, activeReactionIndex: 1, reactionTimer: null, animTimeout: null, lastAnimStateKey: null,
        currentFrameSpeed: 0.5, isSystemReady: false, spokenSignatures: new Set()
    };

    // =====================================================================
    // 4. Audio Manager
    // =====================================================================
    const AudioModule = {
        ctx: null, analyser: null, micAnalyser: null, micStream: null, typingInterval: null,
        initCtx() {
            if (!this.ctx || this.ctx.state === 'closed') {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
                this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = 256;
                this.analyser.smoothingTimeConstant = 0.5; this.analyser.connect(this.ctx.destination);
            }
            return this.ctx;
        },
        async setupMic() {
            if (!UI.pipWindow) return;
            try {
                this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                const ctx = this.initCtx(); const source = ctx.createMediaStreamSource(this.micStream);
                this.micAnalyser = ctx.createAnalyser(); this.micAnalyser.fftSize = 256; this.micAnalyser.smoothingTimeConstant = 0.8;
                source.connect(this.micAnalyser); UI.startMicVisualizer();
            } catch (e) {}
        },
        stopMic() { if (this.micStream) { this.micStream.getTracks().forEach(t => t.stop()); this.micStream = null; this.micAnalyser = null; } },
        playTypingTick(isHeavy = false) {
            const ctx = this.initCtx(); if(ctx.state === 'suspended') return;
            const osc = ctx.createOscillator(); const gain = ctx.createGain(); const filter = ctx.createBiquadFilter();
            osc.type = isHeavy ? 'sawtooth' : 'square'; filter.type = 'bandpass'; filter.frequency.value = isHeavy ? (1200 + Math.random() * 600) : (800 + Math.random() * 400);
            gain.gain.setValueAtTime(Settings.data.beepVolume * (isHeavy ? 0.030 : 0.025), ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (isHeavy ? 0.03 : 0.05));
            osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + (isHeavy ? 0.03 : 0.05));
        },
        startTypingSound() { if (this.typingInterval) return; this.typingInterval = setInterval(() => { if (State.isGenerating) { const isHeavy = State.generatingTextLength > 300; if (Math.random() < (isHeavy ? 0.6 : 0.3)) this.playTypingTick(isHeavy); } }, 80); },
        stopTypingSound() { clearInterval(this.typingInterval); this.typingInterval = null; },
        playBeep() { const ctx = this.initCtx(); if(ctx.state === 'suspended') return; const playTone = (f, s, d) => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f, s); g.gain.setValueAtTime(Settings.data.beepVolume * 0.2, s); g.gain.exponentialRampToValueAtTime(0.01, s + d); o.connect(g); g.connect(ctx.destination); o.start(s); o.stop(s + d); }; playTone(880, ctx.currentTime, 0.1); playTone(1046, ctx.currentTime + 0.1, 0.1); },
        playTapSound() { const ctx = this.initCtx(); if(ctx.state === 'suspended') return; const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'sine'; osc.frequency.setValueAtTime(600, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1); gain.gain.setValueAtTime(0, ctx.currentTime); gain.gain.linearRampToValueAtTime(Settings.data.beepVolume * 0.3, ctx.currentTime + 0.02); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15); osc.connect(gain); gain.connect(ctx.destination); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.15); }
    };

    // =====================================================================
    // 5. TTS Manager
    // =====================================================================
    const TTS = {
        queue: [], currentSource: null, audioCache: {},
        cleanText(text) { if (!text) return ""; return text.replace(/\*?\]/gi, "").replace(/[#*`_~>|\-「」『』（）()【】\[\]"']/g, "").trim(); },
        getParamsForKey(key) {
            let p = Settings.data.pitch; let s = Settings.data.speed; let i = Settings.data.intonation; let sid = Settings.data.selectedSpeakerId;
            if (key) {
                if (Settings.data[`pitch_${key}`] !== undefined) p = parseFloat(Settings.data[`pitch_${key}`]);
                if (Settings.data[`speed_${key}`] !== undefined) s = parseFloat(Settings.data[`speed_${key}`]);
                if (Settings.data[`intonation_${key}`] !== undefined) i = parseFloat(Settings.data[`intonation_${key}`]);
                if (Settings.data[`style_${key}`] && Settings.data[`style_${key}`] !== "default") sid = parseInt(Settings.data[`style_${key}`], 10);
            }
            return { pitch: p, speed: s, intonation: i, sid: sid };
        },
        async preloadCache() {
            const targets = [
                { key: "wakeWordReply", text: Settings.data.wakeWordReply },
                { key: "startupMessage", text: Settings.data.startupMessage },
                { key: "finishedThinkingMessage", text: Settings.data.finishedThinkingMessage },
                { key: "resumeMessage", text: Settings.data.resumeMessage },
                { key: "exitReply", text: Settings.data.exitReply },
                { key: "sleepReply", text: Settings.data.sleepReply }
            ];
            ["reactionSpeechSurprised", "reactionSpeechSad", "reactionSpeechAngry"].forEach(baseKey => {
                for(let i=1; i<=3; i++) {
                    if (Settings.data[`${baseKey}_${i}`]) targets.push({ key: baseKey, text: Settings.data[`${baseKey}_${i}`] });
                }
            });
            for (let item of targets) {
                const t = this.cleanText(item.text); if (t.length < 2) continue;
                const params = this.getParamsForKey(item.key);
                const cacheKey = `${t}_${params.pitch}_${params.sid}_${params.speed}_${params.intonation}`;
                if (this.audioCache[cacheKey]) continue;
                try { this.audioCache[cacheKey] = await this.generateAudioBuffer(t, params); } catch(e) {}
            }
        },
        clearCache() { this.audioCache = {}; if (AudioModule.ctx) this.preloadCache(); },
        async generateAudioBuffer(text, params) {
            const ctx = AudioModule.initCtx();
            const queryRes = await new Promise((res, rej) => {
                GM_xmlhttpRequest({
                    method: "POST", url: `http://localhost:50021/audio_query?speaker=${params.sid}&text=${encodeURIComponent(text)}`,
                    onload: (r) => {
                        let d = JSON.parse(r.responseText);
                        d.volumeScale = Settings.data.volume; d.speedScale = params.speed;
                        d.pitchScale = params.pitch; d.intonationScale = params.intonation;
                        d.prePhonemeLength = 0; d.postPhonemeLength = 0; res(d);
                    },
                    onerror: () => rej()
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
        },
        enqueue(text, configKey = null) {
            const t = this.cleanText(text); if (t.length < 1) return;
            const params = this.getParamsForKey(configKey);
            this.queue.push({ text: t, params: params });
            this.processQueue();
        },
        async playInstantly(text, configKey = null) {
            const t = this.cleanText(text); if (t.length < 1) return;
            const params = this.getParamsForKey(configKey);
            const cacheKey = `${t}_${params.pitch}_${params.sid}_${params.speed}_${params.intonation}`;
            try {
                const ctx = AudioModule.initCtx(); let buffer = this.audioCache[cacheKey];
                if (!buffer) { buffer = await this.generateAudioBuffer(t, params); this.audioCache[cacheKey] = buffer; }
                const source = ctx.createBufferSource(); source.buffer = buffer; source.connect(AudioModule.analyser); source.start(0);
            } catch (e) {}
        },
        async processQueue() {
            if (State.isSpeaking || this.queue.length === 0) return;
            State.isSpeaking = true; UI.sync();
            const item = this.queue.shift();
            const cacheKey = `${item.text}_${item.params.pitch}_${item.params.sid}_${item.params.speed}_${item.params.intonation}`;
            if (Speech.recognition && State.isRecognizing) { try { Speech.recognition.stop(); } catch(e){} }
            try {
                const ctx = AudioModule.initCtx(); let buffer = this.audioCache[cacheKey];
                if (!buffer) { buffer = await this.generateAudioBuffer(item.text, item.params); this.audioCache[cacheKey] = buffer; }
                const source = ctx.createBufferSource(); this.currentSource = source; source.buffer = buffer; source.connect(AudioModule.analyser);
                source.onended = () => { this.currentSource = null; State.isSpeaking = false; UI.sync(); this.processQueue(); };
                source.start(0);
            } catch (e) { State.isSpeaking = false; this.currentSource = null; UI.sync(); this.processQueue(); }
        },
        stop() { this.queue = []; if (this.currentSource) { try { this.currentSource.stop(); } catch(e){} } }
    };

    // =====================================================================
    // 6. Speech Recognition
    // =====================================================================
    const Speech = {
        recognition: null, visualTimer: null,
        init() {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) return;
            this.recognition = new SpeechRecognition();
            this.recognition.lang = 'ja-JP'; this.recognition.interimResults = true; this.recognition.continuous = false;
            this.recognition.onstart = () => { State.isRecognizing = true; UI.sync(); };
            this.recognition.onerror = () => { State.isRecognizing = false; };
            this.recognition.onend = () => { State.isRecognizing = false; UI.sync(); };
            this.recognition.onresult = (event) => {
                if (State.isSpeaking || State.current === "BUSY") return;
                let transcript = event.results[0][0].transcript.trim();
                if (event.results[0].isFinal) {
                    const hasWakeWord = Settings.data.wakeWord && transcript.includes(Settings.data.wakeWord);
                    const cleanCmd = hasWakeWord ? transcript.replace(Settings.data.wakeWord, "").trim() : transcript;

                    if (cleanCmd === Settings.data.sleepWord) {
                        if (Settings.data.sleepReply) TTS.enqueue(Settings.data.sleepReply, "sleepReply");
                        State.hotModeTimeLeft = 0; State.autoRestart = false; if (this.visualTimer) clearInterval(this.visualTimer);
                        UI.sync(); return;
                    }
                    if (cleanCmd === Settings.data.exitWord) {
                        if (Settings.data.exitReply) TTS.enqueue(Settings.data.exitReply, "exitReply");
                        State.hotModeTimeLeft = 0; if (this.visualTimer) clearInterval(this.visualTimer);
                        UI.sync(); return;
                    }

                    if (hasWakeWord) {
                        this.activateHotMode(); State.autoSleepTimeLeft = Settings.data.autoSleepTime;
                        if (cleanCmd.length > 0) { this.sendToGemini(cleanCmd); }
                        else { if(Settings.data.wakeWordReply) TTS.enqueue(Settings.data.wakeWordReply, "wakeWordReply"); }
                    } else if (State.hotModeTimeLeft > 0) {
                        this.activateHotMode(); State.autoSleepTimeLeft = Settings.data.autoSleepTime;
                        this.sendToGemini(transcript);
                    }
                    UI.sync();
                }
            };
        },
        activateHotMode() {
            State.hotModeTimeLeft = Settings.data.hotModeDuration;
            UI.sync();
            if (this.visualTimer) clearInterval(this.visualTimer);
            this.visualTimer = setInterval(() => {
                if (State.hotModeTimeLeft > 0) { State.hotModeTimeLeft--; UI.sync(); }
                else { clearInterval(this.visualTimer); UI.sync(); }
            }, 1000);
        },
        sendToGemini(text) {
            const inputElem = document.querySelector('.input-area div[contenteditable="true"], rich-textarea > div');
            if (!inputElem) return;
            document.querySelectorAll('.model-response-text').forEach(el => {
                el.setAttribute('data-spoken', 'true'); el.dataset.readLength = el.textContent.length.toString();
                const cleanTxt = GeminiObserver.getCleanTextFast(el); if(cleanTxt) State.spokenSignatures.add(GeminiObserver.getSignature(cleanTxt));
            });
            inputElem.focus(); document.execCommand('insertText', false, text);
            setTimeout(() => { const sendBtn = document.querySelector('button[aria-label*="送信"], .send-button, [purpose="r-send-button"]'); if (sendBtn) sendBtn.click(); }, 500);
        }
    };

    // =====================================================================
    // 7. Monitor
    // =====================================================================
    const Monitor = {
        cldPing: '--', ttsPing: '--', cpuLoad: 0, gpuLoad: 0, memUsage: 0, pingTimer: null, resourceTimer: null, sleepTimer: null,
        start() {
            this.pingTimer = setInterval(() => {
                let startCld = performance.now();
                fetch('https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2', { method: 'HEAD', cache: 'no-store' })
                    .then(() => { this.cldPing = Math.round(performance.now() - startCld); this.updateUI(); }).catch(() => { this.cldPing = Math.round(performance.now() - startCld); this.updateUI(); });
                let startTts = performance.now();
                GM_xmlhttpRequest({ method: "GET", url: "http://localhost:50021/version", onload: () => { this.ttsPing = Math.round(performance.now() - startTts); this.updateUI(); }, onerror: () => { this.ttsPing = 'ERR'; this.updateUI(); } });
            }, 5000);
            this.resourceTimer = setInterval(() => {
                let baseCpu = (State.current === "BUSY" || State.isGenerating) ? 45 : (State.isSpeaking || State.isRecognizing ? 25 : 5);
                this.cpuLoad = Math.max(1, Math.min(100, Math.round(baseCpu + Math.random() * 15))); this.gpuLoad = Math.max(1, Math.min(100, Math.round(this.cpuLoad * 0.6 + Math.random() * 10))); this.memUsage = performance.memory ? Math.round(performance.memory.usedJSHeapSize / (1024 * 1024)) : Math.round(180 + Math.random() * 10);
                this.updateUI();
            }, 1000);
            this.sleepTimer = setInterval(() => {
                if (!State.autoRestart) return;
                if (State.isGenerating || State.current === "BUSY" || State.isSpeaking || State.hotModeTimeLeft > 0) { State.autoSleepTimeLeft = Settings.data.autoSleepTime; } else { State.autoSleepTimeLeft--; if (State.autoSleepTimeLeft <= 0) { State.autoRestart = false; State.autoSleepTimeLeft = Settings.data.autoSleepTime; if (Speech.recognition) { try { Speech.recognition.stop(); } catch(e){} } } }
                UI.sync();
            }, 1000);
        },
        updateUI() { if (UI.elements.pingCldSpan && UI.elements.pingTtsSpan) { UI.elements.pingCldSpan.textContent = `CLD: ${this.cldPing}ms`; UI.elements.pingTtsSpan.textContent = `TTS: ${this.ttsPing}ms`; } if (UI.elements.resourceElement) { UI.elements.resourceElement.textContent = `CPU: ${String(this.cpuLoad).padStart(2,'0')}% | GPU: ${String(this.gpuLoad).padStart(2,'0')}% | MEM: ${this.memUsage}MB`; } }
    };

    // =====================================================================
    // 8. UI Manager
    // =====================================================================
    const UI = {
        pipWindow: null, elements: {}, shadowCache: {}, whiteShadowCache: null, greenShadowCache: null,
        build() {
            const mainContainer = document.createElement('div');
            Object.assign(mainContainer.style, { display: 'none', position: 'relative', width: '100%', height: '100%', fontFamily: 'sans-serif', overflow: 'hidden', backgroundColor: Settings.data.bgColor, boxSizing: 'border-box', display: 'flex', flexDirection: 'row' });
            const customStyles = document.createElement('style');
            customStyles.textContent = `
                @keyframes spinGlobe { 0% { transform: perspective(150px) rotateX(20deg) rotateY(0deg); } 100% { transform: perspective(150px) rotateX(20deg) rotateY(360deg); } }
                @keyframes floatHeart { 0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; } 100% { transform: translate(-50%, -200px) scale(1.5); opacity: 0; } }
                .icon-spin { display: inline-block; animation: spinGlobe 1.5s linear infinite; }
                .heart-effect { position: absolute; color: #ff66cc; font-size: 84px; pointer-events: none; z-index: 9999; animation: floatHeart 1.2s ease-out forwards; text-shadow: 2px 2px 4px #fff, -2px -2px 4px #fff, 2px -2px 4px #fff, -2px 2px 4px #fff; }
                .setting-group { border: 1px solid #444; padding: 10px; border-radius: 8px; margin-bottom: 12px; background: #1a1a1a; }
                .setting-group-title { font-weight: bold; margin-bottom: 8px; color: #ffccff; font-size: 13px; border-bottom: 1px solid #444; padding-bottom: 4px; }
                .setting-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 12px;}
                .setting-input { width: 100%; background: #333; color: #fff; border: 1px solid #555; margin-bottom: 4px; padding: 5px; box-sizing: border-box; font-size: 11px; border-radius: 4px; }
                .test-btn { background-color: #444; color: #fff; border: 1px solid #666; border-radius: 4px; cursor: pointer; padding: 2px 8px; font-size: 10px; transition: background 0.2s; }
                .test-btn:hover { background-color: #666; }
                .style-select { background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; font-size: 10px; padding: 2px; }
                .voice-slider-container { display: flex; gap: 5px; margin-top: 2px; }
                .voice-slider-item { display: flex; flex-direction: column; width: 33%; font-size: 9px; color: #ccc; }
                .voice-slider-item input { width: 100%; margin: 0; }
                .voice-slider-header { display: flex; justify-content: space-between; }
                hr { border-color: #444; margin: 10px 0; }
            `;
            mainContainer.appendChild(customStyles);
            const contentWrapper = document.createElement('div');
            Object.assign(contentWrapper.style, { position: 'relative', flexGrow: '1', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' });

            const clockElement = document.createElement('div'); Object.assign(clockElement.style, { position: 'absolute', top: '10px', right: '10px', color: '#000000', fontSize: '18px', fontWeight: 'bold', textShadow: this.getWhiteOutline(), zIndex: '50', pointerEvents: 'none', fontFamily: 'monospace', whiteSpace: 'nowrap' }); setInterval(() => { const now = new Date(); clockElement.textContent = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`; }, 1000);
            const pingElement = document.createElement('div'); Object.assign(pingElement.style, { position: 'absolute', top: '10px', left: '10px', color: '#000000', fontSize: '16px', fontWeight: 'bold', textShadow: this.getWhiteOutline(), zIndex: '50', pointerEvents: 'none', fontFamily: 'monospace', whiteSpace: 'nowrap', display: 'flex', gap: '5px' }); const pingCldSpan = document.createElement('span'); pingCldSpan.style.color = '#00ffff'; pingCldSpan.textContent = "CLD: --ms"; const pingDiviSpan = document.createElement('span'); pingDiviSpan.style.color = '#000000'; pingDiviSpan.textContent = "|"; const pingTtsSpan = document.createElement('span'); pingTtsSpan.style.color = '#ff00ff'; pingTtsSpan.textContent = "TTS: --ms"; pingElement.append(pingCldSpan, pingDiviSpan, pingTtsSpan);

            // 【変更】リソース表示の右端に 3% の余白を追加
            const resourceElement = document.createElement('div'); Object.assign(resourceElement.style, { position: 'absolute', bottom: '10px', right: '3%', color: '#ffffff', fontSize: '16px', fontWeight: 'bold', textShadow: this.getGreenOutline(), zIndex: '50', pointerEvents: 'none', fontFamily: 'monospace', whiteSpace: 'nowrap' }); resourceElement.textContent = `CPU: --% | GPU: --% | MEM: --MB`;

            const statusContainer = document.createElement('div'); Object.assign(statusContainer.style, { position: 'absolute', top: '40px', left: '5%', backgroundColor: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', zIndex: '25', pointerEvents: 'none' });
            const statusTextValue = document.createElement('div'); Object.assign(statusTextValue.style, { fontSize: '24px', fontWeight: 'bold', color: '#000000', textAlign: 'left', marginBottom: '2px' }); statusContainer.appendChild(statusTextValue);
            const micStatusContainer = document.createElement('div'); Object.assign(micStatusContainer.style, { fontSize: '14px', fontWeight: 'bold', color: '#555', textAlign: 'left', textShadow: '1px 1px 2px rgba(255,255,255,0.8)' }); statusContainer.appendChild(micStatusContainer);

            const transcriptContainer = document.createElement('div'); Object.assign(transcriptContainer.style, { position: 'absolute', top: '90px', right: '10%', transform: 'translateY(-50%)', backgroundColor: 'transparent', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', zIndex: '25', pointerEvents: 'none' });
            const systemIcon = document.createElement('div'); systemIcon.className = "icon-spin"; Object.assign(systemIcon.style, { fontSize: '72px', color: '#000000', willChange: 'transform' }); transcriptContainer.append(systemIcon);
            const displayArea = document.createElement('div'); Object.assign(displayArea.style, { width: '100%', flexGrow: '1', backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center bottom', backgroundColor: 'transparent', transform: 'translateZ(0)', willChange: 'background-image' });
            const vizCanvas = document.createElement('canvas'); vizCanvas.id = 'vizCanvas'; Object.assign(vizCanvas.style, { position: 'absolute', bottom: '0', left: '0', width: '100%', height: '60px', pointerEvents: 'none', zIndex: '15', opacity: '0.7', backgroundColor: 'transparent', transform: 'translateZ(0)' }); vizCanvas.width = 300; vizCanvas.height = 60;

            contentWrapper.append(clockElement, pingElement, resourceElement, displayArea, statusContainer, transcriptContainer, vizCanvas);

            // 【変更】マイクバーの幅を 16px -> 8px に変更
            const micVizCanvas = document.createElement('canvas'); micVizCanvas.id = 'micVizCanvas'; Object.assign(micVizCanvas.style, { width: '8px', height: '100%', background: '#222', borderLeft: '1px solid #444', flexShrink: '0', transform: 'translateZ(0)' }); micVizCanvas.width = 8; micVizCanvas.height = 600;

            // 【変更】コンテナ背景を黒(#000)に戻し、文字のフチドリはそのまま維持
            const btnContainer = document.createElement('div'); Object.assign(btnContainer.style, { width: '60px', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '15px', paddingBottom: '15px', gap: '10px', flexShrink: '0', backgroundColor: '#000', zIndex: '30' });
            const baseBtnStyle = { width: '50px', height: '50px', border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '35px', fontWeight: 'bold', padding: '0', textShadow: '2px 2px 4px rgba(0,0,0,0.8), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' };
            const btnRestore = document.createElement('button'); btnRestore.textContent = '⏼'; Object.assign(btnRestore.style, baseBtnStyle); btnRestore.style.fontSize = '40px';
            const btn1 = document.createElement('button'); btn1.textContent = "①"; Object.assign(btn1.style, baseBtnStyle);
            const btn2 = document.createElement('button'); btn2.textContent = "②"; Object.assign(btn2.style, baseBtnStyle);
            const btn3 = document.createElement('button'); btn3.textContent = "③"; Object.assign(btn3.style, baseBtnStyle);
            const btn4 = document.createElement('button'); btn4.textContent = "④"; Object.assign(btn4.style, baseBtnStyle);
            const btn5 = document.createElement('button'); btn5.textContent = "⑤"; Object.assign(btn5.style, baseBtnStyle);
            const btnPower = document.createElement('button'); btnPower.textContent = '⏻'; Object.assign(btnPower.style, baseBtnStyle); btnPower.style.fontSize = '45px'; btnPower.style.marginTop = 'auto'; btnPower.style.marginBottom = '25px';
            btnContainer.append(btnRestore, btn1, btn2, btn3, btn4, btn5, btnPower); mainContainer.append(contentWrapper, micVizCanvas, btnContainer);
            this.elements = { mainContainer, displayArea, statusTextValue, micStatusContainer, systemIcon, vizCanvas, micVizCanvas, pingCldSpan, pingTtsSpan, resourceElement, btnRestore, btn1, btn2, btn3, btn4, btn5, btnPower };
            this.buildSettingsPanels(); this.attachEvents();
        },

        getWhiteOutline() { if(!this.whiteShadowCache) this.whiteShadowCache = `1px 1px 0 #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 0px 1px 0 #fff, 0px -1px 0 #fff, 1px 0px 0 #fff, -1px 0px 0 #fff, 2px 2px 0 #fff, -2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff, 0px 2px 0 #fff, 0px -2px 0 #fff, 2px 0px 0 #fff, -2px 0px 0 #fff`; return this.whiteShadowCache; },
        getGreenOutline() { if(!this.greenShadowCache) this.greenShadowCache = `1px 1px 0 #006600, -1px -1px 0 #006600, 1px -1px 0 #006600, -1px 1px 0 #006600, 0px 1px 0 #006600, 0px -1px 0 #006600, 1px 0px 0 #006600, -1px 0px 0 #006600, 2px 2px 0 #006600, -2px -2px 0 #006600, 2px -2px 0 #006600, -2px 2px 0 #006600, 0px 2px 0 #006600, 0px -2px 0 #006600, 2px 0px 0 #006600, -2px 0px 0 #006600`; return this.greenShadowCache; },
        getRichColorOutline(outerColor) { if(this.shadowCache[outerColor]) return this.shadowCache[outerColor]; const w = '#ffffff'; const c = outerColor; const shadow = `2px 2px 0 ${w}, -2px -2px 0 ${w}, 2px -2px 0 ${w}, -2px 2px 0 ${w}, 0px 2px 0 ${w}, 0px -2px 0 ${w}, 2px 0px 0 ${w}, -2px 0px 0 ${w}, 1px 1px 0 ${w}, -1px -1px 0 ${w}, 1px -1px 0 ${w}, -1px 1px 0 ${w}, 4px 4px 0 ${c}, -4px -4px 0 ${c}, 4px -4px 0 ${c}, -4px 4px 0 ${c}, 0px 4px 0 ${c}, 0px -4px 0 ${c}, 4px 0px 0 ${c}, -4px 0px 0 ${c}, 3px 3px 0 ${c}, -3px -3px 0 ${c}, 3px -3px 0 ${c}, -3px 3px 0 ${c}`; this.shadowCache[outerColor] = shadow; return shadow; },

        buildSettingsPanels() {
            const createPanel = (id) => {
                const p = document.createElement('div'); Object.assign(p.style, { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', backgroundColor: 'rgba(15, 15, 15, 0.98)', color: '#fff', zIndex: '100', display: 'none', flexDirection: 'column', padding: '20px', boxSizing: 'border-box' });
                const scroll = document.createElement('div'); scroll.style.flexGrow = '1'; scroll.style.overflowY = 'auto'; scroll.style.paddingRight = '5px';
                const close = document.createElement('button'); close.textContent = "✕"; Object.assign(close.style, { position: 'absolute', top: '15px', right: '7px', width: '36px', height: '36px', borderRadius: '50%', background: '#333', border: '1px solid #ffccff', color: '#fff', zIndex: '110', cursor: 'pointer' });
                close.onclick = (e) => { e.stopPropagation(); p.style.display = 'none'; }; p.append(scroll, close); this.elements.mainContainer.appendChild(p); return { panel: p, scroll: scroll };
            };
            const uiHelpers = {
                createSlider: (label, key, min, max, step) => {
                    const wrap = document.createElement('div'); wrap.style.marginBottom = '12px'; const header = document.createElement('div'); header.style.cssText = 'display:flex; justify-content:space-between; font-size:12px;'; const lSpan = document.createElement('span'); lSpan.textContent = label; const vSpan = document.createElement('span'); vSpan.textContent = Settings.data[key]; header.append(lSpan, vSpan); const input = document.createElement('input'); Object.assign(input, { type: 'range', min, max, step, value: Settings.data[key], style: 'width:100%' }); input.oninput = (e) => { Settings.data[key] = parseFloat(e.target.value); vSpan.textContent = Settings.data[key]; }; input.onchange = (e) => { Settings.save(); TTS.clearCache(); }; wrap.append(header, input); return wrap;
                },
                createColorInput: (label, key) => {
                    const wrap = document.createElement('div'); wrap.style.marginBottom = '12px'; const header = document.createElement('div'); header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; font-size:12px;'; const lSpan = document.createElement('span'); lSpan.textContent = label; const input = document.createElement('input'); Object.assign(input, { type: 'color', value: Settings.data[key], style: 'cursor:pointer; width:50px; height:25px; border:none; background:transparent;' }); input.oninput = (e) => { Settings.data[key] = e.target.value; UI.elements.mainContainer.style.backgroundColor = Settings.data[key]; Settings.save(); }; header.append(lSpan, input); wrap.appendChild(header); return wrap;
                },
                createSimpleTextInput: (label, key, placeholder) => {
                    const wrap = document.createElement('div'); wrap.style.marginBottom = '10px';
                    const header = document.createElement('div'); header.style.cssText = 'font-size:12px; margin-bottom:4px; font-weight:bold; color:#aaffaa;'; header.textContent = label;
                    const input = document.createElement('input'); Object.assign(input, { type: 'text', value: Settings.data[key] || "", placeholder: placeholder, className: 'setting-input' });
                    input.onchange = (e) => { Settings.data[key] = e.target.value; Settings.save(); };
                    wrap.append(header, input); return wrap;
                },
                createAdvancedVoiceInput: (label, key, placeholder) => {
                    const wrap = document.createElement('div'); wrap.style.cssText = 'margin-bottom: 12px; background: rgba(50,50,50,0.5); padding: 8px; border-radius: 6px; border-left: 3px solid #ffccff;';
                    const header = document.createElement('div'); header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; font-size:12px; margin-bottom:4px;';
                    const leftDiv = document.createElement('div'); leftDiv.style.cssText = 'display:flex; align-items:center; gap:5px;';
                    const lSpan = document.createElement('span'); lSpan.textContent = label; lSpan.style.fontWeight = 'bold'; leftDiv.appendChild(lSpan);

                    const sSel = document.createElement('select'); sSel.className = "style-select"; sSel.innerHTML = `<option value="default">🗣️基本</option><option value="61">🐰通常</option><option value="62">😲おどろき</option><option value="63">🤫ひそひそ</option><option value="64">😵へろへろ</option>`; sSel.value = Settings.data[`style_${key}`] || "default";
                    sSel.onchange = (e) => { Settings.data[`style_${key}`] = e.target.value; Settings.save(); TTS.clearCache(); };
                    leftDiv.appendChild(sSel); header.appendChild(leftDiv);

                    const testBtn = document.createElement('button'); testBtn.textContent = "▶"; testBtn.className = "test-btn"; testBtn.onclick = (e) => { e.stopPropagation(); if (Settings.data[key]) TTS.enqueue(Settings.data[key], key); }; header.appendChild(testBtn);

                    const input = document.createElement('input'); Object.assign(input, { type: 'text', value: Settings.data[key] || "", placeholder: placeholder, className: 'setting-input' }); input.onchange = (e) => { Settings.data[key] = e.target.value; Settings.save(); TTS.clearCache(); };

                    const sContainer = document.createElement('div'); sContainer.className = "voice-slider-container";
                    const mkSlider = (sLbl, sKey, min, max, step) => {
                        const sItem = document.createElement('div'); sItem.className = "voice-slider-item";
                        const sHead = document.createElement('div'); sHead.className = "voice-slider-header";
                        const valSpan = document.createElement('span');
                        let initVal = Settings.data[`${sKey}_${key}`] !== undefined ? Settings.data[`${sKey}_${key}`] : Settings.data[sKey];
                        valSpan.textContent = Number(initVal).toFixed(2);
                        const sInput = document.createElement('input'); Object.assign(sInput, { type: 'range', min, max, step, value: initVal });
                        sInput.oninput = (e) => { valSpan.textContent = parseFloat(e.target.value).toFixed(2); };
                        sInput.onchange = (e) => { Settings.data[`${sKey}_${key}`] = parseFloat(e.target.value); Settings.save(); TTS.clearCache(); };
                        sHead.append(document.createTextNode(sLbl), valSpan); sItem.append(sHead, sInput); return sItem;
                    };
                    sContainer.append(mkSlider("高音", "pitch", -0.15, 0.15, 0.01), mkSlider("話速", "speed", 0.5, 2.0, 0.1), mkSlider("抑揚", "intonation", 0.0, 2.0, 0.1));
                    wrap.append(header, input, sContainer); return wrap;
                },
                createAdvancedVoiceRandomInput: (label, baseKey) => {
                    const wrap = document.createElement('div'); wrap.style.cssText = 'margin-bottom: 12px; background: rgba(50,50,50,0.5); padding: 8px; border-radius: 6px; border-left: 3px solid #ffccff;';
                    const header = document.createElement('div'); header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; font-size:12px; margin-bottom:4px;';
                    const leftDiv = document.createElement('div'); leftDiv.style.cssText = 'display:flex; align-items:center; gap:5px;';
                    const lSpan = document.createElement('span'); lSpan.textContent = label; lSpan.style.fontWeight = 'bold'; leftDiv.appendChild(lSpan);

                    const sSel = document.createElement('select'); sSel.className = "style-select"; sSel.innerHTML = `<option value="default">🗣️基本</option><option value="61">🐰通常</option><option value="62">😲おどろき</option><option value="63">🤫ひそひそ</option><option value="64">😵へろへろ</option>`; sSel.value = Settings.data[`style_${baseKey}`] || "default";
                    sSel.onchange = (e) => { Settings.data[`style_${baseKey}`] = e.target.value; Settings.save(); TTS.clearCache(); };
                    leftDiv.appendChild(sSel); header.appendChild(leftDiv);

                    const testBtn = document.createElement('button'); testBtn.textContent = "▶"; testBtn.className = "test-btn";
                    testBtn.onclick = (e) => {
                        e.stopPropagation();
                        const texts = [Settings.data[`${baseKey}_1`], Settings.data[`${baseKey}_2`], Settings.data[`${baseKey}_3`]].filter(t => t && t.trim() !== "");
                        if(texts.length > 0) TTS.enqueue(texts[Math.floor(Math.random() * texts.length)], baseKey);
                    };
                    header.appendChild(testBtn); wrap.appendChild(header);

                    for(let i=1; i<=3; i++) {
                        const input = document.createElement('input'); Object.assign(input, { type: 'text', value: Settings.data[`${baseKey}_${i}`] || "", placeholder: `セリフ ${i}`, className: 'setting-input' });
                        input.onchange = (e) => { Settings.data[`${baseKey}_${i}`] = e.target.value; Settings.save(); TTS.clearCache(); };
                        wrap.appendChild(input);
                    }

                    const sContainer = document.createElement('div'); sContainer.className = "voice-slider-container";
                    const mkSlider = (sLbl, sKey, min, max, step) => {
                        const sItem = document.createElement('div'); sItem.className = "voice-slider-item";
                        const sHead = document.createElement('div'); sHead.className = "voice-slider-header";
                        const valSpan = document.createElement('span');
                        let initVal = Settings.data[`${sKey}_${baseKey}`] !== undefined ? Settings.data[`${sKey}_${baseKey}`] : Settings.data[sKey];
                        valSpan.textContent = Number(initVal).toFixed(2);
                        const sInput = document.createElement('input'); Object.assign(sInput, { type: 'range', min, max, step, value: initVal });
                        sInput.oninput = (e) => { valSpan.textContent = parseFloat(e.target.value).toFixed(2); };
                        sInput.onchange = (e) => { Settings.data[`${sKey}_${baseKey}`] = parseFloat(e.target.value); Settings.save(); TTS.clearCache(); };
                        sHead.append(document.createTextNode(sLbl), valSpan); sItem.append(sHead, sInput); return sItem;
                    };
                    sContainer.append(mkSlider("高音", "pitch", -0.15, 0.15, 0.01), mkSlider("話速", "speed", 0.5, 2.0, 0.1), mkSlider("抑揚", "intonation", 0.0, 2.0, 0.1));
                    wrap.appendChild(sContainer); return wrap;
                },
                createStatusConfigRow: (label, txtKey, iconKey) => { const wrap = document.createElement('div'); wrap.style.marginBottom = '12px'; const header = document.createElement('div'); header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; font-size:12px; margin-bottom:4px; color:#ffccff;'; const lSpan = document.createElement('span'); lSpan.textContent = label; header.appendChild(lSpan); const inputRow = document.createElement('div'); inputRow.style.cssText = 'display:flex; gap: 8px;'; const iconInput = document.createElement('input'); Object.assign(iconInput, { type: 'text', value: Settings.data[iconKey], className: 'setting-input', style: 'width: 40px; text-align: center; margin-bottom:0;' }); iconInput.placeholder = "🐰"; iconInput.onchange = (e) => { Settings.data[iconKey] = e.target.value; Settings.save(); UI.sync(); }; const txtInput = document.createElement('input'); Object.assign(txtInput, { type: 'text', value: Settings.data[txtKey], className: 'setting-input', style: 'flex-grow: 1; margin-bottom:0;' }); txtInput.placeholder = "テキスト"; txtInput.onchange = (e) => { Settings.data[txtKey] = e.target.value; Settings.save(); UI.sync(); }; inputRow.append(iconInput, txtInput); wrap.append(header, inputRow); return wrap; },
                createBGInput: (label, key, placeholder = "画像URL") => { const wrap = document.createElement('div'); wrap.style.marginBottom = '8px'; const l = document.createElement('div'); l.textContent = label; l.style.cssText = 'font-size:12px; margin-bottom:4px;'; const input = document.createElement('input'); Object.assign(input, { type: 'text', value: Settings.bgData[key], placeholder: placeholder, className: 'setting-input' }); const saveHandler = (e) => { Settings.saveBg(key, e.target.value); UI.updateBackgroundImage(); }; input.onchange = saveHandler; input.oninput = saveHandler; wrap.append(l, input); return wrap; },
                createBGGroup: (title, stateKey, hasSpeed = true, imageCount = 2) => {
                    const group = document.createElement('div'); group.className = "setting-group";
                    const titleEl = document.createElement('div'); titleEl.className = "setting-group-title"; titleEl.textContent = title; group.appendChild(titleEl);
                    for(let i=1; i<=imageCount; i++) {
                        const label = (stateKey === "SPEAKING") ? (i===1 ? "画像URL① (通常)" : "画像URL② (変化)") : `画像URL${i}`;
                        group.appendChild(uiHelpers.createBGInput(label, `${stateKey}_${i}`));
                        if (hasSpeed) {
                            const speedKey = `speed_${stateKey}_${i}`;
                            if(Settings.data[speedKey] === undefined) Settings.data[speedKey] = 0.5;
                            group.appendChild(uiHelpers.createSlider(`↳ 表示時間${i} (秒)`, speedKey, 0.1, 5.0, 0.1));
                        }
                    }
                    return group;
                },
                createRandomBGGroup: (title, stateKey) => {
                    const group = document.createElement('div'); group.className = "setting-group";
                    const titleEl = document.createElement('div'); titleEl.className = "setting-group-title"; titleEl.textContent = title + " (ランダム抽出)"; group.appendChild(titleEl);
                    for(let i=1; i<=3; i++) group.appendChild(uiHelpers.createBGInput(`ランダム画像 ${i}`, `${stateKey}_${i}`));
                    return group;
                }
            };

            // パネル1
            const p1 = createPanel('1'); this.elements.panel1 = p1.panel;
            const saveSizeBtn = document.createElement('button'); saveSizeBtn.textContent = "現在のPiPサイズを記憶"; saveSizeBtn.className = "test-btn"; saveSizeBtn.style.cssText = "width: 100%; margin-bottom: 15px; padding: 10px; font-weight: bold; font-size: 13px;"; saveSizeBtn.onclick = (e) => { e.stopPropagation(); if(UI.pipWindow) { Settings.data.savedPipWidth = UI.pipWindow.innerWidth; Settings.data.savedPipHeight = UI.pipWindow.innerHeight; Settings.save(); alert(`記憶しました`); } }; p1.scroll.append(saveSizeBtn, uiHelpers.createColorInput("背景色", "bgColor"), document.createElement('hr'));
            p1.scroll.appendChild(uiHelpers.createSlider("受付モード維持時間 (秒)", "hotModeDuration", 10, 300, 10));
            p1.scroll.appendChild(uiHelpers.createSlider("オートスリープ時間 (秒)", "autoSleepTime", 30, 600, 10));
            ["全体音量", "打鍵/ピポ音", "基本の話速", "基本の高音", "基本の抑揚"].forEach((l, i) => p1.scroll.appendChild(uiHelpers.createSlider(l, ["volume", "beepVolume", "speed", "pitch", "intonation"][i], i === 3 ? -0.15 : (i === 2 ? 0.5 : 0), 2, 0.1)));
            p1.scroll.appendChild(uiHelpers.createSlider("口パク感度", "lipSyncThreshold", 1, 100, 1));
            this.elements.speakerListContainer = document.createElement('div'); Object.assign(this.elements.speakerListContainer.style, { marginTop: '10px', padding: '10px', backgroundColor: '#222', borderRadius: '8px', fontSize: '12px' }); p1.scroll.appendChild(this.elements.speakerListContainer);

            // パネル2
            const p2 = createPanel('2'); this.elements.panel2 = p2.panel;
            const wordGroup = document.createElement('div'); wordGroup.className = "setting-group";
            wordGroup.append(uiHelpers.createSimpleTextInput("① 名前 (ウェイクワード)", "wakeWord", "例: うさぎちゃん"), uiHelpers.createSimpleTextInput("② 終了ワード", "exitWord", "例: ありがとう"), uiHelpers.createSimpleTextInput("③ おやすみワード", "sleepWord", "例: おやすみ"));
            p2.scroll.appendChild(wordGroup);
            p2.scroll.append(
                uiHelpers.createAdvancedVoiceInput("名前を呼ばれた時の返事", "wakeWordReply", "例: はい、なんです？"),
                uiHelpers.createAdvancedVoiceInput("終了ワードの返事", "exitReply", "例: どういたしまして。"),
                uiHelpers.createAdvancedVoiceInput("おやすみワードの返事", "sleepReply", "例: おやすみなさい。"),
                uiHelpers.createAdvancedVoiceInput("システム起動時", "startupMessage", ""),
                uiHelpers.createAdvancedVoiceInput("AI思考完了時", "finishedThinkingMessage", ""),
                uiHelpers.createAdvancedVoiceInput("システム復帰時", "resumeMessage", ""),
                document.createElement('hr'),
                uiHelpers.createAdvancedVoiceRandomInput("リアクション: 驚く", "reactionSpeechSurprised"),
                uiHelpers.createAdvancedVoiceRandomInput("リアクション: しょんぼり", "reactionSpeechSad"),
                uiHelpers.createAdvancedVoiceRandomInput("リアクション: 怒る", "reactionSpeechAngry")
            );

            // パネル3
            const p3 = createPanel('3'); this.elements.panel3 = p3.panel;
            p3.scroll.append(uiHelpers.createBGGroup("待機中 (IDLE)", "IDLE", true, 2), uiHelpers.createBGGroup("思考中 (BUSY)", "BUSY", true, 3), uiHelpers.createBGGroup("発話中 (SPEAKING)", "SPEAKING", false, 2), uiHelpers.createBGGroup("停止中 (STOPPED)", "STOPPED", true, 2), uiHelpers.createBGGroup("接続中 (SEARCHING)", "SEARCHING", true, 2), uiHelpers.createBGGroup("聞き取り中 (LISTENING)", "LISTENING", true, 2), uiHelpers.createBGGroup("困惑 (BLOCKED)", "BLOCKED", true, 2));

            // パネル4
            const p4 = createPanel('4'); this.elements.panel4 = p4.panel;
            p4.scroll.append(
                uiHelpers.createSlider("リアクション表示時間", "reactionDuration", 0.5, 5.0, 0.1),
                document.createElement('hr'),
                uiHelpers.createRandomBGGroup("驚く", "REACTION_SURPRISED"),
                uiHelpers.createRandomBGGroup("しょんぼり", "REACTION_SAD"),
                uiHelpers.createRandomBGGroup("怒る", "REACTION_ANGRY"),
                uiHelpers.createRandomBGGroup("起きる (復帰時)", "REACTION_WAKEUP")
            );

            // パネル5
            const p5 = createPanel('5'); this.elements.panel5 = p5.panel;
            p5.scroll.append(uiHelpers.createStatusConfigRow("待機中 (IDLE)", "txt_IDLE", "icon_IDLE"), uiHelpers.createStatusConfigRow("思考中 (BUSY)", "txt_BUSY", "icon_BUSY"), uiHelpers.createStatusConfigRow("発話中 (SPEAKING)", "txt_SPEAKING", "icon_SPEAKING"), uiHelpers.createStatusConfigRow("停止中 (STOPPED)", "txt_STOPPED", "icon_STOPPED"), uiHelpers.createStatusConfigRow("接続中 (SEARCHING)", "txt_SEARCHING", "icon_SEARCHING"), uiHelpers.createStatusConfigRow("聞き取り中 (LISTENING)", "txt_LISTENING", "icon_LISTENING"), uiHelpers.createStatusConfigRow("困惑 (BLOCKED)", "txt_BLOCKED", "icon_BLOCKED"), uiHelpers.createStatusConfigRow("受付中 (HOTMODE)", "txt_HOTMODE", "icon_HOTMODE"));
        },
        attachEvents() {
            const els = this.elements;
            els.btn1.onclick = (e) => { e.stopPropagation(); this.hideAllPanels(); els.panel1.style.display = 'flex'; }; els.btn2.onclick = (e) => { e.stopPropagation(); this.hideAllPanels(); els.panel2.style.display = 'flex'; }; els.btn3.onclick = (e) => { e.stopPropagation(); this.hideAllPanels(); els.panel3.style.display = 'flex'; }; els.btn4.onclick = (e) => { e.stopPropagation(); this.hideAllPanels(); els.panel4.style.display = 'flex'; }; els.btn5.onclick = (e) => { e.stopPropagation(); this.hideAllPanels(); els.panel5.style.display = 'flex'; };
            els.btnRestore.onclick = (e) => { e.stopPropagation(); this.hideAllPanels(); if (this.pipWindow && Settings.data.savedPipWidth && Settings.data.savedPipHeight) { const diffW = this.pipWindow.outerWidth - this.pipWindow.innerWidth; const diffH = this.pipWindow.outerHeight - this.pipWindow.innerHeight; this.pipWindow.resizeTo(Settings.data.savedPipWidth + diffW, Settings.data.savedPipHeight + diffH); } };
            els.btnPower.onclick = (e) => { e.stopPropagation(); this.hideAllPanels(); State.autoRestart = !State.autoRestart; if (!State.autoRestart && State.isSpeaking) TTS.stop(); if (State.hotModeTimeLeft > 0) { State.hotModeTimeLeft = 0; if (Speech.visualTimer) clearInterval(Speech.visualTimer); } State.autoSleepTimeLeft = Settings.data.autoSleepTime; this.sync(); };
            els.mainContainer.onclick = (e) => {
                if (els.panel1.style.display === 'flex' || els.panel2.style.display === 'flex' || els.panel3.style.display === 'flex' || els.panel4.style.display === 'flex' || els.panel5.style.display === 'flex') return;
                const heart = document.createElement('div'); heart.className = 'heart-effect'; heart.textContent = '❤'; heart.style.left = e.clientX + 'px'; heart.style.top = e.clientY + 'px'; els.mainContainer.appendChild(heart); setTimeout(() => heart.remove(), 1200); AudioModule.playTapSound();
                State.autoSleepTimeLeft = Settings.data.autoSleepTime;

                const playRndVoice = (baseKey) => {
                    const texts = [Settings.data[`${baseKey}_1`], Settings.data[`${baseKey}_2`], Settings.data[`${baseKey}_3`]].filter(t => t && t.trim() !== "");
                    if(texts.length > 0) TTS.enqueue(texts[Math.floor(Math.random() * texts.length)], baseKey);
                };

                if (!State.autoRestart) { State.autoRestart = true; this.sync(); this.triggerReaction("REACTION_WAKEUP"); setTimeout(() => { if (Settings.data.resumeMessage) TTS.enqueue(Settings.data.resumeMessage, "resumeMessage"); }, 1000); }
                else if (State.isSpeaking) { TTS.stop(); this.triggerReaction("REACTION_SAD"); playRndVoice("reactionSpeechSad"); }
                else if (State.current === "BUSY" || State.isGenerating) { this.triggerReaction("REACTION_ANGRY"); playRndVoice("reactionSpeechAngry"); }
                else { this.triggerReaction("REACTION_SURPRISED"); playRndVoice("reactionSpeechSurprised"); }
                if (State.hotModeTimeLeft > 0) { State.hotModeTimeLeft = 0; if (Speech.visualTimer) clearInterval(Speech.visualTimer); this.sync(); }
            };
        },
        hideAllPanels() { ['panel1', 'panel2', 'panel3', 'panel4', 'panel5'].forEach(k => { if(this.elements[k]) this.elements[k].style.display = 'none'; }); },

        triggerReaction(reactionKey) {
            State.activeReaction = reactionKey;
            const validIdx = [];
            for(let i=1; i<=3; i++) { if(Settings.bgData[`${reactionKey}_${i}`]) validIdx.push(i); }
            State.activeReactionIndex = validIdx.length > 0 ? validIdx[Math.floor(Math.random() * validIdx.length)] : 1;

            this.updateBackgroundImage();
            if (State.reactionTimer) clearTimeout(State.reactionTimer);
            State.reactionTimer = setTimeout(() => { State.activeReaction = null; this.updateBackgroundImage(); }, (Settings.data.reactionDuration || 2.0) * 1000);
        },

        updateBackgroundImage() {
            if (!this.elements.displayArea) return;
            if (State.activeReaction) {
                const url = Settings.bgData[`${State.activeReaction}_${State.activeReactionIndex}`] || Settings.bgData[`${State.activeReaction}_1`];
                if (url) { const bgUrl = `url(${url})`; if(this.elements.displayArea.style.backgroundImage !== bgUrl) this.elements.displayArea.style.backgroundImage = bgUrl; return; }
            }
            let key = !State.autoRestart ? "STOPPED" : (State.isSpeaking ? "SPEAKING" : (State.isRecognizing ? "LISTENING" : State.current));

            let maxImgs = (key === "BUSY") ? 3 : 2;
            let vUrls = [];
            for(let i=1; i<=maxImgs; i++) {
                let u = Settings.bgData[`${key}_${i}`];
                if (u && u.trim() !== "") vUrls.push({ url: u, idx: i });
            }

            if (vUrls.length === 0) {
                if (key === "BLOCKED" && Settings.bgData["REACTION_ANGRY_1"]) vUrls = [{url: Settings.bgData["REACTION_ANGRY_1"], idx: 1}];
                else if (Settings.bgData["IDLE_1"]) vUrls = [{url: Settings.bgData["IDLE_1"], idx: 1}];
            }
            if (vUrls.length === 0) return;

            let finalBG = '';
            if (State.isSpeaking && AudioModule.analyser) {
                const data = new Uint8Array(AudioModule.analyser.frequencyBinCount); AudioModule.analyser.getByteFrequencyData(data);
                let sum = 0; for(let i=0; i<data.length; i++) sum += data[i];
                const isOpen = sum / data.length > Settings.data.lipSyncThreshold;
                const currentFrame = (isOpen && vUrls.length > 1) ? vUrls[1] : vUrls[0];
                finalBG = currentFrame.url;
                State.currentFrameSpeed = Settings.data[`speed_${key}_${currentFrame.idx}`] || 0.5;
            } else {
                const currentFrame = vUrls[State.animStep % vUrls.length];
                finalBG = currentFrame.url;
                State.currentFrameSpeed = Settings.data[`speed_${key}_${currentFrame.idx}`] || 0.5;
            }
            const targetUrl = `url(${finalBG})`; if(this.elements.displayArea.style.backgroundImage !== targetUrl) this.elements.displayArea.style.backgroundImage = targetUrl;
        },
        startAnimationLoop() {
            if (State.animTimeout) clearTimeout(State.animTimeout);
            const run = () => {
                if (!State.isSpeaking && !State.activeReaction) {
                    State.animStep++;
                    this.updateBackgroundImage();
                }
                const delay = (State.currentFrameSpeed || 0.5) * 1000;
                State.animTimeout = setTimeout(run, delay);
            };
            run();
        },
        sync(forceMessage = null, isError = false) {
            const isMuted = (!State.autoRestart || State.isSpeaking || State.current === "BUSY" || State.isGenerating);
            if (Speech.recognition) { if (isMuted && State.isRecognizing) { try { Speech.recognition.stop(); } catch(e){} } else if (!isMuted && !State.isRecognizing && State.autoRestart) { setTimeout(() => { if (!State.isRecognizing && State.autoRestart) try { Speech.recognition.start(); } catch(e){} }, 300); } }
            let curKey = !State.autoRestart ? "STOPPED" : (State.isRecognizing ? "LISTENING" : State.current);
            if (State.lastAnimStateKey !== curKey) { State.lastAnimStateKey = curKey; State.animStep = 0; this.startAnimationLoop(); } else this.updateBackgroundImage();
            let fT = "", sI = "", oC = "";
            if (forceMessage) { sI = isError ? "⚠️" : "ℹ️"; fT = forceMessage; oC = isError ? "#ff0000" : "#ff00ff"; }
            else if (!State.autoRestart) { sI = Settings.data.icon_STOPPED; fT = Settings.data.txt_STOPPED; oC = "#888888"; }
            else if (State.isRecognizing) { sI = Settings.data.icon_LISTENING; fT = `${Settings.data.txt_LISTENING} (${State.autoSleepTimeLeft}s)`; oC = "#00ffaa"; }
            else if (State.current === "SEARCHING") { sI = Settings.data.icon_SEARCHING; fT = `${Settings.data.txt_SEARCHING} (${State.autoSleepTimeLeft}s)`; oC = "#ffff00"; }
            else if (State.current === "BLOCKED") { sI = Settings.data.icon_BLOCKED; fT = Settings.data.txt_BLOCKED; oC = "#ff6600"; }
            else if (State.current === "BUSY" || State.isGenerating) { sI = Settings.data.icon_BUSY; fT = Settings.data.txt_BUSY; oC = "#88aaff"; }
            else if (State.isSpeaking) { sI = Settings.data.icon_SPEAKING; fT = Settings.data.txt_SPEAKING || "発話中..."; oC = "#ff00ff"; }
            else if (State.hotModeTimeLeft > 0) { sI = Settings.data.icon_HOTMODE; fT = `${Settings.data.txt_HOTMODE} (${State.hotModeTimeLeft}s)`; oC = State.hotModeTimeLeft <= 10 ? "#ff0000" : "#00ffff"; }
            else { sI = Settings.data.icon_IDLE; fT = `${Settings.data.txt_IDLE} (${State.autoSleepTimeLeft}s)`; oC = "#ff00ff"; }
            if (this.elements.statusTextValue.textContent !== fT) { this.elements.statusTextValue.textContent = fT; this.elements.statusTextValue.style.textShadow = this.getRichColorOutline(oC); }
            if (this.elements.systemIcon.textContent !== sI) { this.elements.systemIcon.textContent = sI; this.elements.systemIcon.style.textShadow = this.getRichColorOutline(oC); }
            let micMsg = "", micCol = "";
            if (!State.autoRestart || State.isSpeaking || State.current === "BUSY" || State.isGenerating) { micMsg = "🔕 マイク一時停止"; micCol = "#aaaaaa"; }
            else if (State.hotModeTimeLeft > 0) { micMsg = `🎤 用件をどうぞ！ (${State.hotModeTimeLeft}s)`; micCol = "#ff4444"; }
            else { micMsg = `👂 「${Settings.data.wakeWord}」を待機中...`; micCol = "#00ccff"; }
            if (this.elements.micStatusContainer.textContent !== micMsg) { this.elements.micStatusContainer.textContent = micMsg; this.elements.micStatusContainer.style.color = micCol; }
        },
        startMicVisualizer() {
            const canvas = this.elements.micVizCanvas; const ctx = canvas.getContext('2d');
            const render = () => { if (!this.pipWindow || !AudioModule.micAnalyser) return; requestAnimationFrame(render); const data = new Uint8Array(AudioModule.micAnalyser.frequencyBinCount); AudioModule.micAnalyser.getByteFrequencyData(data); let sum = 0; for (let i = 0; i < data.length; i++) sum += data[i]; ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; ctx.fillRect(0, 0, canvas.width, canvas.height); const barH = ((sum / data.length) / 255) * canvas.height * 2.02; const grad = ctx.createLinearGradient(0, canvas.height, 0, 0); grad.addColorStop(0, '#ffff00'); grad.addColorStop(1, '#ff0000'); ctx.fillStyle = grad; ctx.fillRect(0, canvas.height - barH, canvas.width, barH); if (!State.autoRestart || State.isSpeaking || State.current === "BUSY" || State.isGenerating) { ctx.fillStyle = 'rgba(255, 0, 0, 0.3)'; ctx.fillRect(0, 0, canvas.width, canvas.height); } }; render();
        },
        startAudioVisualizer() {
            const canvas = this.elements.vizCanvas; const ctx = canvas.getContext('2d');
            const render = () => { requestAnimationFrame(render); if (!State.isSpeaking) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
                if(AudioModule.analyser) { const data = new Uint8Array(AudioModule.analyser.frequencyBinCount); AudioModule.analyser.getByteFrequencyData(data); ctx.clearRect(0, 0, canvas.width, canvas.height); const barW = (canvas.width / data.length) * 2.2; let x = 0; for (let i = 0; i < data.length; i++) { const h = (data[i] / 255) * canvas.height; const grad = ctx.createLinearGradient(0, canvas.height, 0, 0); grad.addColorStop(0, '#ff00ff'); grad.addColorStop(1, '#330033'); ctx.fillStyle = grad; ctx.fillRect(x, canvas.height - h, Math.ceil(barW), h); x += barW; if (x >= canvas.width) break; } }
            }; render();
        },
        async renderSpeakerList() { if (!this.pipWindow) return; GM_xmlhttpRequest({ method: "GET", url: "http://localhost:50021/speakers", onload: (res) => { const spks = JSON.parse(res.responseText); this.elements.speakerListContainer.textContent = ""; const lbl = this.pipWindow.document.createElement('div'); lbl.textContent = "基本の話者:"; lbl.style.cssText = "margin-bottom:5px; font-weight:bold;"; this.elements.speakerListContainer.appendChild(lbl); const sel = this.pipWindow.document.createElement('select'); Object.assign(sel.style, { width: '100%', padding: '8px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', fontSize: '14px', cursor: 'pointer' }); spks.forEach(s => s.styles.forEach(st => { const opt = this.pipWindow.document.createElement('option'); opt.value = st.id; opt.textContent = `${s.name} (${st.name})`; if (Settings.data.selectedSpeakerId === st.id) opt.selected = true; sel.appendChild(opt); })); sel.onchange = (e) => { Settings.data.selectedSpeakerId = parseInt(e.target.value, 10); Settings.save(); TTS.clearCache(); }; this.elements.speakerListContainer.appendChild(sel); }}); },
        createOverlay() {
            const overlay = document.createElement('div'); Object.assign(overlay.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: '2147483647', cursor: 'pointer', textAlign: 'center', backdropFilter: 'blur(5px)' });
            const wrapper = document.createElement('div'); wrapper.append(Object.assign(document.createElement('h2'), { textContent: "実況システム (Ver 20.90)" }), Object.assign(document.createElement('p'), { textContent: "UIレイアウト最適化モード。" }));
            overlay.appendChild(wrapper); document.body.appendChild(overlay);
            overlay.onclick = async () => {
                try {
                    document.querySelectorAll('.model-response-text').forEach(el => { el.setAttribute('data-spoken', 'true'); const cleanTxt = GeminiObserver.getCleanTextFast(el); if(cleanTxt) State.spokenSignatures.add(GeminiObserver.getSignature(cleanTxt)); });
                    this.pipWindow = await window.documentPictureInPicture.requestWindow({ width: Settings.data.pipWidth, height: Settings.data.pipHeight });
                    this.pipWindow.addEventListener("pagehide", () => { State.autoRestart = false; try { Speech.recognition.stop(); } catch(e){} State.isSpeaking = false; AudioModule.stopMic(); document.body.appendChild(this.elements.mainContainer); this.elements.mainContainer.style.display = 'none'; document.body.appendChild(overlay); overlay.style.display = 'flex'; });
                    this.pipWindow.addEventListener('resize', () => { Settings.data.pipWidth = this.pipWindow.innerWidth; Settings.data.pipHeight = this.pipWindow.innerHeight; Settings.save(); });
                    for (const sheet of document.styleSheets) { try { const style = this.pipWindow.document.createElement('style'); let rules = ""; for (const rule of sheet.cssRules) rules += rule.cssText; style.textContent = rules; this.pipWindow.document.head.appendChild(style); } catch (e) {} }
                    this.pipWindow.document.title = "実況システム"; this.pipWindow.document.body.style.margin = "0"; this.pipWindow.document.body.style.overflow = "hidden";
                    this.elements.mainContainer.style.display = 'flex'; this.pipWindow.document.body.appendChild(this.elements.mainContainer); overlay.style.display = 'none';
                    this.renderSpeakerList(); AudioModule.setupMic(); this.startAudioVisualizer(); TTS.preloadCache(); Monitor.start();
                    setTimeout(() => { State.autoRestart = true; State.autoSleepTimeLeft = Settings.data.autoSleepTime; this.sync(); if(Settings.data.startupMessage) TTS.enqueue(Settings.data.startupMessage, "startupMessage"); GeminiObserver.start(); setTimeout(() => { State.isSystemReady = true; }, 5000); }, 500);
                } catch (e) { alert("PiP起動失敗: " + e.message); }
            };
        }
    };

    // =====================================================================
    // 9. Gemini Observer
    // =====================================================================
    const GeminiObserver = {
        getCleanTextFast(element) { if (!element) return ""; const temp = element.cloneNode(true); temp.querySelectorAll('pre, code').forEach(el => el.remove()); temp.querySelectorAll('br').forEach(br => br.replaceWith(document.createTextNode('\n'))); temp.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6').forEach(el => el.appendChild(document.createTextNode('\n'))); return (temp.textContent || "").replace(/\n+/g, '\n').trim(); },
        getTargetText(text) { if (text.length < 50) return text; const idx = text.indexOf('\n', 50); return idx === -1 ? text : text.substring(0, idx + 1); },
        getSignature(text) { return text ? text.replace(/\s+|[。、！？.,!?"'()「」『』【】\[\]*`~_>\-]/g, '').substring(0, 40) : ""; },
        lastProcessTime: 0, processTimeout: null,
        start() {
            const executeProcess = () => {
                if (!UI.pipWindow) return;
                const responses = document.querySelectorAll('.model-response-text');
                const stopButton = document.querySelector('button[aria-label*="停止"], .generating-text, [purpose="r-stop-button"]');
                const searchingChip = document.querySelector('use-case-chip, .google-search-chip');
                const checkLimit = Math.max(0, responses.length - 2);
                for (let i = 0; i < checkLimit; i++) { if (!responses[i].hasAttribute('data-spoken')) { responses[i].setAttribute('data-spoken', 'true'); responses[i].dataset.readLength = responses[i].textContent.length.toString(); } }
                let activeResponse = null;
                for (let i = responses.length - 1; i >= checkLimit; i--) { const el = responses[i]; if (!el.hasAttribute('data-spoken')) { const fullText = this.getCleanTextFast(el); const sig = this.getSignature(fullText); if (State.spokenSignatures.has(sig) && fullText.length > 0) { el.setAttribute('data-spoken', 'true'); el.dataset.readLength = fullText.length.toString(); continue; } else { activeResponse = el; break; } } }
                if (activeResponse && !State.isSystemReady) { activeResponse.setAttribute('data-spoken', 'true'); activeResponse.dataset.readLength = activeResponse.textContent.length.toString(); const cleanTxt = this.getCleanTextFast(activeResponse); if(cleanTxt) State.spokenSignatures.add(this.getSignature(cleanTxt)); return; }
                const isCurrentlyGenerating = !!stopButton;
                if (!isCurrentlyGenerating && searchingChip && !State.isGenerating) { State.current = "SEARCHING"; UI.sync(); }
                else if (!isCurrentlyGenerating && !searchingChip && !State.isGenerating) { State.current = "IDLE"; UI.sync(); }
                if (isCurrentlyGenerating && !State.isGenerating) { State.isGenerating = true; State.current = "BUSY"; if (!State.autoRestart) State.autoRestart = true; if (activeResponse) { activeResponse.dataset.readLength = "0"; State.generatingTextLength = 0; } AudioModule.startTypingSound(); UI.sync(); }
                if (State.isGenerating && activeResponse) {
                    const fullText = this.getCleanTextFast(activeResponse); State.generatingTextLength = fullText.length;
                    if (!isCurrentlyGenerating && fullText.length < 20 && (fullText.includes("お役に") || fullText.includes("承れません"))) { State.current = "BLOCKED"; UI.sync(); }
                    const targetText = this.getTargetText(fullText); let readLen = parseInt(activeResponse.dataset.readLength || "0", 10);
                    if (targetText.length > readLen) {
                        const unreadText = targetText.substring(readLen); const sentenceRegex = /^[^。！？\n]*[。！？\n]+[」』）】］"']*/;
                        let match, currentUnread = unreadText, newlyReadLen = 0;
                        while ((match = currentUnread.match(sentenceRegex)) !== null) { TTS.enqueue(match[0]); newlyReadLen += match[0].length; currentUnread = currentUnread.substring(match[0].length); }
                        if (newlyReadLen > 0) activeResponse.dataset.readLength = (readLen + newlyReadLen).toString();
                    }
                }
                if (!isCurrentlyGenerating && State.isGenerating) {
                    State.isGenerating = false; State.generatingTextLength = 0; State.current = "IDLE";
                    AudioModule.stopTypingSound(); AudioModule.playBeep();
                    State.autoSleepTimeLeft = Settings.data.autoSleepTime;
                    if (!State.isSpeaking && TTS.queue.length === 0 && Settings.data.finishedThinkingMessage) TTS.playInstantly(Settings.data.finishedThinkingMessage, "finishedThinkingMessage");
                    if (activeResponse) {
                        const fullText = this.getCleanTextFast(activeResponse); const targetText = this.getTargetText(fullText); let readLen = parseInt(activeResponse.dataset.readLength || "0", 10);
                        if (targetText.length > readLen) TTS.enqueue(targetText.substring(readLen).trim());
                        activeResponse.dataset.readLength = fullText.length.toString(); activeResponse.setAttribute('data-spoken', 'true');
                        if (fullText.length > 0) { State.spokenSignatures.add(this.getSignature(fullText)); }
                    }
                    UI.sync();
                }
            };
            const observer = new MutationObserver(() => { const now = Date.now(); const stopButton = document.querySelector('button[aria-label*="停止"], .generating-text, [purpose="r-stop-button"]'); if (State.isGenerating && !stopButton) { if (this.processTimeout) clearTimeout(this.processTimeout); this.lastProcessTime = now; executeProcess(); return; } if (now - this.lastProcessTime > 150) { if (this.processTimeout) clearTimeout(this.processTimeout); this.lastProcessTime = now; executeProcess(); } else if (!this.processTimeout) { this.processTimeout = setTimeout(() => { this.lastProcessTime = Date.now(); executeProcess(); }, 150); } });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    };

    Settings.init(); UI.build(); Speech.init(); UI.createOverlay();
})();
