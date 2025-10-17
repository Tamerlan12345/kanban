import { useState, useRef } from 'react';

export const useAudioStreamer = (onResponse, onStatusUpdate, onError) => {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const websocketRef = useRef(null);

    const startStreaming = async () => {
        if (isRecording) return;

        try {
            onStatusUpdate('Подключение к микрофону...');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            onStatusUpdate('Подключение к серверу...');

            // Dynamically generate the WebSocket URL based on the current page's location
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host;
            const wsURL = `${protocol}//${host}/ws`;

            console.log(`Connecting to WebSocket at: ${wsURL}`);
            const ws = new WebSocket(wsURL);
            websocketRef.current = ws;

            ws.onopen = () => {
                onStatusUpdate('Идет запись...');
                setIsRecording(true);

                const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
                mediaRecorderRef.current = mediaRecorder;

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
                        ws.send(event.data);
                    }
                };

                mediaRecorder.onstop = () => {
                    // Stop the stream tracks and close WebSocket
                    stream.getTracks().forEach(track => track.stop());
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.close();
                    }
                    setIsRecording(false);
                    onStatusUpdate('Запись завершена. Обработка...');
                };

                // Send audio chunks every 200ms as specified in the TZ
                mediaRecorder.start(200);
            };

            ws.onmessage = (event) => {
                onResponse(event.data);
            };

            ws.onerror = (error) => {
                console.error('WebSocket Error:', error);
                onError('Ошибка WebSocket соединения. Убедитесь, что бэкенд запущен.');
                setIsRecording(false);
            };

            ws.onclose = () => {
                onStatusUpdate('Готов к записи');
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                    mediaRecorderRef.current.stop();
                }
            };

        } catch (err) {
            console.error('Error starting stream:', err);
            onError('Не удалось получить доступ к микрофону. Пожалуйста, предоставьте разрешение.');
            setIsRecording(false);
        }
    };

    const stopStreaming = () => {
        if (!isRecording || !mediaRecorderRef.current) return;
        mediaRecorderRef.current.stop();
    };

    return { isRecording, startStreaming, stopStreaming };
};