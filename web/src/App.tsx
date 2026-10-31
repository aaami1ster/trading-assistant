import { useState } from 'react'
import './App.css'

type Mode = 'ask' | 'agent'

type AskResponse = {
  answer: string
  sources?: string[]
}

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

const SUGGESTIONS = [
  'What is the Brent position limit per trader?',
  'Which Incoterm does the desk use for Fujairah?',
  'What is our USD exposure on a 500,000 barrel Brent cargo?',
]

export default function App() {
  const [mode, setMode] = useState<Mode>('ask')
  const [question, setQuestion] = useState(SUGGESTIONS[0])
  const [answer, setAnswer] = useState('')
  const [sources, setSources] = useState<string[]>([])
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(nextQuestion = question, nextMode = mode) {
    const text = nextQuestion.trim()
    if (!text || pending) return
    setPending(true)
    setError('')
    setAnswer('')
    setSources([])
    try {
      const response = await fetch(`${API_URL}/v1/${nextMode}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: text }),
      })
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`)
      }
      const body = (await response.json()) as AskResponse
      setAnswer(body.answer ?? '')
      setSources(body.sources ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="desk">
      <header>
        <p className="kicker">Trading desk</p>
        <h1>Assistant</h1>
        <p className="lede">
          Documents are searched with citations. Exposure uses the demo Brent, WTI, and Dubai prices.
        </p>
      </header>

      <div className="modes" role="tablist" aria-label="Question type">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'ask'}
          className={mode === 'ask' ? 'on' : ''}
          onClick={() => setMode('ask')}
        >
          Documents
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'agent'}
          className={mode === 'agent' ? 'on' : ''}
          onClick={() => setMode('agent')}
        >
          Exposure
        </button>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <label htmlFor="question">Question</label>
        <textarea
          id="question"
          value={question}
          rows={4}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <div className="suggestions">
          {SUGGESTIONS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                const nextMode = item.includes('exposure') ? 'agent' : 'ask'
                setQuestion(item)
                setMode(nextMode)
                void submit(item, nextMode)
              }}
            >
              {item}
            </button>
          ))}
        </div>
        <button className="ask" type="submit" disabled={pending || !question.trim()}>
          {pending ? 'Asking…' : 'Ask'}
        </button>
      </form>

      {error ? <p className="error">{error}</p> : null}

      <section className="result" aria-live="polite">
        <h2>Answer</h2>
        <p>{answer || (pending ? 'Waiting for the model…' : 'Ask a question to see the answer.')}</p>
        {sources.length > 0 ? (
          <>
            <h2>Sources</h2>
            <ul>
              {sources.map((source) => (
                <li key={source}>{source}</li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
    </main>
  )
}
