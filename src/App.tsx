import { Bot, LoaderCircle, RotateCcw, Send, Sparkles } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react'

type Message = {
  id: string
  role: 'customer' | 'maria'
  content: string
}

type ApiResponse = {
  conversationId?: string
  message?: string
  reply?: string
  error?: string
}

function App() {
  const [conversationId, setConversationId] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function startConversation() {
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch('/api/conversations', { method: 'POST' })
      const data = (await response.json()) as ApiResponse
      if (!response.ok || !data.conversationId || !data.message) {
        throw new Error(data.error ?? 'Unable to start the conversation')
      }
      setConversationId(data.conversationId)
      setMessages([{ id: crypto.randomUUID(), role: 'maria', content: data.message }])
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to reach Maria')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/conversations', { method: 'POST', signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as ApiResponse
        if (!response.ok || !data.conversationId || !data.message) {
          throw new Error(data.error ?? 'Unable to start the conversation')
        }
        setConversationId(data.conversationId)
        setMessages([{ id: crypto.randomUUID(), role: 'maria', content: data.message }])
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return
        setError(requestError instanceof Error ? requestError.message : 'Unable to reach Maria')
      })
      .finally(() => setIsLoading(false))

    return () => controller.abort()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    const message = input.trim()
    if (!message || !conversationId || isLoading) return

    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'customer', content: message }])
    setInput('')
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, message }),
      })
      const data = (await response.json()) as ApiResponse
      if (!response.ok || !data.reply) throw new Error(data.error ?? 'Maria did not return a response')
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'maria', content: data.reply! }])
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to reach Maria')
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSubmit()
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6">
      <section className="mx-auto flex h-[calc(100vh-3rem)] max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 shadow-2xl shadow-violet-950/30">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-violet-500/15 p-2.5 text-violet-300 ring-1 ring-violet-400/25">
              <Bot size={24} aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-semibold">Maria</h1>
              <p className="flex items-center gap-1 text-xs text-emerald-300"><Sparkles size={12} /> Dharma Nutrition Clinic</p>
            </div>
          </div>
          <button type="button" onClick={() => void startConversation()} disabled={isLoading} className="rounded-xl p-2 text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-40" aria-label="Start a new conversation">
            <RotateCcw size={18} />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-6" aria-live="polite">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'customer' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'customer' ? 'rounded-br-md bg-violet-500 text-white' : 'rounded-bl-md border border-white/10 bg-white/5 text-slate-200'}`}>
                {message.content}
              </div>
            </div>
          ))}
          {isLoading && messages.length > 0 && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-400">
                <LoaderCircle className="animate-spin" size={16} /> Maria is typing…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-white/10 p-4">
          {error && <p className="mb-3 rounded-xl bg-red-400/10 px-3 py-2 text-sm text-red-200" role="alert">{error}</p>}
          <form onSubmit={(event) => void handleSubmit(event)} className="flex items-end gap-3">
            <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKeyDown} rows={1} maxLength={4000} disabled={!conversationId || isLoading} className="max-h-32 min-h-12 flex-1 resize-none rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm outline-none transition placeholder:text-slate-600 focus:border-violet-400/60 focus:ring-4 focus:ring-violet-500/10" placeholder="Message Maria…" aria-label="Message Maria" />
            <button type="submit" disabled={!input.trim() || !conversationId || isLoading} className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500 text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send message">
              <Send size={19} />
            </button>
          </form>
          <p className="mt-2 text-center text-[11px] text-slate-600">Enter to send · Shift+Enter for a new line</p>
        </div>
      </section>
    </main>
  )
}

export default App
