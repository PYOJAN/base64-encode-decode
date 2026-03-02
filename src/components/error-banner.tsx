interface ErrorBannerProps {
  error: string
}

export function ErrorBanner({ error }: ErrorBannerProps) {
  if (!error) return null

  return (
    <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 shrink-0">
      <div className="h-2 w-2 shrink-0 rounded-full bg-destructive" />
      <p className="text-xs text-destructive font-mono break-all truncate">
        {error}
      </p>
    </div>
  )
}
