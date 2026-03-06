import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { Send, ShoppingBag, Circle, Plus, X, MessageSquare, Info } from 'lucide-react';

const PLATFORM_COLORS = {
  eBay: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400' },
  Craigslist: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400' },
  Facebook: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
  Other: { bg: 'bg-slate-500/10', border: 'border-slate-500/30', text: 'text-slate-400' },
};

function PlatformBadge({ platform }) {
  const style = PLATFORM_COLORS[platform] || PLATFORM_COLORS.Other;
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${style.bg} ${style.border} ${style.text} border`}>
      {platform || 'Other'}
    </span>
  );
}

export default function MessagesView() {
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newConvo, setNewConvo] = useState({ buyerName: '', platform: 'eBay', itemTitle: '', message: '' });
  const [isCreating, setIsCreating] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 1. FETCH CONVERSATIONS
  useEffect(() => {
    const q = query(collection(db, "conversations"), orderBy("lastUpdated", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const convos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setConversations(convos);
    });
    return () => unsubscribe();
  }, []);

  // 2. FETCH MESSAGES for Active Chat
  useEffect(() => {
    if (!activeChat) return;
    const q = query(
      collection(db, `conversations/${activeChat.id}/messages`),
      orderBy("createdAt", "asc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [activeChat]);

  // MARK READ
  const handleSelectChat = async (chat) => {
    setActiveChat(chat);
    if (chat.isUnread) {
      try {
        const chatRef = doc(db, "conversations", chat.id);
        await updateDoc(chatRef, { isUnread: false });
      } catch (error) {
        console.error("Error marking read:", error);
      }
    }
  };

  // SEND MESSAGE
  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;
    try {
      await addDoc(collection(db, `conversations/${activeChat.id}/messages`), {
        text: newMessage,
        sender: 'owner',
        createdAt: serverTimestamp()
      });
      const chatRef = doc(db, "conversations", activeChat.id);
      await updateDoc(chatRef, {
        lastMessage: `You: ${newMessage}`,
        lastUpdated: serverTimestamp(),
        isUnread: false
      });
      setNewMessage('');
    } catch (error) {
      console.error("Error sending:", error);
    }
  };

  // CREATE NEW CONVERSATION
  const handleCreateConversation = async () => {
    if (!newConvo.buyerName.trim() || !newConvo.itemTitle.trim()) return;
    setIsCreating(true);
    try {
      const convoRef = await addDoc(collection(db, "conversations"), {
        buyerName: newConvo.buyerName.trim(),
        platform: newConvo.platform,
        itemTitle: newConvo.itemTitle.trim(),
        lastMessage: newConvo.message.trim() || 'New inquiry',
        lastUpdated: serverTimestamp(),
        isUnread: true,
        createdAt: serverTimestamp(),
      });

      // Add initial message if provided
      if (newConvo.message.trim()) {
        await addDoc(collection(db, `conversations/${convoRef.id}/messages`), {
          text: newConvo.message.trim(),
          sender: 'buyer',
          createdAt: serverTimestamp()
        });
      }

      setShowNewModal(false);
      setNewConvo({ buyerName: '', platform: 'eBay', itemTitle: '', message: '' });
      // Auto-select the new conversation
      handleSelectChat({ id: convoRef.id, buyerName: newConvo.buyerName, itemTitle: newConvo.itemTitle, platform: newConvo.platform, isUnread: false });
    } catch (error) {
      console.error("Error creating conversation:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-140px)] md:h-[calc(100vh-100px)] border border-slate-800 rounded-xl overflow-hidden bg-slate-900">

      {/* LEFT: CONVERSATION LIST */}
      <div className={`${activeChat ? 'hidden md:block' : 'block'} w-full md:w-1/3 border-r border-slate-800 bg-slate-950`}>
        <div className="p-4 border-b border-slate-800 font-bold text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span>Inbox</span>
            <span className="text-xs text-slate-500 font-normal">
              {conversations.filter(c => c.isUnread).length} Unread
            </span>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1 text-xs bg-teal-500/10 text-teal-400 border border-teal-500/30 px-2.5 py-1.5 rounded-lg hover:bg-teal-500/20 transition-colors font-medium"
          >
            <Plus size={14} />
            New
          </button>
        </div>
        <div className="overflow-y-auto h-[calc(100%-60px)]">
          {conversations.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare size={40} className="text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-medium">No conversations yet</p>
              <p className="text-slate-600 text-xs mt-1">Click + to log a buyer inquiry</p>
            </div>
          ) : (
            conversations.map(chat => (
              <div
                key={chat.id}
                onClick={() => handleSelectChat(chat)}
                className={`p-4 border-b border-slate-800 cursor-pointer hover:bg-slate-900 transition-colors relative ${activeChat?.id === chat.id ? 'bg-slate-900 border-l-2 border-l-teal-500' : ''}`}
              >
                {chat.isUnread && (
                  <div className="absolute right-4 top-4">
                    <Circle size={10} className="fill-teal-500 text-teal-500" />
                  </div>
                )}
                <div className="flex justify-between items-start mb-1 pr-4">
                  <span className={`text-sm ${chat.isUnread ? 'font-bold text-white' : 'font-medium text-slate-300'}`}>
                    {chat.buyerName || 'Unknown Buyer'}
                  </span>
                  <PlatformBadge platform={chat.platform} />
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                  <ShoppingBag size={12} />
                  <span className="truncate">{chat.itemTitle}</span>
                </div>
                <p className={`text-sm truncate ${chat.isUnread ? 'text-white' : 'text-slate-500'}`}>
                  {chat.lastMessage}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT: CHAT WINDOW */}
      <div className={`${!activeChat ? 'hidden md:flex' : 'flex'} w-full md:w-2/3 flex-col bg-slate-900`}>
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white">{activeChat.buyerName}</h3>
                    <PlatformBadge platform={activeChat.platform} />
                  </div>
                  <p className="text-xs text-teal-400">{activeChat.itemTitle}</p>
                </div>
              </div>
              <button onClick={() => setActiveChat(null)} className="md:hidden text-sm text-slate-400">Back</button>
            </div>

            {/* App-Only Notice */}
            <div className="px-4 py-2 bg-slate-950/50 border-b border-slate-800 flex items-center gap-2">
              <Info size={12} className="text-slate-500 flex-shrink-0" />
              <p className="text-[11px] text-slate-500">
                Replies stay in this app. For {activeChat.platform || 'marketplace'} messages, reply on the platform directly.
              </p>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-slate-600 text-sm py-12">
                  No messages yet in this conversation
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender === 'owner' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] p-3 rounded-lg text-sm ${
                      msg.sender === 'owner'
                        ? 'bg-teal-600 text-white rounded-br-none'
                        : 'bg-slate-800 text-slate-200 rounded-bl-none'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSend} className="p-4 bg-slate-950 border-t border-slate-800 flex gap-2">
              <input
                type="text"
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-teal-500 outline-none"
                placeholder="Type a reply..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
              <button type="submit" className="bg-teal-500 hover:bg-teal-400 text-slate-900 p-2 rounded-lg">
                <Send size={20} />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3">
            <MessageSquare size={48} className="text-slate-700" />
            <p>Select a conversation to start chatting</p>
            <button
              onClick={() => setShowNewModal(true)}
              className="text-sm text-teal-400 hover:text-teal-300 transition-colors"
            >
              or log a new buyer inquiry
            </button>
          </div>
        )}
      </div>

      {/* NEW CONVERSATION MODAL */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">New Conversation</h3>
              <button onClick={() => setShowNewModal(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Buyer Name</label>
                <input
                  type="text"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:border-teal-500 outline-none"
                  placeholder="e.g., John Smith"
                  value={newConvo.buyerName}
                  onChange={e => setNewConvo({ ...newConvo, buyerName: e.target.value })}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Platform</label>
                <select
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:border-teal-500 outline-none"
                  value={newConvo.platform}
                  onChange={e => setNewConvo({ ...newConvo, platform: e.target.value })}
                >
                  <option value="eBay">eBay</option>
                  <option value="Craigslist">Craigslist</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Item Title</label>
                <input
                  type="text"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:border-teal-500 outline-none"
                  placeholder="e.g., DeWalt 20V Drill"
                  value={newConvo.itemTitle}
                  onChange={e => setNewConvo({ ...newConvo, itemTitle: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Initial Message (optional)</label>
                <textarea
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:border-teal-500 outline-none resize-none"
                  rows={3}
                  placeholder="e.g., Is this still available?"
                  value={newConvo.message}
                  onChange={e => setNewConvo({ ...newConvo, message: e.target.value })}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCreateConversation}
                  disabled={isCreating || !newConvo.buyerName.trim() || !newConvo.itemTitle.trim()}
                  className="flex-1 bg-teal-500 hover:bg-teal-400 text-slate-900 py-3 rounded-lg font-bold transition-colors disabled:opacity-50"
                >
                  {isCreating ? 'Creating...' : 'Create Conversation'}
                </button>
                <button
                  onClick={() => setShowNewModal(false)}
                  className="px-4 text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
