import { useEffect, useState } from 'react'
import {
  Calculator,
  FileText,
  Languages,
  LoaderCircle,
  Moon,
  ScrollText,
  Send,
  Sun,
} from 'lucide-react'
import './App.css'

type Mode = 'ask' | 'agent'
type Lang = 'en' | 'ar'
type Theme = 'light' | 'dark'

type AskResponse = {
  answer: string
  sources?: string[]
}

type Suggestion = {
  mode: Mode
  text: string
}

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

const copy = {
  en: {
    title: 'Trading Desk Assistant',
    kicker: 'Trading desk',
    heading: 'Assistant',
    lede: 'Documents are searched with citations. Exposure uses the demo Brent, WTI, and Dubai prices.',
    documents: 'Documents',
    exposure: 'Exposure',
    question: 'Question',
    questionType: 'Question type',
    ask: 'Ask',
    asking: 'Asking…',
    answer: 'Answer',
    sources: 'Sources',
    empty: 'Ask a question to see the answer.',
    waiting: 'Waiting for the model…',
    light: 'Light',
    dark: 'Dark',
    language: 'Language',
    theme: 'Theme',
    licenses: 'Licenses',
    requestFailed: 'Request failed',
    suggestions: [
      { mode: 'ask', text: 'What is the Brent position limit per trader?' },
      { mode: 'ask', text: 'Which Incoterm does the desk use for Fujairah?' },
      { mode: 'agent', text: 'What is our USD exposure on a 500,000 barrel Brent cargo?' },
    ] satisfies Suggestion[],
  },
  ar: {
    title: 'مساعد مكتب التداول',
    kicker: 'مكتب التداول',
    heading: 'المساعد',
    lede: 'تُسترجع الإجابات من مستندات المكتب مع ذكر المصدر. حساب التعرض يستخدم أسعار برنت وغرب تكساس ودبي التجريبية.',
    documents: 'المستندات',
    exposure: 'التعرض',
    question: 'السؤال',
    questionType: 'نوع السؤال',
    ask: 'اسأل',
    asking: 'جارٍ السؤال…',
    answer: 'الإجابة',
    sources: 'المصادر',
    empty: 'اطرح سؤالاً لتظهر الإجابة.',
    waiting: 'بانتظار النموذج…',
    light: 'فاتح',
    dark: 'داكن',
    language: 'اللغة',
    theme: 'المظهر',
    licenses: 'التراخيص',
    requestFailed: 'تعذر إرسال الطلب',
    suggestions: [
      { mode: 'ask', text: 'ما حد مركز Brent لكل متداول؟' },
      { mode: 'ask', text: 'أي شرط تسليم يستخدمه المكتب لفجيرة؟' },
      { mode: 'agent', text: 'ما تعرضنا بالدولار لشحنة Brent حجمها 500,000 برميل؟' },
    ] satisfies Suggestion[],
  },
} as const

function storedLanguage(): Lang {
  return localStorage.getItem('desk-lang') === 'ar' ? 'ar' : 'en'
}

function storedTheme(): Theme {
  const saved = localStorage.getItem('desk-theme')
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const [language, setLanguage] = useState<Lang>(storedLanguage)
  const [theme, setTheme] = useState<Theme>(storedTheme)
  const [mode, setMode] = useState<Mode>('ask')
  const [question, setQuestion] = useState(copy[storedLanguage()].suggestions[0].text)
  const [answer, setAnswer] = useState('')
  const [sources, setSources] = useState<string[]>([])
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const t = copy[language]

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    document.title = copy[language].title
    localStorage.setItem('desk-lang', language)
  }, [language])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('desk-theme', theme)
  }, [theme])

  function chooseLanguage(next: Lang) {
    const index = copy[language].suggestions.findIndex((item) => item.text === question)
    setLanguage(next)
    if (index >= 0) setQuestion(copy[next].suggestions[index].text)
  }

  async function submit(nextQuestion = question, nextMode = mode, nextLanguage = language) {
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
        body: JSON.stringify({ question: text, language: nextLanguage }),
      })
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`)
      }
      const body = (await response.json()) as AskResponse
      setAnswer(body.answer ?? '')
      setSources(body.sources ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : copy[nextLanguage].requestFailed)
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="desk">
      <div className="toolbar">
        <div className="switch" role="group" aria-label={t.language}>
          <button type="button" aria-pressed={language === 'en'} onClick={() => chooseLanguage('en')}>
            <Languages size={16} strokeWidth={1.75} aria-hidden="true" />
            English
          </button>
          <button type="button" aria-pressed={language === 'ar'} onClick={() => chooseLanguage('ar')}>
            العربية
          </button>
        </div>
        <div className="switch" role="group" aria-label={t.theme}>
          <button type="button" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>
            <Sun size={16} strokeWidth={1.75} aria-hidden="true" />
            {t.light}
          </button>
          <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>
            <Moon size={16} strokeWidth={1.75} aria-hidden="true" />
            {t.dark}
          </button>
        </div>
      </div>

      <header>
        <p className="kicker">{t.kicker}</p>
        <h1>{t.heading}</h1>
        <p className="lede">{t.lede}</p>
      </header>

      <div className="modes" role="tablist" aria-label={t.questionType}>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'ask'}
          onClick={() => setMode('ask')}
        >
          <FileText size={16} strokeWidth={1.75} aria-hidden="true" />
          {t.documents}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'agent'}
          onClick={() => setMode('agent')}
        >
          <Calculator size={16} strokeWidth={1.75} aria-hidden="true" />
          {t.exposure}
        </button>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <label htmlFor="question">{t.question}</label>
        <textarea
          id="question"
          value={question}
          rows={4}
          dir="auto"
          onChange={(event) => setQuestion(event.target.value)}
        />
        <div className="suggestions">
          {t.suggestions.map((item) => (
            <button
              key={item.text}
              type="button"
              disabled={pending}
              onClick={() => {
                setQuestion(item.text)
                setMode(item.mode)
                void submit(item.text, item.mode, language)
              }}
            >
              {item.text}
            </button>
          ))}
        </div>
        <button className="ask" type="submit" disabled={pending || !question.trim()}>
          {pending ? (
            <LoaderCircle className="spin" size={16} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Send size={16} strokeWidth={1.75} aria-hidden="true" />
          )}
          {pending ? t.asking : t.ask}
        </button>
      </form>

      {error ? <p className="error">{error}</p> : null}

      <section className="result" aria-live="polite">
        <h2>{t.answer}</h2>
        <p className="answer-body">
          {(answer || (pending ? t.waiting : t.empty)).replaceAll('**', '')}
        </p>
        {sources.length > 0 ? (
          <>
            <h2>
              <ScrollText size={16} strokeWidth={1.75} aria-hidden="true" />
              {t.sources}
            </h2>
            <ul>
              {sources.map((source) => (
                <li key={source}>{source}</li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <p className="legal">
        <a href="/licenses/NOTICES.txt">{t.licenses}</a>
      </p>
    </main>
  )
}
