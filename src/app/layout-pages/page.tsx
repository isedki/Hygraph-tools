import { fetchPublishedLayoutPages } from '@/lib/hygraph/layoutPages';

export const metadata = {
  title: 'Published Layout Pages',
};

export const revalidate = 300;

function formatDate(value: string | null): string {
  if (!value) return '—';

  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default async function LayoutPages() {
  let error: string | null = null;
  let pages: Awaited<ReturnType<typeof fetchPublishedLayoutPages>> = [];

  try {
    pages = await fetchPublishedLayoutPages();
  } catch (err) {
    error =
      err instanceof Error
        ? err.message
        : 'Unable to load LayoutPage entries. Please try again.';
  }

  return (
    <div className="min-h-screen grid-pattern">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8">
        <header className="text-center">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">
            Hygraph Content
          </p>
          <h1 className="mt-2 text-3xl font-semibold gradient-text">
            Published LayoutPage entries
          </h1>
          <p className="mt-3 text-muted-foreground">
            This view fetches live data from your Hygraph project using the{' '}
            <code className="rounded bg-card px-1.5 py-0.5">layoutPages</code> query filtered
            to the published stage.
          </p>
        </header>

        {error ? (
          <div className="card border border-red-500/40 bg-red-500/5 text-red-200">
            <p className="font-medium">Connection error</p>
            <p className="text-sm text-red-200/80">{error}</p>
          </div>
        ) : pages.length === 0 ? (
          <div className="card text-center text-muted-foreground">
            No published LayoutPage entries were found.
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Total entries</span>
              <span className="text-lg font-semibold text-foreground">{pages.length}</span>
            </div>

            <div className="grid gap-4">
              {pages.map(page => (
                <article
                  key={page.id}
                  className="card animate-fade-in border border-border/60 shadow-lg shadow-black/10"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        LayoutPage
                      </p>
                      <h2 className="text-xl font-semibold text-foreground">
                        {page.title || 'Untitled entry'}
                      </h2>
                    </div>
                    <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-300">
                      Published
                    </span>
                  </div>

                  <dl className="mt-4 grid gap-4 md:grid-cols-3">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        Slug
                      </dt>
                      <dd className="mt-1 font-mono text-sm text-foreground/90">
                        {page.slug?.length ? page.slug : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        Last updated
                      </dt>
                      <dd className="mt-1 text-sm text-foreground/90">{formatDate(page.updatedAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        Published at
                      </dt>
                      <dd className="mt-1 text-sm text-foreground/90">
                        {formatDate(page.publishedAt)}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}




