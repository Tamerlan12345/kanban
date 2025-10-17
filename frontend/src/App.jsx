import { useState } from 'react';
import './App.css';
import { useAudioStreamer } from './hooks/useAudioStreamer';

function App() {
  const [status, setStatus] = useState('Готов к записи');
  const [responseText, setResponseText] = useState('');
  const [error, setError] = useState(null);

  const handleResponse = (newChunk) => {
    // When we get the first chunk, it means processing has started
    if (status !== 'Получение ответа...') {
      setStatus('Получение ответа...');
      setResponseText(newChunk); // Start with the first chunk
    } else {
      setResponseText(prev => prev + newChunk);
    }
  };

  const handleStatusUpdate = (newStatus) => {
      setStatus(newStatus);
      // Clear error when status changes
      if (error) setError(null);
  };

  const handleError = (errorMessage) => {
      setStatus('Ошибка');
      setError(errorMessage);
  };

  const { isRecording, startStreaming, stopStreaming } = useAudioStreamer(
    handleResponse,
    handleStatusUpdate,
    handleError
  );

  const handleToggleRecording = () => {
    if (!isRecording) {
      setResponseText(''); // Clear previous response
      setError(null);
      startStreaming();
    } else {
      stopStreaming();
    }
  };

  return (
    <div className="app-container">
      <h1 className="title">Live Corporate Trainer</h1>
      <p className="status-indicator">{error || status}</p>
      <button
        onClick={handleToggleRecording}
        className={`record-button ${isRecording ? 'recording' : 'idle'}`}
      >
        {isRecording ? 'Остановить запись' : 'Начать запись'}
      </button>
      <div className="response-area">
        {responseText || 'Ответ от AI появится здесь...'}
      </div>
    </div>
  );
}

export default App;