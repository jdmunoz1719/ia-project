import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, ExternalLink, List, Lock, Send, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/common'
import { openDetail } from '@/components/panels'
import { useServiceQuery } from '@/hooks/useServiceQuery'
import { api, type ChatAnswer } from '@/services/api'

type Message = { id: number; from: 'user' | 'bot'; text: string; answer?: ChatAnswer }

/** Chat de consulta (contexto §10): responde con las mismas funciones del dominio y nunca inventa cifras. */
export default function ChatPage() {
  const { data: suggested } = useServiceQuery(() => api.chat.suggested(), [])
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [thinking, setThinking] = useState(false)
  const bottom = useRef<HTMLDivElement>(null)

  const ask = async (q: string) => {
    const question = q.trim()
    if (!question || thinking) return
    const n = Date.now()
    setMessages((m) => [...m, { id: n, from: 'user', text: question }])
    setText(''); setThinking(true)
    try {
      const a = await api.chat.ask(question)
      setMessages((m) => [...m, { id: n + 1, from: 'bot', text: a.text, answer: a }])
    } catch (e) {
      setMessages((m) => [...m, { id: n + 1, from: 'bot', text: e instanceof Error ? e.message : 'No pude consultar los datos. Inténtalo de nuevo.' }])
    } finally {
      setThinking(false)
      setTimeout(() => bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Chat" description="Pregunta por tus cifras en lenguaje natural. Las respuestas salen de los mismos cálculos que los tableros."
        />
      <p className="mb-4 flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900"><Lock className="size-4 shrink-0" /><span><b>Solo consulta:</b> el chat responde con tus cifras, pero no registra ni cambia nada.</span></p>

      <div className="mb-4 flex flex-wrap gap-2" aria-label="Preguntas sugeridas">
        {(suggested ?? []).map((q) => (
          <button key={q} type="button" disabled={thinking} onClick={() => ask(q)}
            className="min-h-9 rounded-full border bg-card px-3 py-1.5 text-left text-sm transition hover:border-primary hover:text-primary disabled:opacity-50">{q}</button>
        ))}
      </div>

      <div className="min-h-64 space-y-4 rounded-xl border bg-card p-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="py-10 text-center">
            <Bot className="mx-auto mb-2 size-8 text-muted-foreground" aria-hidden />
            <p className="font-medium">Aún no has preguntado nada</p>
            <p className="text-sm text-muted-foreground">Elige una pregunta sugerida o escribe la tuya.</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.from === 'user' ? 'flex justify-end gap-2' : 'flex gap-2'}>
            {m.from === 'bot' && <Bot className="mt-1 size-5 shrink-0 text-primary" aria-hidden />}
            <div className={m.from === 'user' ? 'max-w-[85%] rounded-xl rounded-tr-none bg-primary px-3 py-2 text-sm text-primary-foreground' : 'max-w-[90%] rounded-xl rounded-tl-none bg-muted px-3 py-2 text-sm'}>
              <p className="whitespace-pre-line">{m.text}</p>
              {m.answer && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {!!m.answer.transactionIds?.length && (
                    <Button size="sm" variant="outline" onClick={() => openDetail('Movimientos de la respuesta', m.answer!.transactionIds!, m.text)}>
                      <List />Ver los {m.answer.transactionIds.length} movimientos
                    </Button>
                  )}
                  {m.answer.link && <Button size="sm" variant="outline" render={<Link to={m.answer.link.to} />} nativeButton={false}><ExternalLink />{m.answer.link.label}</Button>}
                </div>
              )}
            </div>
            {m.from === 'user' && <User className="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden />}
          </div>
        ))}
        {thinking && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Bot className="size-5 text-primary" />Consultando tus datos…</p>}
        <div ref={bottom} />
      </div>

      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(text) }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribe tu pregunta…" aria-label="Tu pregunta"
          className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
        <Button type="submit" className="h-11 px-4" disabled={thinking || !text.trim()}><Send />Preguntar</Button>
      </form>
    </div>
  )
}
