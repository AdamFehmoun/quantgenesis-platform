"use client";

import { useState } from "react";

export default function Chat() {
    const [messages, setMessages] = useState<string[]>([]);
    const [input, setInput] = useState<string>('');

  const handleSend = () => {
    if (!input.trim()) return;

    setMessages([...messages, input]);
    setInput("");
  };

  return (
    <div className="p-4 border rounded-lg max-w-xl mx-auto mt-5">
      <h2 className="text-xl font-bold mb-4">Chat</h2>

      {/* Messages */}
      <div className="h-64 overflow-y-auto border p-2 mb-4">
        {messages.map((msg, index) => (
          <div key={index} className="text-right mb-2">
            {msg}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          className="border p-2 flex-1"
          value={input}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
          placeholder="Ton message..."
        />
        <button
          onClick={handleSend}
          className="bg-blue-500 text-white px-4"
        >
          Envoyer
        </button>
      </div>
    </div>
  );
}