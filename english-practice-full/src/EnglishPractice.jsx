import React, { useEffect, useRef, useState } from "react";

export default function EnglishPractice() {
  const [text, setText] = useState(
    `Hi, I'm practicing English. This tool will pause at each sentence. Please listen, then press record and repeat after the sentence. When you're done with a sentence you can stop and play your recording.`
  );
  const [sentences, setSentences] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState({});
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const utteranceRef = useRef(null);

  useEffect(() => {
    const s = splitIntoSentences(text);
    setSentences(s.filter(Boolean));
    setCurrentIndex(0);
    setRecordings({});
  }, [text]);

  useEffect(() => {
    return () => {
      Object.values(recordings).forEach(r => r.url && URL.revokeObjectURL(r.url));
    };
  }, []);

  function splitIntoSentences(raw) {
    return raw
      .replace(/\n+/g, " ")
      .split(/(?<=[.?!])\s+/)
      .map(p => p.trim());
  }

  function playCurrentSentence() {
    if (!sentences[currentIndex]) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(sentences[currentIndex]);
    utteranceRef.current = u;
    u.onstart = () => setIsPlaying(true);
    u.onend = () => setIsPlaying(false);
    u.onerror = () => setIsPlaying(false);
    window.speechSynthesis.speak(u);
  }

  async function playAllButPauseEach() {
    if (!sentences.length) return;
    setIsPlaying(true);
    for (let i = currentIndex; i < sentences.length; i++) {
      setCurrentIndex(i);
      await speakSentenceAsync(sentences[i]);
      await new Promise(resolve => setTimeout(resolve, 200));
      if (!isPlaying) break;
    }
    setIsPlaying(false);
  }

  function speakSentenceAsync(sentence) {
    return new Promise((resolve, reject) => {
      const u = new SpeechSynthesisUtterance(sentence);
      utteranceRef.current = u;
      u.onend = () => resolve();
      u.onerror = e => reject(e);
      window.speechSynthesis.speak(u);
    });
  }

  function stopSpeech() {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  }

  async function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("你的浏览器不支持录音");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      mr.ondataavailable = e => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setRecordings(prev => {
          if (prev[currentIndex] && prev[currentIndex].url) URL.revokeObjectURL(prev[currentIndex].url);
          return { ...prev, [currentIndex]: { blob, url, time: new Date().toISOString() } };
        });
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      alert("无法访问麦克风：" + err.message);
    }
  }

  function stopRecording() {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }

  function playUserRecording(i) {
    const r = recordings[i];
    if (!r) return;
    const audio = new Audio(r.url);
    audio.play();
  }

  function downloadRecording(i) {
    const r = recordings[i];
    if (!r) return;
    const a = document.createElement("a");
    a.href = r.url;
    a.download = `sentence-${i + 1}.webm`;
    a.click();
  }

  function nextSentence() {
    setCurrentIndex(i => Math.min(i + 1, sentences.length - 1));
  }
  function prevSentence() {
    setCurrentIndex(i => Math.max(i - 1, 0));
  }

  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <h1>English Practice — 每句暂停 · 跟读 · 录音</h1>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={4}
        style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
      />
      <div style={{ marginBottom: "10px" }}>
        <button onClick={() => playCurrentSentence()}>播放本句</button>
        <button onClick={() => { if (isPlaying) stopSpeech(); else playAllButPauseEach(); }}>
          {isPlaying ? "停止" : "从当前开始播放并暂停"}
        </button>
        <span style={{ marginLeft: "10px" }}>句子 {currentIndex + 1} / {sentences.length}</span>
      </div>

      {sentences.map((s, i) => (
        <div key={i} style={{ border: i === currentIndex ? "2px solid blue" : "1px solid gray", padding: "10px", marginBottom: "5px" }}>
          <div>句子 {i + 1}</div>
          <div>{s}</div>
          <button onClick={() => { setCurrentIndex(i); playCurrentSentence(); }}>播放原句</button>
          {currentIndex === i ? (
            isRecording ? (
              <button onClick={stopRecording}>停止录音</button>
            ) : (
              <button onClick={startRecording}>开始录音</button>
            )
          ) : (
            <button onClick={() => setCurrentIndex(i)}>选中并录音</button>
          )}
          <button onClick={() => playUserRecording(i)} disabled={!recordings[i]}>播放我的录音</button>
          <button onClick={() => downloadRecording(i)} disabled={!recordings[i]}>下载录音</button>
        </div>
      ))}
      <div style={{ marginTop: "10px" }}>
        <button onClick={prevSentence}>上一句</button>
        <button onClick={nextSentence}>下一句</button>
      </div>
    </div>
  );
}
