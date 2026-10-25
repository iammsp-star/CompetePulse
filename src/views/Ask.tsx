import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Quote, Search, Sparkles, Wand2 } from 'lucide-react';
import type { AskResponse, ProviderStatus } from '../../shared/types';
import { api } from '../lib/api';
import { humanType, percent, shortDate } from '../lib/format';
import { Markdown } from '../components/Markdown';
import { useToast } from '../components/Toast';
import { Avatar, Badge, Button, EmptyState, Spinner } from '../components/ui';

const SUGGESTIONS = [
  'How is Orbitly pricing its Growth tier?',
  'What AI features have competitors shipped recently?',
  'Which enterprise security capabilities are table stakes?',
  'Compare the homepage positioning of Cadence and Stackline.',
  'What integrations were announced this quarter?',
];

export function AskPage() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<ProviderStatus | null>(null);
  const toast = useToast();

  useEffect(() => {
    api
      .settings()
      .then((result) => setProviders(result.providers))
      .catch(() => undefined);
  }, []);

  const ask = async (value?: string) => {
    const prompt = (value ?? question).trim();
    if (prompt.length < 3) return;
    setQuestion(prompt);
    setLoading(true);
    try {
      const result = await api.ask(prompt);
      setAnswer(result);
    } catch (error) {
      toast.push((error as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">
            <Sparkles size={13} /> Retrieval-augmented analysis
          </div>
          <h1>Ask CompetePulse</h1>
          <p className="page-sub">
            Search the latest snapshots and get a sourced answer about pricing, positioning, features and partnerships.
          </p>
        </div>
      </header>

      <section className="ask-hero">
        <div className="ask-hero-glow" />
        <div className="ask-hero-copy">
          <span className="ask-kicker">
            <Wand2 size={13} /> Grounded in {providers ? 'your snapshot archive' : 'monitored pages'}
          </span>
          <h2>What do you need to know about your market?</h2>
          <p>
            Ask in plain language. Every answer cites the captured page and section it came from, so you can verify the claim
            before it reaches a deck.
          </p>
        </div>
        <form
          className="ask-form"
          onSubmit={(event) => {
            event.preventDefault();
            ask();
          }}
        >
          <div className="ask-input-wrap">
            <Search size={17} />
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="e.g. How do competitors package enterprise security?"
              aria-label="Ask a competitive question"
            />
          </div>
          <Button variant="primary" type="submit" loading={loading} disabled={question.trim().length < 3}>
            Ask
          </Button>
        </form>
        <div className="ask-suggestions">
          {SUGGESTIONS.map((suggestion) => (
            <button key={suggestion} type="button" className="suggestion-chip" onClick={() => ask(suggestion)} disabled={loading}>
              {suggestion}
            </button>
          ))}
        </div>
      </section>

      {providers && (
        <div className="provider-note">
          <Badge tone={providers.llm.live ? 'green' : 'amber'}>{providers.llm.live ? 'LLM synthesis on' : 'Retrieval mode'}</Badge>
          <span>
            {providers.llm.live
              ? `Answers are synthesized with ${providers.llm.provider} from retrieved excerpts, then cited.`
              : 'Add an OpenAI key in Settings to get analyst-written synthesis. Retrieval still returns sourced excerpts.'}
          </span>
          <span className="provider-note-model">{providers.embeddings.detail}</span>
        </div>
      )}

      {loading && (
        <div className="ask-loading">
          <Spinner label="Searching snapshots and synthesizing an answer…" />
          <div className="ask-loading-steps">
            <span>1 · Embedding question</span>
            <span>2 · Retrieving latest chunks</span>
            <span>3 · Composing sourced answer</span>
          </div>
        </div>
      )}

      {!loading && answer && (
        <div className="ask-result">
          <section className="answer-card">
            <header className="answer-head">
              <div>
                <span className="answer-kicker">
                  {answer.source === 'llm' ? <Sparkles size={13} /> : <Quote size={13} />}
                  {answer.source === 'llm' ? 'Synthesized answer' : 'Retrieved excerpts'}
                </span>
                <h3>{question}</h3>
              </div>
              <Badge tone={answer.source === 'llm' ? 'green' : 'neutral'}>
                {answer.source === 'llm' ? 'LLM + retrieval' : 'Retrieval only'}
              </Badge>
            </header>
            <Markdown content={answer.answer} className="answer-markdown" />
            <footer className="answer-foot">
              {answer.results.length} source{answer.results.length === 1 ? '' : 's'} retrieved from the latest monitored snapshots
            </footer>
          </section>

          <section className="source-panel">
            <div className="source-head">
              <h3>Sources</h3>
              <span>{answer.results.length} chunks</span>
            </div>
            {answer.results.length === 0 ? (
              <EmptyState title="No matching sources" description="Try a different question or scan newer pages." />
            ) : (
              <div className="source-list">
                {answer.results.map((result, index) => (
                  <article className="source-card" key={result.chunkId}>
                    <div className="source-card-head">
                      <span className="source-index">{index + 1}</span>
                      <Avatar name={result.competitorName} color={result.competitorColor} size={26} />
                      <div>
                        <strong>{result.competitorName}</strong>
                        <span>
                          {humanType(result.targetType)} · {result.section} · {shortDate(result.capturedAt)}
                        </span>
                      </div>
                      <span className="source-score">{percent(result.score)} match</span>
                    </div>
                    <p>{result.text.replace(/^#+\s*/gm, '').slice(0, 320)}</p>
                    <Link className="source-link" to={`/competitors/${result.competitorId}`}>
                      Open competitor <ArrowUpRight size={12} />
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {!loading && !answer && (
        <div className="ask-placeholder">
          <div className="ask-placeholder-grid">
            <div>
              <h3>Pricing intelligence</h3>
              <p>Compare plan structure, price moves and what is gated behind each tier.</p>
            </div>
            <div>
              <h3>Positioning shifts</h3>
              <p>See how competitors rewrite their homepage promise and who they now target.</p>
            </div>
            <div>
              <h3>Gap discovery</h3>
              <p>Find capabilities that are table stakes, contested or still white space.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
