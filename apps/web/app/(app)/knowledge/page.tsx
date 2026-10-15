'use client';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/api-state';
import { PageHeader } from '@/components/ui/page-header';
import { useScope } from '@/context/scope-context';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/use-api-query';
import { FormEvent, useState } from 'react';

export default function KnowledgePage() {
  const { scope, loading: scopeLoading, error: scopeError } = useScope();
  const [selectedSpaceId, setSelectedSpaceId] = useState('');

  const { data: spacesData, loading: spacesLoading, error: spacesError, reload: reloadSpaces } =
    useApiQuery(
      () => (scope ? api.listKnowledgeSpaces(scope.type, scope.id) : Promise.resolve({ items: [] })),
      [scope?.type, scope?.id],
    );

  const spaces = spacesData?.items ?? [];
  const activeSpaceId = selectedSpaceId || (spaces[0] ? String((spaces[0] as Record<string, unknown>).id) : '');

  const { data: articlesData, loading: articlesLoading, error: articlesError, reload: reloadArticles } =
    useApiQuery(
      () => (activeSpaceId ? api.listArticles(activeSpaceId) : Promise.resolve({ items: [] })),
      [activeSpaceId],
    );

  const [spaceName, setSpaceName] = useState('');
  const [articleTitle, setArticleTitle] = useState('');
  const [articleBody, setArticleBody] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function createSpace(e: FormEvent) {
    e.preventDefault();
    if (!scope) return;
    setPending(true);
    setFormError(null);
    try {
      await api.createKnowledgeSpace({
        scopeType: scope.type,
        scopeId: scope.id,
        name: spaceName,
      });
      setSpaceName('');
      await reloadSpaces();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create space');
    } finally {
      setPending(false);
    }
  }

  async function createArticle(e: FormEvent) {
    e.preventDefault();
    if (!activeSpaceId) return;
    setPending(true);
    setFormError(null);
    try {
      await api.createArticle({
        knowledgeSpaceId: activeSpaceId,
        title: articleTitle,
        body: articleBody,
      });
      setArticleTitle('');
      setArticleBody('');
      await reloadArticles();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create article');
    } finally {
      setPending(false);
    }
  }

  if (scopeLoading) return <LoadingBlock />;
  if (scopeError) return <ErrorBlock error={scopeError} />;
  if (!scope) return <EmptyBlock title="No workspace" />;

  return (
    <>
      <PageHeader title="Knowledge" subtitle="Spaces and articles for the active scope." />
      <form onSubmit={createSpace} className="lifeos-panel mb-4 flex flex-wrap gap-3 p-4">
        <input
          className="lifeos-input min-w-[12rem] flex-1"
          placeholder="New space name"
          value={spaceName}
          onChange={(e) => setSpaceName(e.target.value)}
          required
        />
        <button type="submit" className="lifeos-btn-primary" disabled={pending}>
          Create space
        </button>
      </form>
      {spacesLoading ? <LoadingBlock /> : null}
      {spacesError ? <ErrorBlock error={spacesError} onRetry={() => void reloadSpaces()} /> : null}
      {spaces.length ? (
        <div className="lifeos-panel mb-4 flex flex-wrap items-center gap-3 p-4">
          <label htmlFor="knowledge-space" className="text-sm font-medium text-slate-700">
            Space
          </label>
          <select
            id="knowledge-space"
            className="lifeos-input min-w-[12rem]"
            value={activeSpaceId}
            onChange={(e) => setSelectedSpaceId(e.target.value)}
          >
            {spaces.map((row) => {
              const s = row as Record<string, unknown>;
              return (
                <option key={String(s.id)} value={String(s.id)}>
                  {String(s.name)}
                </option>
              );
            })}
          </select>
        </div>
      ) : null}
      {activeSpaceId ? (
        <form onSubmit={createArticle} className="lifeos-panel mb-6 space-y-3 p-4">
          <input
            className="lifeos-input"
            placeholder="Article title"
            value={articleTitle}
            onChange={(e) => setArticleTitle(e.target.value)}
            required
          />
          <textarea
            className="lifeos-input min-h-[8rem]"
            placeholder="Article body"
            value={articleBody}
            onChange={(e) => setArticleBody(e.target.value)}
          />
          <button type="submit" className="lifeos-btn-primary" disabled={pending}>
            {pending ? 'Saving…' : 'Create article'}
          </button>
        </form>
      ) : (
        <EmptyBlock title="No knowledge spaces" description="Create a space to add articles." />
      )}
      {formError ? (
        <p className="mb-4 text-sm text-red-800" role="alert">
          {formError}
        </p>
      ) : null}
      {activeSpaceId && articlesLoading ? <LoadingBlock /> : null}
      {activeSpaceId && articlesError ? (
        <ErrorBlock error={articlesError} onRetry={() => void reloadArticles()} />
      ) : null}
      {activeSpaceId && !articlesLoading && !articlesError ? (
        <section className="lifeos-panel p-4">
          {articlesData?.items?.length ? (
            <ul className="divide-y divide-slate-200/80">
              {articlesData.items.map((row) => {
                const a = row as Record<string, unknown>;
                return (
                  <li key={String(a.id)} className="py-3">
                    <h3 className="font-medium">{String(a.title)}</h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{String(a.body ?? '')}</p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyBlock title="No articles" description="Add an article in this space." />
          )}
        </section>
      ) : null}
    </>
  );
}
